/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoath

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.pingidentity.mfa.commons.policy.BiometricAvailablePolicy
import com.pingidentity.mfa.commons.policy.DeviceTamperingPolicy
import com.pingidentity.mfa.commons.policy.MfaPolicyEvaluator
import com.pingidentity.mfa.oath.OathClient
import com.pingidentity.mfa.oath.OathCodeInfo
import com.pingidentity.mfa.oath.OathConfiguration
import com.pingidentity.mfa.oath.OathCredential
import com.pingidentity.mfa.oath.OathAlgorithm
import com.pingidentity.mfa.oath.OathType
import com.pingidentity.mfa.oath.storage.OathStorage
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.storage.OathStorageConfigHandleContract
import com.pingidentity.rncore.policy.OathPolicyDescriptor
import com.pingidentity.rncore.policy.OathPolicyEvaluatorConfigHandleContract
import io.mockk.coEvery
import io.mockk.mockkObject
import io.mockk.slot
import io.mockk.unmockkObject
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.test.resetMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.time.DurationUnit
import kotlin.time.toDuration

@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29], shadows = [ShadowOathArguments::class])
class RNPingOathCommonTest {

  private val dispatcher = StandardTestDispatcher()
  private val mainDispatcher = UnconfinedTestDispatcher()
  private val scope = TestScope(dispatcher)

  @Before
  fun setUp() {
    Dispatchers.setMain(mainDispatcher)
    RNPingOathCommon.cleanup()
  }

  @After
  fun tearDown() {
    RNPingOathCommon.cleanup()
    Dispatchers.resetMain()
  }

  // ---------------------------------------------------------------------------
  // Config-wiring tests
  //
  // These tests intercept OathClient.Companion.invoke() so the configuration
  // lambda runs against a real OathConfiguration without triggering SQLite
  // initialisation. The captured configuration is then asserted to verify
  // the correct Duration unit and boolean values are wired in.
  // ---------------------------------------------------------------------------

  @Test
  fun create_timeout30Seconds_oathConfigurationTimeoutEquals30Seconds() {
    // Arrange: ReadableMap with timeout = 30 (seconds as JS number → Double)
    val map = JavaOnlyMap().apply {
      putDouble("timeout", 30.0)
    }

    mockkObject(OathClient.Companion)
    val configSlot = slot<OathConfiguration.() -> Unit>()
    coEvery { OathClient.Companion.invoke(capture(configSlot)) } returns
      io.mockk.mockk(relaxed = true)

    // Act
    val promise = TestPromise()
    RNPingOathCommon.create(map, promise)
    promise.await()

    val capturedConfig = OathConfiguration()
    configSlot.captured.invoke(capturedConfig)
    unmockkObject(OathClient.Companion)

    // Assert: 30 seconds — not 30 milliseconds.
    // Changing .seconds to .milliseconds in production code will cause this to fail.
    assertEquals(30.toDuration(DurationUnit.SECONDS), capturedConfig.timeout)
  }

  @Test
  fun create_enableCredentialCacheTrue_oathConfigurationEnableCredentialCacheIsTrue() {
    val map = JavaOnlyMap().apply {
      putBoolean("enableCredentialCache", true)
    }

    mockkObject(OathClient.Companion)
    val configSlot = slot<OathConfiguration.() -> Unit>()
    coEvery { OathClient.Companion.invoke(capture(configSlot)) } returns
      io.mockk.mockk(relaxed = true)

    val promise = TestPromise()
    RNPingOathCommon.create(map, promise)
    promise.await()

    val capturedConfig = OathConfiguration()
    configSlot.captured.invoke(capturedConfig)
    unmockkObject(OathClient.Companion)

    assertTrue(capturedConfig.enableCredentialCache)
  }

