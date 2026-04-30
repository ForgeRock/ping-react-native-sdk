/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnbinding

import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.soloader.SoLoader
import com.facebook.soloader.nativeloader.NativeLoader
import com.facebook.soloader.nativeloader.SystemDelegate
import kotlinx.coroutines.runBlocking
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for Binding module metadata and bridge behavior.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class RNPingBindingTest {

  @Before
  fun setUp() {
    runCatching { SoLoader.init(RuntimeEnvironment.getApplication(), false) }
    runCatching { NativeLoader.init(SystemDelegate()) }
    RNPingBindingCommon.foregroundActivityProvider = { true }
  }

  @After
  fun tearDown() {
    RNPingBindingCommon.foregroundActivityProvider = { true }
  }

  // MARK: - Error code contracts

  /**
   * Ensures BINDING_ERROR is the correct stable value.
   */
  @Test
  fun errorCodeBindingErrorIsCorrect() {
    assertEquals("BINDING_ERROR", BindingErrorCodes.BINDING_ERROR)
  }

  /**
   * Ensures BINDING_BIND_ERROR is the correct stable value.
   */
  @Test
  fun errorCodeBindErrorIsCorrect() {
    assertEquals("BINDING_BIND_ERROR", BindingErrorCodes.BINDING_BIND_ERROR)
  }

  /**
   * Ensures BINDING_SIGN_ERROR is the correct stable value.
   */
  @Test
  fun errorCodeSignErrorIsCorrect() {
    assertEquals("BINDING_SIGN_ERROR", BindingErrorCodes.BINDING_SIGN_ERROR)
  }

  /**
   * Ensures BINDING_CANCELLED is the correct stable value.
   */
  @Test
  fun errorCodeCancelledIsCorrect() {
    assertEquals("BINDING_CANCELLED", BindingErrorCodes.BINDING_CANCELLED)
  }

  /**
   * Ensures BINDING_UNSUPPORTED_DEVICE is the correct stable value.
   */
  @Test
  fun errorCodeUnsupportedDeviceIsCorrect() {
    assertEquals("BINDING_UNSUPPORTED_DEVICE", BindingErrorCodes.BINDING_UNSUPPORTED_DEVICE)
  }

  /**
   * Ensures BINDING_NOT_REGISTERED is the correct stable value.
   */
  @Test
  fun errorCodeNotRegisteredIsCorrect() {
    assertEquals("BINDING_NOT_REGISTERED", BindingErrorCodes.BINDING_NOT_REGISTERED)
  }

  /**
   * Ensures BINDING_UI_UNAVAILABLE is the correct stable value.
   */
  @Test
  fun errorCodeUiUnavailableIsCorrect() {
    assertEquals("BINDING_UI_UNAVAILABLE", BindingErrorCodes.BINDING_UI_UNAVAILABLE)
  }

  /**
   * Ensures BINDING_CALLBACK_NOT_FOUND is the correct stable value.
   */
  @Test
  fun errorCodeCallbackNotFoundIsCorrect() {
    assertEquals("BINDING_CALLBACK_NOT_FOUND", BindingErrorCodes.BINDING_CALLBACK_NOT_FOUND)
  }

  /**
   * Ensures BINDING_KEY_DELETE_ERROR is the correct stable value.
   */
  @Test
  fun errorCodeKeyDeleteErrorIsCorrect() {
    assertEquals("BINDING_KEY_DELETE_ERROR", BindingErrorCodes.BINDING_KEY_DELETE_ERROR)
  }

  /**
   * Ensures BINDING_KEY_INVALIDATED is the correct stable value.
   */
  @Test
  fun errorCodeKeyInvalidatedIsCorrect() {
    assertEquals("BINDING_KEY_INVALIDATED", BindingErrorCodes.BINDING_KEY_INVALIDATED)
  }

  /**
   * Ensures BINDING_AUTH_FAILED is the correct stable value.
   */
  @Test
  fun errorCodeAuthFailedIsCorrect() {
    assertEquals("BINDING_AUTH_FAILED", BindingErrorCodes.BINDING_AUTH_FAILED)
  }

  // MARK: - Common behavior

  /**
   * Ensures bind rejects when no foreground activity is available.
   */
  @Test
  fun bindForJourneyRejectsWhenActivityUnavailable() {
    RNPingBindingCommon.foregroundActivityProvider = { false }
    val promise = TestPromise()

    RNPingBindingCommon.bindForJourney("journey-123", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await(timeoutMs = 5_000))
    assertEquals(BindingErrorCodes.BINDING_UI_UNAVAILABLE, promise.rejectedCode)
    assertEquals(
      "No foreground activity is available for Journey device binding.",
      promise.rejectedMessage
    )
  }

  /**
   * Ensures sign rejects when no foreground activity is available.
   */
  @Test
  fun signForJourneyRejectsWhenActivityUnavailable() {
    RNPingBindingCommon.foregroundActivityProvider = { false }
    val promise = TestPromise()

    RNPingBindingCommon.signForJourney("journey-123", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await(timeoutMs = 5_000))
    assertEquals(BindingErrorCodes.BINDING_UI_UNAVAILABLE, promise.rejectedCode)
    assertEquals(
      "No foreground activity is available for Journey device signing.",
      promise.rejectedMessage
    )
  }

  /**
   * Ensures bind rejects with argument error when journey id is empty.
   */
  @Test
  fun bindForJourneyRejectsWhenJourneyIdEmpty() {
    val promise = TestPromise()

    RNPingBindingCommon.bindForJourney("", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(BindingErrorCodes.BINDING_CALLBACK_NOT_FOUND, promise.rejectedCode)
    assertEquals(
      "Journey id must not be empty for device binding.",
      promise.rejectedMessage
    )
  }

  /**
   * Ensures sign rejects with argument error when journey id is empty.
   */
  @Test
  fun signForJourneyRejectsWhenJourneyIdEmpty() {
    val promise = TestPromise()

    RNPingBindingCommon.signForJourney("", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(BindingErrorCodes.BINDING_CALLBACK_NOT_FOUND, promise.rejectedCode)
    assertEquals(
      "Journey id must not be empty for device signing.",
      promise.rejectedMessage
    )
  }

  /**
   * Ensures bind rejects when callback resolution fails.
   */
  @Test
  fun bindForJourneyRejectsWhenCallbackMissing() {
    RNPingBindingCommon.foregroundActivityProvider = { false }
    val promise = TestPromise()
    RNPingBindingCommon.bindForJourney("journey-missing", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await(timeoutMs = 5_000))
    assertEquals(BindingErrorCodes.BINDING_UI_UNAVAILABLE, promise.rejectedCode)
  }

  /**
   * Ensures sign rejects when callback resolution fails.
   */
  @Test
  fun signForJourneyRejectsWhenCallbackMissing() {
    RNPingBindingCommon.foregroundActivityProvider = { false }
    val promise = TestPromise()
    RNPingBindingCommon.signForJourney("journey-missing", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await(timeoutMs = 5_000))
    assertEquals(BindingErrorCodes.BINDING_UI_UNAVAILABLE, promise.rejectedCode)
  }

  // MARK: - PIN collector bridge

  /**
   * resolvePin completes the pending deferred with the supplied PIN characters.
   */
  @Test
  fun resolvePinCompletesDeferredWithPin() = runBlocking {
    val requestId = "test-resolve-001"
    val deferred = RNPingBindingCommon.addPinRequestForTest(requestId)

    RNPingBindingCommon.resolvePin(requestId, "1234")

    assertTrue(deferred.isCompleted)
    assertArrayEquals(charArrayOf('1', '2', '3', '4'), deferred.await())
  }

  /**
   * cancelPin completes the pending deferred with null.
   */
  @Test
  fun cancelPinCompletesDeferredWithNull() = runBlocking {
    val requestId = "test-cancel-001"
    val deferred = RNPingBindingCommon.addPinRequestForTest(requestId)

    RNPingBindingCommon.cancelPin(requestId)

    assertTrue(deferred.isCompleted)
    assertNull(deferred.await())
  }

  /**
   * resolvePin is a no-op when no pending request matches the given id.
   */
  @Test
  fun resolvePinIsNoOpForUnknownRequestId() {
    RNPingBindingCommon.resolvePin("unknown-id", "9999")
    // No exception — test passes
  }

  /**
   * cancelPin is a no-op when no pending request matches the given id.
   */
  @Test
  fun cancelPinIsNoOpForUnknownRequestId() {
    RNPingBindingCommon.cancelPin("unknown-id")
    // No exception — test passes
  }

  /**
   * resolvePin removes the request from the registry, so a second call with the same id is a no-op.
   */
  @Test
  fun resolvePinRemovesRequestFromRegistry() = runBlocking {
    val requestId = "test-resolve-idempotent"
    val deferred = RNPingBindingCommon.addPinRequestForTest(requestId)

    RNPingBindingCommon.resolvePin(requestId, "0000")
    RNPingBindingCommon.resolvePin(requestId, "9999") // should be no-op

    assertArrayEquals(charArrayOf('0', '0', '0', '0'), deferred.await())
  }

  /**
   * cancelPin removes the request from the registry, so a second call with the same id is a no-op.
   */
  @Test
  fun cancelPinRemovesRequestFromRegistry() = runBlocking {
    val requestId = "test-cancel-idempotent"
    val deferred = RNPingBindingCommon.addPinRequestForTest(requestId)

    RNPingBindingCommon.cancelPin(requestId)
    RNPingBindingCommon.cancelPin(requestId) // should be no-op

    assertNull(deferred.await())
  }

  /**
   * bind with hasPinCollector=true still validates preconditions (blank journey id).
   */
  @Test
  fun bindWithHasPinCollectorRejectsBlankJourneyId() {
    val config = JavaOnlyMap().apply { putBoolean("hasPinCollector", true) }
    val promise = TestPromise()

    RNPingBindingCommon.bindForJourney("", JavaOnlyMap(), config, promise)

    assertTrue(promise.await())
    assertEquals(BindingErrorCodes.BINDING_CALLBACK_NOT_FOUND, promise.rejectedCode)
  }

  /**
   * sign with hasPinCollector=true still validates preconditions (blank journey id).
   */
  @Test
  fun signWithHasPinCollectorRejectsBlankJourneyId() {
    val config = JavaOnlyMap().apply { putBoolean("hasPinCollector", true) }
    val promise = TestPromise()

    RNPingBindingCommon.signForJourney("", JavaOnlyMap(), config, promise)

    assertTrue(promise.await())
    assertEquals(BindingErrorCodes.BINDING_CALLBACK_NOT_FOUND, promise.rejectedCode)
  }

  /**
   * parseConfig normalizes logger id and collector flags.
   */
  @Test
  fun parseConfigNormalizesSupportedFields() {
    val config = JavaOnlyMap().apply {
      putString("loggerId", " logger-1 ")
      putBoolean("hasPinCollector", true)
      putBoolean("hasUserKeySelector", true)
      putString("userKeyStorageId", "storage-1")
    }

    val parsed = invokePrivate("parseConfig", config)
    assertEquals("logger-1", readProperty(parsed, "loggerId"))
    assertEquals(true, readProperty(parsed, "hasPinCollector"))
    assertEquals(true, readProperty(parsed, "hasUserKeySelector"))
    assertEquals("storage-1", readProperty(parsed, "userKeyStorageId"))
  }

  /**
   * parseCallbackIndex supports number and string payloads.
   */
  @Test
  fun parseCallbackIndexSupportsNumericAndStringValues() {
    val numeric = JavaOnlyMap().apply { putInt("index", 7) }
    val string = JavaOnlyMap().apply { putString("index", "9") }
    val invalid = JavaOnlyMap().apply { putString("index", "invalid") }

    assertEquals(7, invokePrivate("parseCallbackIndex", numeric))
    assertEquals(9, invokePrivate("parseCallbackIndex", string))
    assertEquals(0, invokePrivate("parseCallbackIndex", invalid))
  }

  /**
   * parseClaims keeps supported primitive claim value types.
   */
  @Test
  fun parseClaimsReturnsPrimitiveValuesOnly() {
    val claims = JavaOnlyMap().apply {
      putString("tenant", "alpha")
      putDouble("score", 9.0)
      putBoolean("trusted", true)
      putMap("ignored", JavaOnlyMap())
    }
    val options = JavaOnlyMap().apply {
      putMap("claims", claims)
    }

    @Suppress("UNCHECKED_CAST")
    val parsed = invokePrivate("parseClaims", options) as Map<String, Any>
    assertEquals("alpha", parsed["tenant"])
    assertEquals(9.0, parsed["score"])
    assertEquals(true, parsed["trusted"])
    assertFalse(parsed.containsKey("ignored"))
  }

  /**
   * parseConfig tolerates missing or invalid option types.
   */
  @Test
  fun parseConfigFallsBackForInvalidTypes() {
    val config = JavaOnlyMap().apply {
      putDouble("loggerId", 3.14)
      putString("hasPinCollector", "true")
      putString("hasUserKeySelector", "true")
      putDouble("userKeyStorageId", 1.0)
    }

    val parsed = invokePrivate("parseConfig", config)
    assertNull(readProperty(parsed, "loggerId"))
    assertEquals(false, readProperty(parsed, "hasPinCollector"))
    assertEquals(false, readProperty(parsed, "hasUserKeySelector"))
    assertNull(readProperty(parsed, "userKeyStorageId"))
  }

  /**
   * parseCacheStrategy maps supported strings and defaults on invalid values.
   */
  @Test
  fun parseCacheStrategyMapsValues() {
    assertNotNull(invokePrivate("parseCacheStrategy", "cache"))
    assertNotNull(invokePrivate("parseCacheStrategy", "cache_on_failure"))
    assertNotNull(invokePrivate("parseCacheStrategy", "no_cache"))
    assertNotNull(invokePrivate("parseCacheStrategy", "invalid"))
  }

  // MARK: - Callback index

  /**
   * parseCallbackIndex reads integer value from options map.
   */
  @Test
  fun parseCallbackIndexReadsIntValue() {
    val options = JavaOnlyMap().apply { putInt("index", 4) }
    assertEquals(4, invokePrivate("parseCallbackIndex", options))
  }

  /**
   * parseCallbackIndex reads parseable string value.
   */
  @Test
  fun parseCallbackIndexReadsStringValue() {
    val options = JavaOnlyMap().apply { putString("index", "9") }
    assertEquals(9, invokePrivate("parseCallbackIndex", options))
  }

  /**
   * parseCallbackIndex defaults to 0 when absent.
   */
  @Test
  fun parseCallbackIndexDefaultsToZeroWhenAbsent() {
    assertEquals(0, invokePrivate("parseCallbackIndex", JavaOnlyMap()))
  }

  /**
   * parseCallbackIndex defaults to 0 for unparseable string.
   */
  @Test
  fun parseCallbackIndexDefaultsToZeroForInvalidString() {
    val options = JavaOnlyMap().apply { putString("index", "bad") }
    assertEquals(0, invokePrivate("parseCallbackIndex", options))
  }

  // MARK: - String option (deviceName)

  /**
   * parseStringOption returns value when present.
   */
  @Test
  fun parseStringOptionReturnsValueWhenPresent() {
    val options = JavaOnlyMap().apply { putString("deviceName", "Pixel 9") }
    assertEquals("Pixel 9", invokePrivate("parseStringOption", options, "deviceName"))
  }

  /**
   * parseStringOption returns null for blank value.
   */
  @Test
  fun parseStringOptionReturnsNullForBlank() {
    val options = JavaOnlyMap().apply { putString("deviceName", "   ") }
    assertNull(invokePrivate("parseStringOption", options, "deviceName"))
  }

  /**
   * parseStringOption returns null when key is absent.
   */
  @Test
  fun parseStringOptionReturnsNullWhenAbsent() {
    assertNull(invokePrivate("parseStringOption", JavaOnlyMap(), "deviceName"))
  }

  // MARK: - appPin options

  /**
   * parseBindingOptionsForTest reads all appPin fields including new keystoreType.
   */
  @Test
  fun parseBindingOptionsReadsAllAppPinFields() {
    val prompt = JavaOnlyMap().apply {
      putString("title", "Enter PIN")
      putString("subtitle", "Verify")
      putString("description", "Use your PIN")
    }
    val appPin = JavaOnlyMap().apply {
      putDouble("maxAttempts", 5.0)
      putString("keystoreType", "PKCS12")
      putMap("prompt", prompt)
    }
    val options = JavaOnlyMap().apply { putMap("appPin", appPin) }

    val parsed = parseBindingOptionsForTest(options)

    assertEquals(5, parsed.appPinMaxAttempts)
    assertEquals("PKCS12", parsed.appPinKeystoreType)
    assertEquals("Enter PIN", parsed.appPinPromptTitle)
    assertEquals("Verify", parsed.appPinPromptSubtitle)
    assertEquals("Use your PIN", parsed.appPinPromptDescription)
  }

  /**
   * parseBindingOptionsForTest returns null appPin fields when appPin absent.
   */
  @Test
  fun parseBindingOptionsReturnsNullAppPinFieldsWhenAbsent() {
    val parsed = parseBindingOptionsForTest(JavaOnlyMap())

    assertNull(parsed.appPinMaxAttempts)
    assertNull(parsed.appPinKeystoreType)
    assertNull(parsed.appPinPromptTitle)
    assertNull(parsed.appPinPromptSubtitle)
    assertNull(parsed.appPinPromptDescription)
  }

  /**
   * parseBindingOptionsForTest handles partial appPin (only maxAttempts).
   */
  @Test
  fun parseBindingOptionsHandlesPartialAppPin() {
    val appPin = JavaOnlyMap().apply { putDouble("maxAttempts", 3.0) }
    val options = JavaOnlyMap().apply { putMap("appPin", appPin) }

    val parsed = parseBindingOptionsForTest(options)

    assertEquals(3, parsed.appPinMaxAttempts)
    assertNull(parsed.appPinKeystoreType)
    assertNull(parsed.appPinPromptTitle)
  }

  // MARK: - biometric.android options

  /**
   * parseBindingOptionsForTest reads strongBoxPreferred from biometric.android.
   */
  @Test
  fun parseBindingOptionsReadsStrongBoxPreferred() {
    val androidBiometric = JavaOnlyMap().apply {
      putBoolean("strongBoxPreferred", true)
    }
    val biometric = JavaOnlyMap().apply { putMap("android", androidBiometric) }
    val options = JavaOnlyMap().apply { putMap("biometric", biometric) }

    val parsed = parseBindingOptionsForTest(options)

    assertEquals(true, parsed.biometricAndroidStrongBoxPreferred)
  }

  /**
   * parseBindingOptionsForTest reads strongBoxPreferred=false explicitly.
   */
  @Test
  fun parseBindingOptionsReadsStrongBoxPreferredFalse() {
    val androidBiometric = JavaOnlyMap().apply { putBoolean("strongBoxPreferred", false) }
    val biometric = JavaOnlyMap().apply { putMap("android", androidBiometric) }
    val options = JavaOnlyMap().apply { putMap("biometric", biometric) }

    val parsed = parseBindingOptionsForTest(options)

    assertEquals(false, parsed.biometricAndroidStrongBoxPreferred)
  }

  /**
   * parseBindingOptionsForTest reads all biometric.android prompt fields.
   */
  @Test
  fun parseBindingOptionsReadsAllBiometricAndroidPromptFields() {
    val prompt = JavaOnlyMap().apply {
      putString("title", "Verify identity")
      putString("subtitle", "Auth required")
      putString("description", "Use biometric")
      putString("negativeButtonText", "Cancel")
    }
    val androidBiometric = JavaOnlyMap().apply { putMap("prompt", prompt) }
    val biometric = JavaOnlyMap().apply { putMap("android", androidBiometric) }
    val options = JavaOnlyMap().apply { putMap("biometric", biometric) }

    val parsed = parseBindingOptionsForTest(options)

    assertEquals("Verify identity", parsed.biometricAndroidPromptTitle)
    assertEquals("Auth required", parsed.biometricAndroidPromptSubtitle)
    assertEquals("Use biometric", parsed.biometricAndroidPromptDescription)
    assertEquals("Cancel", parsed.biometricAndroidPromptNegativeButtonText)
  }

  /**
   * parseBindingOptionsForTest returns null biometric fields when biometric absent.
   */
  @Test
  fun parseBindingOptionsReturnsNullBiometricFieldsWhenAbsent() {
    val parsed = parseBindingOptionsForTest(JavaOnlyMap())

    assertNull(parsed.biometricAndroidStrongBoxPreferred)
    assertNull(parsed.biometricAndroidPromptTitle)
    assertNull(parsed.biometricAndroidPromptSubtitle)
    assertNull(parsed.biometricAndroidPromptDescription)
    assertNull(parsed.biometricAndroidPromptNegativeButtonText)
  }

  /**
   * parseBindingOptionsForTest ignores ios-only biometric keys (no android sub-map).
   */
  @Test
  fun parseBindingOptionsIgnoresIosOnlyBiometricKeys() {
    val ios = JavaOnlyMap().apply {
      putString("keyTag", "bio-key")
      putBoolean("allowDeviceCredentialFallback", true)
    }
    val biometric = JavaOnlyMap().apply { putMap("ios", ios) }
    val options = JavaOnlyMap().apply { putMap("biometric", biometric) }

    val parsed = parseBindingOptionsForTest(options)

    assertNull(parsed.biometricAndroidStrongBoxPreferred)
    assertNull(parsed.biometricAndroidPromptTitle)
  }

  // MARK: - jwt options

  /**
   * parseBindingOptionsForTest reads all jwt epoch fields.
   */
  @Test
  fun parseBindingOptionsReadsAllJwtFields() {
    val jwt = JavaOnlyMap().apply {
      putDouble("issueTimeEpochSeconds", 1000.0)
      putDouble("notBeforeTimeEpochSeconds", 1001.0)
      putDouble("expirationTimeEpochSeconds", 1002.0)
    }
    val options = JavaOnlyMap().apply { putMap("jwt", jwt) }

    val parsed = parseBindingOptionsForTest(options)

    assertEquals(1000L, parsed.jwtIssueTimeEpochSeconds)
    assertEquals(1001L, parsed.jwtNotBeforeTimeEpochSeconds)
    assertEquals(1002L, parsed.jwtExpirationTimeEpochSeconds)
  }

  /**
   * parseBindingOptionsForTest returns null jwt fields when jwt absent.
   */
  @Test
  fun parseBindingOptionsReturnsNullJwtFieldsWhenAbsent() {
    val parsed = parseBindingOptionsForTest(JavaOnlyMap())

    assertNull(parsed.jwtIssueTimeEpochSeconds)
    assertNull(parsed.jwtNotBeforeTimeEpochSeconds)
    assertNull(parsed.jwtExpirationTimeEpochSeconds)
  }

  /**
   * parseBindingOptionsForTest handles null options map gracefully.
   */
  @Test
  fun parseBindingOptionsHandlesNullOptions() {
    val parsed = parseBindingOptionsForTest(null)

    assertNull(parsed.appPinMaxAttempts)
    assertNull(parsed.biometricAndroidStrongBoxPreferred)
    assertNull(parsed.jwtIssueTimeEpochSeconds)
  }

  private fun invokePrivate(name: String, vararg args: Any?): Any? {
    val candidates = listOf(
      RNPingBindingCommon::class.java,
      Class.forName("com.pingidentity.rnbinding.BindingOptionParserKt"),
      Class.forName("com.pingidentity.rnbinding.BindingErrorMapperKt"),
    )
    for (clazz in candidates) {
      val method = clazz.declaredMethods.firstOrNull { m ->
        m.name == name && m.parameterTypes.size == args.size
      } ?: continue
      method.isAccessible = true
      return method.invoke(null, *args)
    }
    throw NoSuchMethodException("Method $name not found in binding classes")
  }

  private fun readProperty(instance: Any?, propertyName: String): Any? {
    require(instance != null)
    val field = instance::class.java.getDeclaredField(propertyName)
    field.isAccessible = true
    return field.get(instance)
  }

  /**
   * Promise test helper used to capture asynchronous resolve/reject callbacks.
   */
  private class TestPromise : Promise {
    private val latch = CountDownLatch(1)

    var resolvedValue: Any? = null
      private set
    var rejectedCode: String? = null
      private set
    var rejectedMessage: String? = null
      private set
    var rejectedThrowable: Throwable? = null
      private set

    fun await(timeoutMs: Long = 2_000): Boolean {
      return latch.await(timeoutMs, TimeUnit.MILLISECONDS)
    }

    override fun resolve(value: Any?) {
      resolvedValue = value
      latch.countDown()
    }

    override fun reject(code: String, message: String?) {
      rejectedCode = code
      rejectedMessage = message
      latch.countDown()
    }

    override fun reject(code: String, throwable: Throwable?) {
      rejectedCode = code
      rejectedThrowable = throwable
      latch.countDown()
    }

    override fun reject(code: String, message: String?, throwable: Throwable?) {
      rejectedCode = code
      rejectedMessage = message
      rejectedThrowable = throwable
      latch.countDown()
    }

    override fun reject(throwable: Throwable) {
      rejectedThrowable = throwable
      latch.countDown()
    }

    override fun reject(throwable: Throwable, userInfo: WritableMap) {
      rejectedThrowable = throwable
      latch.countDown()
    }

    override fun reject(code: String, userInfo: WritableMap) {
      rejectedCode = code
      latch.countDown()
    }

    override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
      rejectedCode = code
      rejectedThrowable = throwable
      latch.countDown()
    }

    override fun reject(code: String, message: String?, userInfo: WritableMap) {
      rejectedCode = code
      rejectedMessage = message
      latch.countDown()
    }

    override fun reject(
      code: String?,
      message: String?,
      throwable: Throwable?,
      userInfo: WritableMap?
    ) {
      rejectedCode = code
      rejectedMessage = message
      rejectedThrowable = throwable
      latch.countDown()
    }

    @Suppress("DEPRECATION")
    override fun reject(message: String) {
      rejectedMessage = message
      latch.countDown()
    }
  }
}
