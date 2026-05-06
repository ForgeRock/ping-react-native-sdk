/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnexternalidp

import android.net.Uri
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.pingidentity.idp.journey.SelectIdpCallback
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.JourneyCallbackResolver
import com.pingidentity.rncore.error.ErrorType
import java.lang.reflect.InvocationTargetException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements

/**
 * Unit tests for External IdP module metadata and bridge behavior.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29], shadows = [ShadowExternalIdpArguments::class])
class RNPingExternalIdpTest {
  private var originalJourneyCallbackResolver: JourneyCallbackResolver? = null

  /**
   * Configure bridge test seams before each test.
   */
  @Before
  fun setUp() {
    originalJourneyCallbackResolver = CoreRuntime.journeyCallbackResolver
    CoreRuntime.journeyCallbackResolver = null
    RNPingExternalIdpCommon.foregroundActivityProvider = { true }
  }

  /**
   * Restore global bridge state after each test.
   */
  @After
  fun tearDown() {
    CoreRuntime.journeyCallbackResolver = originalJourneyCallbackResolver
    RNPingExternalIdpCommon.foregroundActivityProvider = { true }
  }

  /**
   * Ensures the TurboModule name is correct.
   */
  @Test
  fun moduleNameIsCorrect() {
    assertEquals("RNPingExternalIdp", RNPingExternalIdpModule.NAME)
  }

  /**
   * Ensures stable External IdP error code values remain unchanged.
   */
  @Test
  fun errorCodeContractsAreCorrect() {
    assertEquals("EXTERNAL_IDP_AUTHORIZE_ERROR", ExternalIdpErrorCodes.AUTHORIZE_ERROR)
    assertEquals("EXTERNAL_IDP_CANCELLED", ExternalIdpErrorCodes.CANCELLED)
    assertEquals("EXTERNAL_IDP_UNSUPPORTED_PROVIDER", ExternalIdpErrorCodes.UNSUPPORTED_PROVIDER)
    assertEquals("EXTERNAL_IDP_CALLBACK_NOT_FOUND", ExternalIdpErrorCodes.CALLBACK_NOT_FOUND)
    assertEquals("EXTERNAL_IDP_CONFIG_ERROR", ExternalIdpErrorCodes.CONFIG_ERROR)
    assertEquals("EXTERNAL_IDP_ACTIVITY_UNAVAILABLE", ExternalIdpErrorCodes.ACTIVITY_UNAVAILABLE)
  }

  /**
   * Ensures Android Credential Manager cancellation maps to the public cancellation code.
   */
  @Test
  fun credentialManagerCancellationMapsToCancelled() {
    val result = discriminateIdpError(GetCredentialCancellationException("[16] Account reauth failed."))

    assertEquals(ExternalIdpErrorCodes.CANCELLED, result.first)
    assertEquals("[16] Account reauth failed.", result.second)
  }

  /**
   * Ensures authorization rejects blank Journey ids with the shared error payload.
   */
  @Test
  fun authorizeRejectsWhenJourneyIdIsBlank() {
    val promise = TestPromise()

    RNPingExternalIdpCommon.authorizeForJourney("  ", JavaOnlyMap(), JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, error.getString("error"))
    assertTrue(error.getString("message")?.contains("Journey id must not be empty") == true)
  }

  /**
   * Ensures non-Apple providers do not reject scheme-less redirect URI values before callback resolution.
   */
  @Test
  fun authorizeDoesNotRejectSchemeLessRedirectUriBeforeResolvingCallback() {
    CoreRuntime.journeyCallbackResolver = { emptyList() }
    val promise = TestPromise()

    RNPingExternalIdpCommon.authorizeForJourney(
      "journey-id",
      JavaOnlyMap(),
      JavaOnlyMap.of("redirectUri", "callback-without-scheme"),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, error.getString("error"))
    assertTrue(error.getString("message")?.contains("No active IdP callback") == true)
  }

  /**
   * Ensures non-Apple providers accept native social-login redirect values without URI schemes.
   */
  @Test
  fun parseRedirectUriAcceptsSchemeLessRedirectUriForGoogle() {
    val uri = parseRedirectUri("callback-without-scheme", "google")

    assertEquals("callback-without-scheme", uri?.toString())
  }

  /**
   * Ensures Apple redirect overrides still require URI schemes.
   */
  @Test
  fun parseRedirectUriRejectsSchemeLessRedirectUriForApple() {
    val error = runCatching {
      parseRedirectUri("callback-without-scheme", "apple")
    }.exceptionOrNull()

    assertTrue(error is IllegalArgumentException)
    assertTrue(error?.message?.contains("URI scheme") == true)
  }

  /**
   * Ensures missing redirect values delegate to the native SDK defaults.
   */
  @Test
  fun parseRedirectUriReturnsNullForBlankRedirectUri() {
    val uri = parseRedirectUri("  ", "google")

    assertNull(uri)
  }

  /**
   * Ensures authorization rejects when no foreground activity is available.
   */
  @Test
  fun authorizeRejectsWhenActivityUnavailable() {
    RNPingExternalIdpCommon.foregroundActivityProvider = { false }
    val promise = TestPromise()

    RNPingExternalIdpCommon.authorizeForJourney(
      "journey-id",
      JavaOnlyMap(),
      JavaOnlyMap.of("redirectUri", "com.example://callback"),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ExternalIdpErrorCodes.ACTIVITY_UNAVAILABLE, promise.rejectCode)
    assertEquals(ErrorType.AUTH_ERROR.rawValue, error.getString("type"))
    assertEquals(ExternalIdpErrorCodes.ACTIVITY_UNAVAILABLE, error.getString("error"))
    assertTrue(error.getString("message")?.contains("No foreground activity") == true)
  }

  /**
   * Ensures authorization resolves callbacks through Core and rejects when none are active.
   */
  @Test
  fun authorizeRejectsWhenCallbackMissing() {
    CoreRuntime.journeyCallbackResolver = { emptyList() }
    val promise = TestPromise()

    RNPingExternalIdpCommon.authorizeForJourney(
      "journey-id",
      JavaOnlyMap.of("index", 1),
      JavaOnlyMap(),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, error.getString("error"))
    assertTrue(error.getString("message")?.contains("index 1") == true)
  }

  /**
   * Ensures selected provider rejects blank Journey ids with the shared error payload.
   */
  @Test
  fun selectProviderRejectsWhenJourneyIdIsBlank() {
    val promise = TestPromise()

    RNPingExternalIdpCommon.setSelectedProvider(" ", "google", JavaOnlyMap(), JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, error.getString("error"))
  }

  /**
   * Ensures selected provider rejects blank provider values.
   */
  @Test
  fun selectProviderRejectsWhenProviderIsBlank() {
    val promise = TestPromise()

    RNPingExternalIdpCommon.setSelectedProvider(
      "journey-id",
      "   ",
      JavaOnlyMap(),
      JavaOnlyMap(),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ExternalIdpErrorCodes.CONFIG_ERROR, promise.rejectCode)
    assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
    assertEquals(ExternalIdpErrorCodes.CONFIG_ERROR, error.getString("error"))
    assertTrue(error.getString("message")?.contains("Provider must not be empty") == true)
  }

  /**
   * Ensures selected provider resolves the requested callback by type index and trims the value.
   */
  @Test
  fun selectProviderMutatesCallbackAtRequestedIndex() {
    val first = SelectIdpCallback()
    val second = SelectIdpCallback()
    first.value = "apple"
    CoreRuntime.journeyCallbackResolver = { listOf(first, "other-callback", second) }
    val promise = TestPromise()

    RNPingExternalIdpCommon.setSelectedProvider(
      "journey-id",
      " google ",
      JavaOnlyMap.of("index", "1"),
      JavaOnlyMap(),
      promise
    )

    assertTrue(promise.await())
    assertNull(promise.resolvedValue)
    assertNull(promise.rejectCode)
    assertEquals("apple", first.value)
    assertEquals("google", second.value)
  }

  /**
   * Ensures selected provider rejects when no matching SelectIdpCallback exists.
   */
  @Test
  fun selectProviderRejectsWhenCallbackMissing() {
    CoreRuntime.journeyCallbackResolver = { listOf("other-callback") }
    val promise = TestPromise()

    RNPingExternalIdpCommon.setSelectedProvider(
      "journey-id",
      "google",
      JavaOnlyMap.of("index", 2),
      JavaOnlyMap(),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, error.getString("error"))
    assertTrue(error.getString("message")?.contains("index 2") == true)
  }

  /**
   * Ensures cleanup cancels in-flight coroutines launched on the shared scope so that
   * a React context teardown does not leak captured Promises or activity references.
   */
  @Test
  fun cleanupCancelsInFlightCoroutinesAndRecreatesScope() {
    val originalScope = readScope()
    val started = CompletableDeferred<Unit>()
    val job: Job = originalScope.launch {
      started.complete(Unit)
      awaitCancellation()
    }
    runBlocking { started.await() }

    invokeCleanup()

    runBlocking { job.join() }
    assertTrue(job.isCancelled)
    assertTrue(originalScope.coroutineContext[Job]?.isCancelled == true)

    val newScope = readScope()
    assertTrue(newScope !== originalScope)
    assertTrue(newScope.coroutineContext[Job]?.isActive == true)
  }

  /**
   * Waits for a promise rejection and returns its shared error payload.
   */
  private fun captureReject(promise: TestPromise): WritableMap {
    assertTrue(promise.await())
    return promise.rejectUserInfo ?: JavaOnlyMap()
  }

  /**
   * Reflectively reads the private shared coroutine scope.
   */
  private fun readScope(): CoroutineScope {
    val field = RNPingExternalIdpCommon::class.java.getDeclaredField("scope")
    field.isAccessible = true
    return field.get(RNPingExternalIdpCommon) as CoroutineScope
  }

  /**
   * Reflectively flips the private configured flag and invokes cleanup so the test
   * does not need to call configure() (which requires a ReactApplicationContext).
   */
  private fun invokeCleanup() {
    val configuredField = RNPingExternalIdpCommon::class.java.getDeclaredField("configured")
    configuredField.isAccessible = true
    configuredField.setBoolean(RNPingExternalIdpCommon, true)
    RNPingExternalIdpCommon.cleanup()
  }

  /**
   * Calls the private error discriminator for focused mapping tests.
   */
  private fun discriminateIdpError(error: Throwable): Pair<String, String> {
    val method = RNPingExternalIdpCommon::class.java.getDeclaredMethod(
      "discriminateIdpError",
      Throwable::class.java
    )
    method.isAccessible = true
    @Suppress("UNCHECKED_CAST")
    return method.invoke(RNPingExternalIdpCommon, error) as Pair<String, String>
  }

  /**
   * Calls the private redirect URI parser for focused provider-specific validation tests.
   */
  private fun parseRedirectUri(redirectUri: String, provider: String): Uri? {
    val method = RNPingExternalIdpCommon::class.java.getDeclaredMethod(
      "parseRedirectUri",
      String::class.java,
      String::class.java
    )
    method.isAccessible = true
    return try {
      method.invoke(RNPingExternalIdpCommon, redirectUri, provider) as Uri?
    } catch (e: InvocationTargetException) {
      throw e.targetException
    }
  }
}