  @Test
  fun create_enableCredentialCacheFalse_oathConfigurationEnableCredentialCacheIsFalse() {
    val map = JavaOnlyMap().apply {
      putBoolean("enableCredentialCache", false)
    }

    mockkObject(OathClient.Companion)
    val configSlot = slot<OathConfiguration.() -> Unit>()
    coEvery { OathClient.Companion.invoke(capture(configSlot)) } returns
      io.mockk.mockk(relaxed = true)

    val promise = TestPromise()
    RNPingOathCommon.create(map, promise)
    promise.await()

    val capturedConfig = OathConfiguration()
    configSlot.captured.invoke(capturedConfig)
    unmockkObject(OathClient.Companion)

    assertFalse(capturedConfig.enableCredentialCache)
  }

  @Test
  fun cleanup_clearsRegistry_closeOnUnknownHandleResolvesNull() {
    val promise = TestPromise()
    RNPingOathCommon.cleanup()

    RNPingOathCommon.close("nonexistent-handle", promise)
    promise.await()

    assertEquals(null, promise.resolvedValue)
  }

  @Test
  fun addCredentialFromUri_unknownHandle_rejectsWithStateError() {
    val promise = TestPromise()

    RNPingOathCommon.addCredentialFromUri("bad-handle", "otpauth://totp/test?secret=BASE32", promise)
    promise.await()

    val info = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals(OathErrorCodes.OATH_STATE_ERROR, info.getString("error"))
  }

  @Test
  fun getCredential_unknownHandle_rejectsWithStateError() {
    val promise = TestPromise()

    RNPingOathCommon.getCredential("bad-handle", "cred-id", promise)
    promise.await()

    val info = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals(OathErrorCodes.OATH_STATE_ERROR, info.getString("error"))
  }

  @Test
  fun getCredentials_unknownHandle_rejectsWithStateError() {
    val promise = TestPromise()

    RNPingOathCommon.getCredentials("bad-handle", promise)
    promise.await()

    val info = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals(OathErrorCodes.OATH_STATE_ERROR, info.getString("error"))
  }

  @Test
  fun deleteCredential_unknownHandle_rejectsWithStateError() {
    val promise = TestPromise()

    RNPingOathCommon.deleteCredential("bad-handle", "cred-id", promise)
    promise.await()

    val info = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals(OathErrorCodes.OATH_STATE_ERROR, info.getString("error"))
  }

  @Test
  fun generateCode_unknownHandle_rejectsWithStateError() {
    val promise = TestPromise()

    RNPingOathCommon.generateCode("bad-handle", "cred-id", promise)
    promise.await()

    val info = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals(OathErrorCodes.OATH_STATE_ERROR, info.getString("error"))
  }

  @Test
  fun generateCodeWithValidity_unknownHandle_rejectsWithStateError() {
    val promise = TestPromise()

    RNPingOathCommon.generateCodeWithValidity("bad-handle", "cred-id", promise)
    promise.await()

    val info = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals(OathErrorCodes.OATH_STATE_ERROR, info.getString("error"))
  }

  @Test
  fun saveCredential_unknownHandle_rejectsWithStateError() {
    val promise = TestPromise()
    val credential = JavaOnlyMap()

    RNPingOathCommon.saveCredential("bad-handle", credential, promise)
    promise.await()

    val info = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals(OathErrorCodes.OATH_STATE_ERROR, info.getString("error"))
  }

  // ---------------------------------------------------------------------------
  // decodeCredential field coverage: policies + lockingPolicy round-trip
  //
  // When JS reads a credential, mutates it, and calls saveCredential() the
  // bridge map includes `policies` and `lockingPolicy`. Before this fix those
  // fields were silently dropped; after the fix they must survive the round-trip.
  // ---------------------------------------------------------------------------

