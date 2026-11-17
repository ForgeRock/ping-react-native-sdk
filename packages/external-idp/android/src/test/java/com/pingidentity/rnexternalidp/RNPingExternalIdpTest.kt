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
import com.pingidentity.idp.IdpCanceledException
import com.pingidentity.idp.IdpClient
import com.pingidentity.idp.IdpHandler
import com.pingidentity.idp.IdpResult
import com.pingidentity.idp.journey.IdpCallback
import com.pingidentity.idp.journey.SelectIdpCallback
import com.pingidentity.network.HttpClient
import com.pingidentity.network.HttpRequest
import com.pingidentity.network.HttpResponse
import com.pingidentity.orchestrate.Workflow
import com.pingidentity.orchestrate.WorkflowConfig
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.DaVinciCollectorResolver
import com.pingidentity.rncore.JourneyCallbackResolver
import com.pingidentity.rncore.error.ErrorType
import java.lang.reflect.InvocationTargetException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
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
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29], shadows = [ShadowExternalIdpArguments::class])
class RNPingExternalIdpTest {
  private var originalJourneyCallbackResolver: JourneyCallbackResolver? = null
  private var originalDaVinciCollectorResolver: DaVinciCollectorResolver? = null

  /**
   * Configure bridge test seams before each test.
   */
  @Before
  fun setUp() {
    Dispatchers.setMain(UnconfinedTestDispatcher())
    originalJourneyCallbackResolver = CoreRuntime.journeyCallbackResolver
    originalDaVinciCollectorResolver = CoreRuntime.davinciCollectorResolver
    CoreRuntime.journeyCallbackResolver = null
    CoreRuntime.davinciCollectorResolver = null
    RNPingExternalIdpCommon.foregroundActivityProvider = { true }
    IdpHandlerRegistry.clear()
  }