/**
 * Test double with the same simple name as AndroidX Credential Manager's cancellation error.
 */
private class GetCredentialCancellationException(message: String) : Exception(message)

/**
 * Robolectric shadow for React Native bridge map creation.
 */
@Implements(className = "com.facebook.react.bridge.Arguments")
object ShadowExternalIdpArguments {
  /**
   * Creates a Java-only writable map for JVM unit tests.
   */
  @Implementation
  @JvmStatic
  fun createMap(): WritableMap = JavaOnlyMap()

  /**
   * Creates a Java-only writable array for JVM unit tests.
   */
  @Implementation
  @JvmStatic
  fun createArray(): WritableArray = com.facebook.react.bridge.JavaOnlyArray()
}

/**
 * Promise test double that captures bridge resolution and rejection details.
 */
private class TestPromise : Promise {
  private val latch = CountDownLatch(1)

  var resolvedValue: Any? = null
    private set
  var rejectCode: String? = null
    private set
  var rejectMessage: String? = null
    private set
  var rejectThrowable: Throwable? = null
    private set
  var rejectUserInfo: WritableMap? = null
    private set

  /**
   * Waits for the bridge call to complete.
   */
  fun await(timeoutMs: Long = 10_000): Boolean {
    return latch.await(timeoutMs, TimeUnit.MILLISECONDS)
  }