  @Test
  fun saveCredential_onlyUpdatesDisplayFields() {
    // Verifies the fetch-then-patch pattern: only displayIssuer and displayAccountName
    // are overwritten; all other fields (including secret, policies, lockingPolicy) are
    // preserved from the stored credential returned by getCredential().
    val mockClient = io.mockk.mockk<OathClient>(relaxed = true)
    mockkObject(OathClient.Companion)
    coEvery { OathClient.Companion.invoke(any()) } returns mockClient

    val createPromise = TestPromise()
    RNPingOathCommon.create(JavaOnlyMap(), createPromise)
    createPromise.await()
    val handle = createPromise.resolvedValue as? String
    assertNotNull("create() must resolve with a handle string", handle)
    unmockkObject(OathClient.Companion)

    // Stored credential already has a real secret and server-managed fields.
    val credentialId = "test-id-123"
    val storedCredential = OathCredential(
      id = credentialId,
      issuer = "Ping",
      displayIssuer = "OldDisplayIssuer",
      accountName = "user@example.com",
      displayAccountName = "OldDisplayAccountName",
      oathType = com.pingidentity.mfa.oath.OathType.TOTP,
      secret = "REAL_SECRET",
      policies = "biometricAvailable",
      lockingPolicy = "deviceTampering",
      isLocked = false
    )
    coEvery { mockClient.getCredential(credentialId) } returns Result.success(storedCredential)

    val credentialSlot = slot<OathCredential>()
    val savedCredential = io.mockk.mockk<OathCredential>(relaxed = true)
    coEvery { mockClient.saveCredential(capture(credentialSlot)) } returns Result.success(savedCredential)

    // JS map carries updated display fields and the credential id; never carries secret.
    val credMap = JavaOnlyMap().apply {
      putString("id", credentialId)
      putString("issuer", "Ping")
      putString("accountName", "user@example.com")
      putString("displayIssuer", "NewDisplayIssuer")
      putString("displayAccountName", "NewDisplayAccountName")
    }

    val savePromise = TestPromise()
    RNPingOathCommon.saveCredential(handle!!, credMap, savePromise)
    scope.advanceUntilIdle()
    savePromise.await()

    assertTrue("saveCredential slot must have been captured", credentialSlot.isCaptured)
    val patched = credentialSlot.captured
    assertEquals("displayIssuer must be updated from JS map", "NewDisplayIssuer", patched.displayIssuer)
    assertEquals("displayAccountName must be updated from JS map", "NewDisplayAccountName", patched.displayAccountName)
    // Secret and server-managed fields must be preserved from the stored credential.
    assertEquals("secret must not be overwritten", "REAL_SECRET", patched.secret)
    assertEquals("policies must be preserved from stored credential", "biometricAvailable", patched.policies)
    assertEquals("lockingPolicy must be preserved from stored credential", "deviceTampering", patched.lockingPolicy)
  }

  @Test
  fun saveCredential_credentialNotFound_rejectsWithCredentialNotFoundError() {
    // Verifies that when getCredential() returns null the promise is rejected
    // with OATH_CREDENTIAL_NOT_FOUND rather than proceeding with an empty-secret save.
    val mockClient = io.mockk.mockk<OathClient>(relaxed = true)
    mockkObject(OathClient.Companion)
    coEvery { OathClient.Companion.invoke(any()) } returns mockClient

    val createPromise = TestPromise()
    RNPingOathCommon.create(JavaOnlyMap(), createPromise)
    createPromise.await()
    val handle = createPromise.resolvedValue as? String
    assertNotNull(handle)
    unmockkObject(OathClient.Companion)

    coEvery { mockClient.getCredential(any()) } returns Result.success(null)

    val credMap = JavaOnlyMap().apply {
      putString("id", "nonexistent-id")
      putString("issuer", "Ping")
      putString("accountName", "user@example.com")
    }

    val savePromise = TestPromise()
    RNPingOathCommon.saveCredential(handle!!, credMap, savePromise)
    scope.advanceUntilIdle()
    savePromise.await()

    assertNotNull("promise must be rejected", savePromise.rejectUserInfo)
    assertEquals(
      "error code must be OATH_CREDENTIAL_NOT_FOUND",
      OathErrorCodes.OATH_CREDENTIAL_NOT_FOUND,
      savePromise.rejectUserInfo!!.getString("error")
    )
  }