  /**
   * Restore global bridge state after each test.
   */
  @After
  fun tearDown() {
    CoreRuntime.journeyCallbackResolver = originalJourneyCallbackResolver
    CoreRuntime.davinciCollectorResolver = originalDaVinciCollectorResolver
    RNPingExternalIdpCommon.foregroundActivityProvider = { true }
    IdpHandlerRegistry.clear()
    Dispatchers.resetMain()
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
   * Ensures the SDK's public IdP cancellation exception maps to the public cancellation
   * code, the convention custom handlers follow when the user cancels a provider login.
   */
  @Test
  fun idpCanceledExceptionMapsToCancelled() {
    val result = discriminateIdpError(IdpCanceledException())

    assertEquals(ExternalIdpErrorCodes.CANCELLED, result.first)
    assertEquals("Identity Provider authentication was canceled", result.second)
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
   * Ensures a registered custom handler routes the authorize call and the callback
   * captures the returned token, exercising the public registration entry point.
   */
  @Test
  fun registeredHandlerRoutesAuthorizeAndCapturesToken() {
    val callback = idpCallback("line")
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    val handler = RecordingIdpHandler()
    RNPingExternalIdpCommon.registerIdpHandler("line", handler)
    val promise = TestPromise()

    RNPingExternalIdpCommon.authorizeForJourney(
      "journey-id",
      JavaOnlyMap(),
      JavaOnlyMap(),
      promise
    )

    val resolved = captureResolve(promise)
    assertEquals("custom-token", resolved?.getString("token"))
    assertEquals(1, handler.observedClients.size)
    // No JS redirect configured: the handler observes the callback's server value.
    assertEquals(
      "https://server.example.com/form_post/line",
      handler.observedClients.single().redirectUri
    )
    val payload = callback.payload()
    assertEquals(
      "custom-token",
      payload["input"]?.jsonArray?.get(0)?.jsonObject?.get("value")?.jsonPrimitive?.content
    )
  }

  /**
   * Ensures a JS-configured redirect URI reaches the custom handler in place of the
   * callback's server-supplied value, proving the redirect-overriding decorator is
   * wired into the authorize path.
   */
  @Test
  fun registeredHandlerObservesConfiguredRedirectUriOverServerValue() {
    val callback = idpCallback("line")
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    val handler = RecordingIdpHandler()
    RNPingExternalIdpCommon.registerIdpHandler("line", handler)
    val promise = TestPromise()

    RNPingExternalIdpCommon.authorizeForJourney(
      "journey-id",
      JavaOnlyMap(),
      JavaOnlyMap.of("redirectUri", "com.example://callback"),
      promise
    )

    captureResolve(promise)
    assertEquals("com.example://callback", handler.observedClients.single().redirectUri)
  }

  /**
   * Ensures an unregistered custom provider falls through to the native built-in
   * resolution and fails with the existing unsupported-provider error, code and message
   * unchanged.
   */
  @Test
  fun unregisteredCustomProviderFailsWithExistingUnsupportedProviderError() {
    val callback = idpCallback("twitter")
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    val promise = TestPromise()

    RNPingExternalIdpCommon.authorizeForJourney(
      "journey-id",
      JavaOnlyMap(),
      JavaOnlyMap(),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ExternalIdpErrorCodes.CONFIG_ERROR, promise.rejectCode)
    assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
    assertEquals(ExternalIdpErrorCodes.CONFIG_ERROR, error.getString("error"))
    assertTrue(
      error.getString("message")?.contains("Unsupported provider: twitter") == true
    )
  }

  /**
   * Ensures the callback's nonce reaches the custom handler's IdpClient payload.
   */
  @Test
  fun registeredHandlerReceivesCallbackNonce() {
    val callback = idpCallback("line", nonce = "test-nonce-123")
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    val handler = RecordingIdpHandler()
    RNPingExternalIdpCommon.registerIdpHandler("line", handler)
    val promise = TestPromise()

    RNPingExternalIdpCommon.authorizeForJourney(
      "journey-id",
      JavaOnlyMap(),
      JavaOnlyMap(),
      promise
    )

    captureResolve(promise)
    assertEquals("test-nonce-123", handler.observedClients.single().nonce)
  }

  /**
   * Ensures the handler's token type propagates to the callback payload through the
   * redirect-overriding decorator's delegation.
   */
  @Test
  fun handlerTokenTypePropagatesThroughDecorator() {
    val callback = idpCallback("line")
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    val handler = RecordingIdpHandler()
    RNPingExternalIdpCommon.registerIdpHandler("line", handler)
    val promise = TestPromise()

    RNPingExternalIdpCommon.authorizeForJourney(
      "journey-id",
      JavaOnlyMap(),
      JavaOnlyMap.of("redirectUri", "com.example://callback"),
      promise
    )

    captureResolve(promise)
    val payload = callback.payload()
    assertEquals(
      "access_token",
      payload["input"]?.jsonArray?.get(1)?.jsonObject?.get("value")?.jsonPrimitive?.content
    )
  }

  /**
   * Ensures a throwing custom handler surfaces as the authorize error code while the
   * native callback's catch block can log against the parent journey.
   */
  @Test
  fun throwingHandlerSurfacesAsAuthorizeError() {
    val callback = idpCallback("line")
    callback.journey = workflowWithPresetHttpClient()
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    RNPingExternalIdpCommon.registerIdpHandler("line", ThrowingIdpHandler())
    val promise = TestPromise()

    RNPingExternalIdpCommon.authorizeForJourney(
      "journey-id",
      JavaOnlyMap(),
      JavaOnlyMap(),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ExternalIdpErrorCodes.AUTHORIZE_ERROR, promise.rejectCode)
    assertEquals(ErrorType.INTERNAL_ERROR.rawValue, error.getString("type"))
    assertEquals(ExternalIdpErrorCodes.AUTHORIZE_ERROR, error.getString("error"))
    assertTrue(promise.rejectThrowable is IllegalStateException)
  }

  /**
   * Ensures DaVinci authorization rejects blank davinciId with the shared error payload.
   */
  @Test
  fun authorizeForDaVinciRejectsWhenDaVinciIdIsBlank() {
    val promise = TestPromise()

    RNPingExternalIdpCommon.authorizeForDaVinci("  ", JavaOnlyMap(), JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, error.getString("error"))
    assertTrue(error.getString("message")?.contains("DaVinci id must not be empty") == true)
  }

  /**
   * Ensures DaVinci authorization rejects when no foreground activity is available.
   */
  @Test
  fun authorizeForDaVinciRejectsWhenActivityUnavailable() {
    RNPingExternalIdpCommon.foregroundActivityProvider = { false }
    val promise = TestPromise()

    RNPingExternalIdpCommon.authorizeForDaVinci(
      "davinci-id",
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
   * Ensures DaVinci authorization rejects when no collector is registered in CoreRuntime.
   */
  @Test
  fun authorizeForDaVinciRejectsWhenNoDaVinciCollectorRegistered() {
    CoreRuntime.davinciCollectorResolver = { emptyList() }
    val promise = TestPromise()

    RNPingExternalIdpCommon.authorizeForDaVinci(
      "davinci-id",
      JavaOnlyMap(),
      JavaOnlyMap(),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(ExternalIdpErrorCodes.CALLBACK_NOT_FOUND, error.getString("error"))
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
   * Waits for a promise resolution and returns the resolved value.
   */
  private fun captureResolve(promise: TestPromise): WritableMap? {
    assertTrue(promise.await())
    return promise.resolvedValue as? WritableMap
  }

  /**
   * Builds an IdpCallback initialized from a server-style output payload.
   */
  private fun idpCallback(
    provider: String,
    nonce: String = "default-nonce"
  ): IdpCallback {
    val callback = IdpCallback()
    callback.init(idpCallbackJson(provider, nonce))
    return callback
  }

  /**
   * Builds a real workflow whose HTTP client is pre-set so no network engine is
   * constructed; only the callback's error-logging path reads this journey.
   */
  private fun workflowWithPresetHttpClient(): Workflow {
    val config = WorkflowConfig()
    config.httpClient = UnreachableHttpClient
    return Workflow(config)
  }

  /**
   * Reflectively reads the private shared coroutine scope.
   */
  private fun readScope(): CoroutineScope = CommonTestSeams.readScope()

  /**
   * Reflectively flips the private configured flag and invokes cleanup so the test
   * does not need to call configure() (which requires a ReactApplicationContext).
   */
  private fun invokeCleanup() = CommonTestSeams.invokeCleanup()

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
 * HTTP client fake that satisfies WorkflowConfig's lateinit requirement without
 * constructing a network engine; never invoked by the authorize error path.
 */
private object UnreachableHttpClient : HttpClient {
  override fun request(): HttpRequest = throw UnsupportedOperationException("not used")
  override suspend fun request(request: HttpRequest): HttpResponse =
    throw UnsupportedOperationException("not used")
  override suspend fun request(requestBuilder: HttpRequest.() -> Unit): HttpResponse =
    throw UnsupportedOperationException("not used")
  override fun close() {}
}

/**
 * Builds the JSON payload an AIC server would deliver for an IdP callback.
 */
private fun idpCallbackJson(provider: String, nonce: String): JsonObject =
  buildJsonObject {
    putJsonArray("output") {
      addJsonObject {
        put("name", JsonPrimitive("provider"))
        put("value", JsonPrimitive(provider))
      }
      addJsonObject {
        put("name", JsonPrimitive("clientId"))
        put("value", JsonPrimitive("test-client"))
      }
      addJsonObject {
        put("name", JsonPrimitive("redirectUri"))
        put("value", JsonPrimitive("https://server.example.com/form_post/$provider"))
      }
      addJsonObject {
        put("name", JsonPrimitive("scopes"))
        putJsonArray("value") {
          add(JsonPrimitive("openid"))
        }
      }
      addJsonObject {
        put("name", JsonPrimitive("nonce"))
        put("value", JsonPrimitive(nonce))
      }
    }
    put("input", buildJsonArray {
      add(
        buildJsonObject {
          put("name", JsonPrimitive("IDToken1token"))
          put("value", JsonPrimitive(""))
        }
      )
      add(
        buildJsonObject {
          put("name", JsonPrimitive("IDToken1tokenType"))
          put("value", JsonPrimitive(""))
        }
      )
    })
  }

/**
 * Recording handler double that captures every observed IdpClient payload.
 *
 * authorize() flips the token type mid-flight so the decorator's delegation is observable
 * in the callback payload.
 */
private class RecordingIdpHandler : IdpHandler {
  override var tokenType: String = "id_token"

  val observedClients = mutableListOf<IdpClient>()

  override suspend fun authorize(idpClient: IdpClient): IdpResult {
    observedClients.add(idpClient)
    tokenType = "access_token"
    return IdpResult("custom-token", emptyMap())
  }
}

/**
 * Handler double that always fails, driving the native callback's error path.
 */
private class ThrowingIdpHandler : IdpHandler {
  override var tokenType: String = "id_token"

  override suspend fun authorize(idpClient: IdpClient): IdpResult {
    throw IllegalStateException("Provider login failed")
  }
}

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