  /**
   * Captures resolved promise values.
   */
  override fun resolve(value: Any?) {
    resolvedValue = value
    latch.countDown()
  }

  /**
   * Captures code and message rejections.
   */
  override fun reject(code: String, message: String?) {
    rejectCode = code
    rejectMessage = message
    latch.countDown()
  }

  /**
   * Captures code and throwable rejections.
   */
  override fun reject(code: String, throwable: Throwable?) {
    rejectCode = code
    rejectThrowable = throwable
    latch.countDown()
  }

  /**
   * Captures code, message, and throwable rejections.
   */
  override fun reject(code: String, message: String?, throwable: Throwable?) {
    rejectCode = code
    rejectMessage = message
    rejectThrowable = throwable
    latch.countDown()
  }

  /**
   * Captures throwable-only rejections.
   */
  override fun reject(throwable: Throwable) {
    rejectThrowable = throwable
    latch.countDown()
  }

  /**
   * Captures throwable and user info rejections.
   */
  override fun reject(throwable: Throwable, userInfo: WritableMap) {
    rejectThrowable = throwable
    rejectUserInfo = userInfo
    latch.countDown()
  }

  /**
   * Captures code and user info rejections.
   */
  override fun reject(code: String, userInfo: WritableMap) {
    rejectCode = code
    rejectUserInfo = userInfo
    latch.countDown()
  }

  /**
   * Captures code, throwable, and user info rejections.
   */
  override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
    rejectCode = code
    rejectThrowable = throwable
    rejectUserInfo = userInfo
    latch.countDown()
  }

  /**
   * Captures code, message, and user info rejections.
   */
  override fun reject(code: String, message: String?, userInfo: WritableMap) {
    rejectCode = code
    rejectMessage = message
    rejectUserInfo = userInfo
    latch.countDown()
  }

  /**
   * Captures the full React Native rejection overload.
   */
  override fun reject(
    code: String?,
    message: String?,
    throwable: Throwable?,
    userInfo: WritableMap?
  ) {
    rejectCode = code
    rejectMessage = message
    rejectThrowable = throwable
    rejectUserInfo = userInfo
    latch.countDown()
  }

  /**
   * Captures message-only rejections.
   */
  @Deprecated(
    message = "Prefer passing a module-specific error code to JS.",
    replaceWith = ReplaceWith("reject(code, message)")
  )
  override fun reject(message: String) {
    rejectMessage = message
    latch.countDown()
  }
}