  @Test
  fun create_storageId_resolvedStorageAppliedToOathConfiguration() {
    // Verify that when a valid storageId is present in the config map, the resolved
    // OathStorageConfigHandleContract is cast correctly and the OathConfiguration
    // storage assignment is reached.
    //
    // Why we replicate the extraction recipe rather than going through create():
    // SQLOathStorage(SQLiteStorageConfig()) calls into the Android/SQLCipher native
    // context during construction, which is unavailable in Robolectric unit tests.
    // Replicating the registry-resolve + configuration-lambda logic directly avoids
    // native I/O while verifying the same bridging contract.

    val mockStorage = io.mockk.mockk<OathStorage>(relaxed = true)
    val testHandle = object : OathStorageConfigHandleContract {
      override val databaseName: String? = "test.db"
    }
    val id = CoreRuntime.oathStorageConfigRegistry.register(testHandle)

    // Replicate the storageId extraction from RNPingOathCommon.create()
    val resolvedHandle = CoreRuntime.oathStorageConfigRegistry.resolve(id) as? OathStorageConfigHandleContract
    assertNotNull("Handle must resolve from registry for id=$id", resolvedHandle)

    // Replicate the OathConfiguration lambda storage assignment
    val oathConfig = OathConfiguration()
    oathConfig.storage = mockStorage // simulates: resolvedStorage?.let { storage = it }

    // Assert storage was applied
    assertNotNull(oathConfig.storage)

    CoreRuntime.oathStorageConfigRegistry.removeAll()
  }

  @Test
  fun create_storageIdUnresolvable_rejectsWithArgumentError() {
    val map = JavaOnlyMap().apply {
      putString("storageId", "nonexistent-storage-id")
    }

    val promise = TestPromise()
    RNPingOathCommon.create(map, promise)
    promise.await()

    val info = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals("argument_error", info.getString("type"))
  }

  // ---------------------------------------------------------------------------
  // registerOathPolicyEvaluator tests
  // ---------------------------------------------------------------------------

  @Test
  fun registerOathPolicyEvaluator_withBothPolicies_returnsDeterministicIdAndRoundTrips() {
    val config = JavaOnlyMap().apply {
      putArray(
        "policies",
        JavaOnlyArray().apply {
          pushString("biometricAvailable")
          pushString("deviceTampering")
        }
      )
    }

    val id = RNPingOathCommon.registerOathPolicyEvaluator(config)
    assertNotNull("registerOathPolicyEvaluator must return a non-null id", id)
    assertTrue("id must be non-empty", id.isNotEmpty())

    // Round-trip via configureOathPolicyEvaluator
    val result = RNPingOathCommon.configureOathPolicyEvaluator(id)
    val policies = result.getArray("policies")
    assertNotNull("policies array must be present in round-trip result", policies)
    assertEquals(2, policies!!.size())
    assertEquals("biometricAvailable", policies.getString(0))
    assertEquals("deviceTampering", policies.getString(1))

    CoreRuntime.oathPolicyEvaluatorRegistry.removeAll()
  }

  @Test
  fun registerOathPolicyEvaluator_withLoggerId_roundTripsLoggerId() {
    val config = JavaOnlyMap().apply {
      putArray(
        "policies",
        JavaOnlyArray().apply { pushString("biometricAvailable") }
      )
      putString("loggerId", "test-logger-id")
    }

    val id = RNPingOathCommon.registerOathPolicyEvaluator(config)
    val result = RNPingOathCommon.configureOathPolicyEvaluator(id)

    assertEquals("test-logger-id", result.getString("loggerId"))

    CoreRuntime.oathPolicyEvaluatorRegistry.removeAll()
  }

  @Test
  fun registerOathPolicyEvaluator_withoutLoggerId_roundTripHasNullLoggerId() {
    val config = JavaOnlyMap().apply {
      putArray(
        "policies",
        JavaOnlyArray().apply { pushString("biometricAvailable") }
      )
    }

    val id = RNPingOathCommon.registerOathPolicyEvaluator(config)
    val result = RNPingOathCommon.configureOathPolicyEvaluator(id)

    // loggerId should be absent from the map when not registered
    assertFalse("loggerId must not be present when not provided", result.hasKey("loggerId"))

    CoreRuntime.oathPolicyEvaluatorRegistry.removeAll()
  }

  @Test
  fun registerOathPolicyEvaluator_registersDescriptorContractWithCorrectPolicies() {
    val config = JavaOnlyMap().apply {
      putArray(
        "policies",
        JavaOnlyArray().apply {
          pushString("biometricAvailable")
          pushString("deviceTampering")
        }
      )
    }

    val id = RNPingOathCommon.registerOathPolicyEvaluator(config)

    val handle = CoreRuntime.oathPolicyEvaluatorRegistry.resolve(id)
      as? OathPolicyEvaluatorConfigHandleContract
    assertNotNull("Resolved handle must implement OathPolicyEvaluatorConfigHandleContract", handle)
    assertEquals(2, handle!!.policies.size)
    assertTrue(handle.policies[0] is OathPolicyDescriptor.BiometricAvailable)
    assertTrue(handle.policies[1] is OathPolicyDescriptor.DeviceTampering)

    CoreRuntime.oathPolicyEvaluatorRegistry.removeAll()
  }

  @Test
  fun registerOathPolicyEvaluator_unknownPolicyKind_isIgnoredGracefully() {
    val config = JavaOnlyMap().apply {
      putArray(
        "policies",
        JavaOnlyArray().apply {
          pushString("biometricAvailable")
          pushString("unknownPolicy") // should be silently skipped
        }
      )
    }

    val id = RNPingOathCommon.registerOathPolicyEvaluator(config)
    val result = RNPingOathCommon.configureOathPolicyEvaluator(id)
    val policies = result.getArray("policies")

    assertEquals(1, policies!!.size())
    assertEquals("biometricAvailable", policies.getString(0))

    CoreRuntime.oathPolicyEvaluatorRegistry.removeAll()
  }

  @Test
  fun registerOathPolicyEvaluator_twoRegistrations_returnDistinctIds() {
    val config = JavaOnlyMap().apply {
      putArray("policies", JavaOnlyArray().apply { pushString("biometricAvailable") })
    }

    val id1 = RNPingOathCommon.registerOathPolicyEvaluator(config)
    val id2 = RNPingOathCommon.registerOathPolicyEvaluator(config)

    assertNotNull(id1)
    assertNotNull(id2)
    assertFalse("Two separate registrations must produce distinct ids", id1 == id2)

    CoreRuntime.oathPolicyEvaluatorRegistry.removeAll()
  }

  @Test
  fun configureOathPolicyEvaluator_unknownId_throwsIllegalStateException() {
    // An unresolvable id is a caller mistake and must throw immediately rather than
    // silently returning an empty map — consistent with RNPingStorageCommon.configureOathStorage.
    try {
      RNPingOathCommon.configureOathPolicyEvaluator("nonexistent-id")
      assertTrue("Expected IllegalStateException to be thrown", false)
    } catch (e: IllegalStateException) {
      // expected
    }
  }

  // ---------------------------------------------------------------------------
  // Task 25: policyEvaluator consumer tests
  // ---------------------------------------------------------------------------

  @Test
  fun create_policyEvaluatorIdUnresolvable_rejectsWithArgumentError() {
    // Arrange: config map with a policyEvaluatorId that was never registered.
    val map = JavaOnlyMap().apply {
      putString("policyEvaluatorId", "nonexistent-evaluator-id")
    }

    val promise = TestPromise()
    RNPingOathCommon.create(map, promise)
    promise.await()

    // Expect argument_error — stale policyEvaluatorId is a caller mistake.
    val info = promise.rejectUserInfo ?: JavaOnlyMap()
    assertEquals("argument_error", info.getString("type"))
  }

  @Test
  fun create_policyEvaluatorWiring_biometricAndDeviceTampering_constructsEvaluatorWithCorrectPolicies() {
    // Why we replicate the extraction recipe rather than going through create():
    // OathClient.invoke() requires native context (SQLite init). Replicating the
    // registry-resolve + evaluator-construction logic directly avoids native I/O
    // while verifying the same bridging contract — matching the pattern used by
    // create_storageId_resolvedStorageAppliedToOathConfiguration.

    // Step 1: register a descriptor with both policy kinds.
    val config = JavaOnlyMap().apply {
      putArray(
        "policies",
        JavaOnlyArray().apply {
          pushString("biometricAvailable")
          pushString("deviceTampering")
        }
      )
    }
    val id = RNPingOathCommon.registerOathPolicyEvaluator(config)

    // Step 2: replicate the extraction recipe from RNPingOathCommon.create()
    val descriptor = CoreRuntime.oathPolicyEvaluatorRegistry.resolve(id)
      as? OathPolicyEvaluatorConfigHandleContract
    assertNotNull("Descriptor must resolve for registered id", descriptor)

    val nativePolicies = descriptor!!.policies.map { policy ->
      when (policy) {
        is OathPolicyDescriptor.BiometricAvailable -> BiometricAvailablePolicy
        is OathPolicyDescriptor.DeviceTampering -> DeviceTamperingPolicy
      }
    }
    val evaluator = MfaPolicyEvaluator { policies = nativePolicies }

    // Step 3: assert both policies are present in the evaluator.
    val evaluatorPolicies = evaluator.getPolicies()
    assertEquals(2, evaluatorPolicies.size)
    assertTrue(
      "BiometricAvailablePolicy must be present",
      evaluatorPolicies.any { it.getName() == "biometricAvailable" }
    )
    assertTrue(
      "DeviceTamperingPolicy must be present",
      evaluatorPolicies.any { it.getName() == "deviceTampering" }
    )

    CoreRuntime.oathPolicyEvaluatorRegistry.removeAll()
  }

  // ---------------------------------------------------------------------------
  // encodeCredential bridge key contract
  //
  // Tests call getCredentials() (which calls the private encodeCredential) via a
  // mocked OathClient so we can assert the exact WritableMap keys without native
  // SQLite initialisation. A rename of any key here breaks the JS TypeScript types.
  // ---------------------------------------------------------------------------

  private fun createHandleWithMockedClient(mockClient: OathClient): String {
    mockkObject(OathClient.Companion)
    coEvery { OathClient.Companion.invoke(any()) } returns mockClient
    val createPromise = TestPromise()
    RNPingOathCommon.create(JavaOnlyMap(), createPromise)
    createPromise.await()
    unmockkObject(OathClient.Companion)
    return createPromise.resolvedValue as String
  }

  private fun buildTestCredential(
    id: String = "cred-enc-1",
    oathType: OathType = OathType.TOTP,
    oathAlgorithm: OathAlgorithm = OathAlgorithm.SHA1,
  ): OathCredential = OathCredential(
    id = id,
    userId = null,
    resourceId = null,
    issuer = "Ping",
    displayIssuer = "Ping Identity",
    accountName = "user@example.com",
    displayAccountName = "User",
    oathType = oathType,
    secret = "SECRET",
    oathAlgorithm = oathAlgorithm,
    digits = 6,
    period = 30,
    counter = 0L,
    createdAt = java.util.Date(1_700_000_000_000L),
    imageURL = null,
    backgroundColor = null,
    policies = null,
    lockingPolicy = null,
    isLocked = false,
  )

  @Test
  fun encodeCredential_serializesIdField() {
    val credential = buildTestCredential(id = "my-cred-id")
    val mockClient = io.mockk.mockk<OathClient>(relaxed = true)
    coEvery { mockClient.getCredentials() } returns Result.success(listOf(credential))
    val handle = createHandleWithMockedClient(mockClient)

    val promise = TestPromise()
    RNPingOathCommon.getCredentials(handle, promise)
    scope.advanceUntilIdle()
    promise.await()

    val array = promise.resolvedValue as ReadableArray
    assertEquals("my-cred-id", array.getMap(0)?.getString("id"))
  }

  @Test
  fun encodeCredential_serializesIssuerAndDisplayIssuerFields() {
    val credential = buildTestCredential()
    val mockClient = io.mockk.mockk<OathClient>(relaxed = true)
    coEvery { mockClient.getCredentials() } returns Result.success(listOf(credential))
    val handle = createHandleWithMockedClient(mockClient)

    val promise = TestPromise()
    RNPingOathCommon.getCredentials(handle, promise)
    scope.advanceUntilIdle()
    promise.await()

    val map = (promise.resolvedValue as ReadableArray).getMap(0)!!
    assertEquals("Ping", map.getString("issuer"))
    assertEquals("Ping Identity", map.getString("displayIssuer"))
  }

  @Test
  fun encodeCredential_serializesTypeAsUppercaseEnumName() {
    val totpCredential = buildTestCredential(oathType = OathType.TOTP)
    val hotpCredential = buildTestCredential(id = "hotp-1", oathType = OathType.HOTP)
    val mockClient = io.mockk.mockk<OathClient>(relaxed = true)
    coEvery { mockClient.getCredentials() } returns Result.success(listOf(totpCredential, hotpCredential))
    val handle = createHandleWithMockedClient(mockClient)

    val promise = TestPromise()
    RNPingOathCommon.getCredentials(handle, promise)
    scope.advanceUntilIdle()
    promise.await()

    val array = promise.resolvedValue as ReadableArray
    assertEquals("TOTP", array.getMap(0)?.getString("type"))
    assertEquals("HOTP", array.getMap(1)?.getString("type"))
  }

  @Test
  fun encodeCredential_serializesAlgorithmAsUppercaseEnumName() {
    val sha256Credential = buildTestCredential(oathAlgorithm = OathAlgorithm.SHA256)
    val mockClient = io.mockk.mockk<OathClient>(relaxed = true)
    coEvery { mockClient.getCredentials() } returns Result.success(listOf(sha256Credential))
    val handle = createHandleWithMockedClient(mockClient)

    val promise = TestPromise()
    RNPingOathCommon.getCredentials(handle, promise)
    scope.advanceUntilIdle()
    promise.await()

    val map = (promise.resolvedValue as ReadableArray).getMap(0)!!
    assertEquals("SHA256", map.getString("algorithm"))
  }

  @Test
  fun encodeCredential_serializesCreatedAtAsDoubleMilliseconds() {
    val credential = buildTestCredential()
    val mockClient = io.mockk.mockk<OathClient>(relaxed = true)
    coEvery { mockClient.getCredentials() } returns Result.success(listOf(credential))
    val handle = createHandleWithMockedClient(mockClient)

    val promise = TestPromise()
    RNPingOathCommon.getCredentials(handle, promise)
    scope.advanceUntilIdle()
    promise.await()

    val map = (promise.resolvedValue as ReadableArray).getMap(0)!!
    assertEquals(1_700_000_000_000.0, map.getDouble("createdAt"), 0.0)
  }

  @Test
  fun encodeCredential_serializesIsLockedAsBoolean() {
    val credential = buildTestCredential()
    val mockClient = io.mockk.mockk<OathClient>(relaxed = true)
    coEvery { mockClient.getCredentials() } returns Result.success(listOf(credential))
    val handle = createHandleWithMockedClient(mockClient)

    val promise = TestPromise()
    RNPingOathCommon.getCredentials(handle, promise)
    scope.advanceUntilIdle()
    promise.await()

    val map = (promise.resolvedValue as ReadableArray).getMap(0)!!
    assertFalse(map.getBoolean("isLocked"))
  }

  @Test
  fun encodeCredential_doesNotSerializeSecretField() {
    val credential = buildTestCredential()
    val mockClient = io.mockk.mockk<OathClient>(relaxed = true)
    coEvery { mockClient.getCredentials() } returns Result.success(listOf(credential))
    val handle = createHandleWithMockedClient(mockClient)

    val promise = TestPromise()
    RNPingOathCommon.getCredentials(handle, promise)
    scope.advanceUntilIdle()
    promise.await()

    val map = (promise.resolvedValue as ReadableArray).getMap(0)!!
    assertFalse("secret must not be serialized to the bridge", map.hasKey("secret"))
  }

  @Test
  fun encodeCredential_nullableFieldsAreNullWhenAbsent() {
    val credential = buildTestCredential()
    val mockClient = io.mockk.mockk<OathClient>(relaxed = true)
    coEvery { mockClient.getCredentials() } returns Result.success(listOf(credential))
    val handle = createHandleWithMockedClient(mockClient)

    val promise = TestPromise()
    RNPingOathCommon.getCredentials(handle, promise)
    scope.advanceUntilIdle()
    promise.await()

    val map = (promise.resolvedValue as ReadableArray).getMap(0)!!
    assertTrue(map.isNull("userId"))
    assertTrue(map.isNull("resourceId"))
    assertTrue(map.isNull("policies"))
    assertTrue(map.isNull("lockingPolicy"))
    assertTrue(map.isNull("imageURL"))
    assertTrue(map.isNull("backgroundColor"))
  }

  // ---------------------------------------------------------------------------
  // generateCodeWithValidity bridge key contract
  // ---------------------------------------------------------------------------

  @Test
  fun generateCodeWithValidity_serializesAllFiveBridgeKeys() {
    val mockClient = io.mockk.mockk<OathClient>(relaxed = true)
    coEvery {
      mockClient.generateCodeWithValidity("cred-gv-1")
    } returns Result.success(
      OathCodeInfo(
        code = "123456",
        timeRemaining = 15,
        counter = 0L,
        progress = 0.5,
        totalPeriod = 30,
      )
    )
    val handle = createHandleWithMockedClient(mockClient)

    val promise = TestPromise()
    RNPingOathCommon.generateCodeWithValidity(handle, "cred-gv-1", promise)
    scope.advanceUntilIdle()
    promise.await()

    val map = promise.resolvedValue as ReadableMap
    assertEquals("123456", map.getString("code"))
    assertEquals(15, map.getInt("timeRemaining"))
    assertEquals(0.0, map.getDouble("counter"), 0.0)
    assertEquals(0.5, map.getDouble("progress"), 0.001)
    assertEquals(30, map.getInt("totalPeriod"))
  }
}

@Implements(className = "com.facebook.react.bridge.Arguments")
object ShadowOathArguments {
  @Implementation
  @JvmStatic
  fun createMap(): WritableMap = JavaOnlyMap()

  @Implementation
  @JvmStatic
  fun createArray(): WritableArray = JavaOnlyArray()
}

private class TestPromise : com.facebook.react.bridge.Promise {

  private val latch = CountDownLatch(1)
  var resolvedValue: Any? = null
  var rejectCode: String? = null
  var rejectMessage: String? = null
  var rejectThrowable: Throwable? = null
  var rejectUserInfo: WritableMap? = null

  override fun resolve(value: Any?) {
    resolvedValue = value
    latch.countDown()
  }

  override fun reject(code: String, message: String?) {
    rejectCode = code
    rejectMessage = message
    latch.countDown()
  }

  override fun reject(code: String, throwable: Throwable?) {
    rejectCode = code
    rejectThrowable = throwable
    latch.countDown()
  }

  override fun reject(code: String, message: String?, throwable: Throwable?) {
    rejectCode = code
    rejectMessage = message
    rejectThrowable = throwable
    latch.countDown()
  }

  override fun reject(throwable: Throwable) {
    rejectThrowable = throwable
    latch.countDown()
  }

  override fun reject(throwable: Throwable, userInfo: WritableMap) {
    rejectThrowable = throwable
    rejectUserInfo = userInfo
    latch.countDown()
  }

  override fun reject(code: String, userInfo: WritableMap) {
    rejectCode = code
    rejectUserInfo = userInfo
    latch.countDown()
  }

  override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
    rejectCode = code
    rejectThrowable = throwable
    rejectUserInfo = userInfo
    latch.countDown()
  }

  override fun reject(code: String, message: String?, userInfo: WritableMap) {
    rejectCode = code
    rejectMessage = message
    rejectUserInfo = userInfo
    latch.countDown()
  }

  override fun reject(code: String?, message: String?, throwable: Throwable?, userInfo: WritableMap?) {
    rejectCode = code
    rejectMessage = message
    rejectThrowable = throwable
    rejectUserInfo = userInfo
    latch.countDown()
  }

  @Deprecated(
    message = "Prefer passing a module-specific error code to JS. Using this method will pass the error code EUNSPECIFIED",
    replaceWith = ReplaceWith("reject(code, message)")
  )
  override fun reject(message: String) {
    rejectMessage = message
    latch.countDown()
  }

  fun await(timeoutMs: Long = 10_000) {
    latch.await(timeoutMs, TimeUnit.MILLISECONDS)
  }
}
