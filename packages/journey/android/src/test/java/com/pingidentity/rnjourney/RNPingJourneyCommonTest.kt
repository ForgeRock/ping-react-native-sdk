/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.pingidentity.journey.callback.NameCallback
import com.pingidentity.journey.plugin.Callback
import com.pingidentity.oidc.OidcError
import com.pingidentity.oidc.User
import com.pingidentity.orchestrate.Action
import com.pingidentity.orchestrate.ContinueNode
import com.pingidentity.orchestrate.FailureNode
import com.pingidentity.orchestrate.FlowContext
import com.pingidentity.orchestrate.Node
import com.pingidentity.orchestrate.SharedContext
import com.pingidentity.orchestrate.Workflow
import com.pingidentity.orchestrate.WorkflowConfig
import com.pingidentity.utils.Result
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.registry.NativeHandle
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.network.HttpRequest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import org.junit.After
import org.junit.Assert.assertEquals
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

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29], shadows = [ShadowJourneyCommonArguments::class])
class RNPingJourneyCommonTest {

  @Before
  fun setUp() {
    // The production mapper constructs native-backed bridge maps, which cannot
    // initialize in the Robolectric sandbox; resolve-path tests use the pure
    // Kotlin payload mapper wrapped in a JavaOnlyMap instead.
    RNPingJourneyCommon.mapNodeForBridge = { node, logger ->
      val map = JavaOnlyMap()
      JourneyNodeMapper.mapNodePayload(node, logger).forEach { (key, value) ->
        when (value) {
          null -> map.putNull(key)
          is Boolean -> map.putBoolean(key, value)
          is Int -> map.putInt(key, value)
          is Double -> map.putDouble(key, value)
          is String -> map.putString(key, value)
          else -> map.putString(key, value.toString())
        }
      }
      map
    }
    RNPingJourneyCommon.configure()
  }

  @After
  fun tearDown() {
    RNPingJourneyCommon.cleanup()
  }

  @Test
  fun configureJourney_rejectsWhenServerUrlMissing() {
    val promise = TestPromise()

    RNPingJourneyCommon.configureJourney(JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.CONFIG, error.getString("error"))
    assertTrue(error.hasKey("message"))
  }

  @Test
  fun start_rejectsWhenJourneyMissing() {
    val promise = TestPromise()

    RNPingJourneyCommon.start("missing", "Login", null, promise)

    val error = captureReject(promise)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.STATE, error.getString("error"))
    assertTrue(error.hasKey("message"))
  }

  @Test
  fun next_rejectsWhenContinueNodeMissing() {
    val promise = TestPromise()

    RNPingJourneyCommon.next("missing", JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.STATE, error.getString("error"))
    assertTrue(error.hasKey("message"))
  }

  @Test
  fun resume_rejectsWhenUriIsBlank() {
    val workflow = Workflow(WorkflowConfig())
    val journeyId = registerWorkflow(workflow)
    val promise = TestPromise()

    RNPingJourneyCommon.resume(journeyId, "   ", promise)

    val error = captureReject(promise)
    assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.RESUME, error.getString("error"))
  }

  @Test
  fun startBackchannel_rejectsWhenJourneyMissing() {
    val promise = TestPromise()

    RNPingJourneyCommon.startBackchannel(
      "missing",
      backchannelUri(),
      null,
      promise
    )

    val error = captureReject(promise)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.STATE, error.getString("error"))
  }

  @Test
  fun startBackchannel_rejectsWhenUriIsBlank() {
    val workflow = Workflow(WorkflowConfig())
    val journeyId = registerWorkflow(workflow)
    val promise = TestPromise()

    RNPingJourneyCommon.startBackchannel(journeyId, "   ", null, promise)

    val error = captureReject(promise)
    assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.START, error.getString("error"))
  }

  @Test
  fun startBackchannel_resolvesFailureNodeWhenConfigMissing() {
    val workflow = Workflow(WorkflowConfig())
    val journeyId = registerWorkflow(workflow)
    val promise = TestPromise()

    RNPingJourneyCommon.startBackchannel(journeyId, backchannelUri(), null, promise)

    promise.await()
    assertEquals(null, promise.rejectCode)
    val node = checkNotNull(capturedNode(journeyId) as? FailureNode) {
      "Expected FailureNode, got ${capturedNode(journeyId)}"
    }
    // Native start(backchannelUri:) reports a bare WorkflowConfig as
    // "JourneyConfig missing" (config as? JourneyConfig == null).
    assertTrue(node.cause.message?.contains("JourneyConfig") == true)
  }

  @Test
  fun startBackchannel_resolvesFailureNodeWhenServerUrlUnset() {
    // JourneyConfig with serverUrl never assigned: the lateinit read inside
    // native start(backchannelUri:) surfaces its "serverUrl" failure message.
    val journeyId = registerWorkflow(Workflow(com.pingidentity.journey.JourneyConfig()))
    val promise = TestPromise()

    RNPingJourneyCommon.startBackchannel(journeyId, backchannelUri(), null, promise)

    promise.await()
    assertEquals(null, promise.rejectCode)
    val node = checkNotNull(capturedNode(journeyId) as? FailureNode) {
      "Expected FailureNode, got ${capturedNode(journeyId)}"
    }
    assertTrue(node.cause.message?.contains("serverUrl") == true)
  }

  @Test
  fun startBackchannel_resolvesFailureNodeWhenHostMismatch() {
    val workflow = Workflow(journeyConfig(serverUrl = "https://tenant.example.com"))
    val journeyId = registerWorkflow(workflow)
    val promise = TestPromise()

    RNPingJourneyCommon.startBackchannel(
      journeyId,
      backchannelUri(host = "evil.example.com"),
      null,
      promise
    )

    promise.await()
    val node = checkNotNull(capturedNode(journeyId) as? FailureNode) {
      "Expected FailureNode, got ${capturedNode(journeyId)}"
    }
    assertTrue(node.cause.message?.contains("does not match") == true)
  }

  @Test
  fun startBackchannel_resolvesFailureNodeWhenAuthIndexParamsMissing() {
    val workflow = Workflow(journeyConfig(serverUrl = "https://tenant.example.com"))
    val journeyId = registerWorkflow(workflow)
    val promise = TestPromise()

    RNPingJourneyCommon.startBackchannel(
      journeyId,
      backchannelUri(withParams = false),
      null,
      promise
    )

    promise.await()
    val node = checkNotNull(capturedNode(journeyId) as? FailureNode) {
      "Expected FailureNode, got ${capturedNode(journeyId)}"
    }
    // Native message (SDKS-5157): "Missing authIndexType or authIndexValue".
    assertTrue(node.cause.message?.contains("authIndex") == true)
  }

  @Test
  fun startBackchannel_resolvesFailureNodeWhenParamsWhitespaceOnly() {
    val workflow = Workflow(journeyConfig(serverUrl = "https://tenant.example.com"))
    val journeyId = registerWorkflow(workflow)
    val promise = TestPromise()

    RNPingJourneyCommon.startBackchannel(
      journeyId,
      backchannelUri(authIndexValue = "%20%20"),
      null,
      promise
    )

    promise.await()
    val node = checkNotNull(capturedNode(journeyId) as? FailureNode) {
      "Expected FailureNode, got ${capturedNode(journeyId)}"
    }
    assertTrue(node.cause.message?.contains("authIndex") == true)
  }

  @Test
  fun startBackchannel_resolvesFailureNodeWhenUriNotHierarchical() {
    val workflow = Workflow(journeyConfig(serverUrl = "https://tenant.example.com"))
    val journeyId = registerWorkflow(workflow)
    val promise = TestPromise()

    RNPingJourneyCommon.startBackchannel(
      journeyId,
      "mailto:transaction-only-opaque",
      null,
      promise
    )

    promise.await()
    val node = checkNotNull(capturedNode(journeyId) as? FailureNode) {
      "Expected FailureNode, got ${capturedNode(journeyId)}"
    }
    assertTrue(node.cause.message?.contains("hierarchical") == true)
  }

  @Test
  fun startBackchannel_doesNotRejectValidationFailures() {
    val workflow = Workflow(journeyConfig(serverUrl = "https://tenant.example.com"))
    val journeyId = registerWorkflow(workflow)
    val promise = TestPromise()

    RNPingJourneyCommon.startBackchannel(
      journeyId,
      backchannelUri(host = "evil.example.com"),
      null,
      promise
    )

    promise.await()
    assertEquals(null, promise.rejectThrowable)
    assertEquals(null, promise.rejectCode)
    assertTrue(capturedNode(journeyId) is FailureNode)
  }

  private fun journeyConfig(serverUrl: String?): com.pingidentity.journey.JourneyConfig {
    return com.pingidentity.journey.JourneyConfig().apply { this.serverUrl = serverUrl ?: "" }
  }

  private fun backchannelUri(
    host: String = "tenant.example.com",
    withParams: Boolean = true,
    authIndexValue: String = "tx-abc-123",
  ): String {
    val base = "https://$host/am/UI/Login?realm=%2Falpha"
    if (!withParams) {
      return base
    }
    return "$base&authIndexType=transaction&authIndexValue=$authIndexValue"
  }

  @Test
  fun next_rejectsMissingIntegrationError() {
    val journeyId = "integration-case"
    setContinueNode(
      journeyId,
      DummyContinueNode(actions = listOf(DeviceProfileCallback()))
    )
    val promise = TestPromise()

    RNPingJourneyCommon.next(
      journeyId,
      callbackInput(type = "DeviceProfileCallback", value = "payload"),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.MISSING_INTEGRATION, error.getString("error"))
    assertTrue(error.getString("message")?.contains("additional native integration") == true)
  }

  @Test
  fun next_rejectsUnsupportedCallbackError() {
    val journeyId = "unsupported-case"
    setContinueNode(
      journeyId,
      DummyContinueNode(actions = listOf(UnsupportedCustomCallback()))
    )
    val promise = TestPromise()

    RNPingJourneyCommon.next(
      journeyId,
      callbackInput(type = "UnsupportedCustomCallback", value = "payload"),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.UNSUPPORTED_CALLBACK, error.getString("error"))
    assertTrue(error.getString("message")?.contains("not supported for value mutation") == true)
  }

  @Test
  fun next_rejectsCallbackApplyError() {
    val journeyId = "callback-apply-case"
    setContinueNode(
      journeyId,
      DummyContinueNode(actions = listOf(NameCallback()))
    )
    val promise = TestPromise()

    RNPingJourneyCommon.next(
      journeyId,
      callbackInput(type = "NameCallback", value = JavaOnlyMap.of("nested", "value")),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.CALLBACK_APPLY, error.getString("error"))
    assertTrue(error.getString("message")?.contains("expects a string-compatible value") == true)
  }

  @Test
  fun getSession_rejectsAuthErrorWhenTokenFails() {
    val workflow = Workflow(WorkflowConfig())
    workflow.sharedContext["com.pingidentity.journey.User"] = object : User {
      override suspend fun token(): Result<com.pingidentity.oidc.Token, OidcError> {
        return Result.Failure(OidcError.NetworkError(Exception("offline")))
      }
      override suspend fun revoke() = Unit
      override suspend fun refresh(): Result<com.pingidentity.oidc.Token, OidcError> {
        return Result.Failure(OidcError.Unknown(Exception("unused")))
      }
      override suspend fun userinfo(cache: Boolean): Result<JsonObject, OidcError> {
        return Result.Failure(OidcError.Unknown(Exception("unused")))
      }
      override suspend fun logout() = Unit
    }

    val journeyId = registerWorkflow(workflow)
    val promise = TestPromise()
    RNPingJourneyCommon.getSession(journeyId, promise)

    val error = captureReject(promise)
    assertEquals(ErrorType.AUTH_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.USER, error.getString("error"))
  }

  @Test
  fun refresh_rejectsAuthErrorWhenRefreshFails() {
    val workflow = Workflow(WorkflowConfig())
    workflow.sharedContext["com.pingidentity.journey.User"] = object : User {
      override suspend fun token(): Result<com.pingidentity.oidc.Token, OidcError> {
        return Result.Failure(OidcError.Unknown(Exception("unused")))
      }
      override suspend fun revoke() = Unit
      override suspend fun refresh(): Result<com.pingidentity.oidc.Token, OidcError> {
        return Result.Failure(OidcError.NetworkError(Exception("offline")))
      }
      override suspend fun userinfo(cache: Boolean): Result<JsonObject, OidcError> {
        return Result.Failure(OidcError.Unknown(Exception("unused")))
      }
      override suspend fun logout() = Unit
    }

    val journeyId = registerWorkflow(workflow)
    val promise = TestPromise()
    RNPingJourneyCommon.refresh(journeyId, promise)

    val error = captureReject(promise)
    assertEquals(ErrorType.AUTH_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.USER, error.getString("error"))
  }

  @Test
  fun userinfo_rejectsAuthErrorWhenUserinfoFails() {
    val workflow = Workflow(WorkflowConfig())
    workflow.sharedContext["com.pingidentity.journey.User"] = object : User {
      override suspend fun token(): Result<com.pingidentity.oidc.Token, OidcError> {
        return Result.Failure(OidcError.Unknown(Exception("unused")))
      }
      override suspend fun revoke() = Unit
      override suspend fun refresh(): Result<com.pingidentity.oidc.Token, OidcError> {
        return Result.Failure(OidcError.Unknown(Exception("unused")))
      }
      override suspend fun userinfo(cache: Boolean): Result<JsonObject, OidcError> {
        return Result.Failure(OidcError.NetworkError(Exception("offline")))
      }
      override suspend fun logout() = Unit
    }

    val journeyId = registerWorkflow(workflow)
    val promise = TestPromise()
    RNPingJourneyCommon.userinfo(journeyId, promise)

    val error = captureReject(promise)
    assertEquals(ErrorType.AUTH_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.USER, error.getString("error"))
  }

  @Test
  fun getSession_rejectsWhenJourneyMissing() {
    val promise = TestPromise()

    RNPingJourneyCommon.getSession("missing", promise)

    val error = captureReject(promise)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.STATE, error.getString("error"))
    assertTrue(error.hasKey("message"))
  }

  @Test
  fun revoke_rejectsWhenJourneyMissing() {
    val promise = TestPromise()

    RNPingJourneyCommon.revoke("missing", promise)

    val error = captureReject(promise)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.STATE, error.getString("error"))
    assertTrue(error.hasKey("message"))
  }

  @Test
  fun logout_rejectsWhenJourneyMissing() {
    val promise = TestPromise()

    RNPingJourneyCommon.logout("missing", promise)

    val error = captureReject(promise)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.STATE, error.getString("error"))
    assertTrue(error.hasKey("message"))
  }

  @Test
  fun ssoToken_rejectsWhenJourneyMissing() {
    val promise = TestPromise()

    RNPingJourneyCommon.ssoToken("missing", promise)

    val error = captureReject(promise)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.STATE, error.getString("error"))
    assertTrue(error.hasKey("message"))
  }

  @Test
  fun dispose_resolvesNullWhenJourneyMissing() {
    val promise = TestPromise()

    RNPingJourneyCommon.dispose("missing", promise)

    val resolved = captureResolve(promise)
    assertEquals(null, resolved)
  }

  @Test
  fun dispose_removesJourneyFromRegistry() {
    val workflow = Workflow(WorkflowConfig())
    val journeyId = registerWorkflow(workflow)
    val disposePromise = TestPromise()

    RNPingJourneyCommon.dispose(journeyId, disposePromise)
    captureResolve(disposePromise)

    val startPromise = TestPromise()
    RNPingJourneyCommon.start(journeyId, "Login", null, startPromise)

    val error = captureReject(startPromise)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(JourneyErrorCodes.STATE, error.getString("error"))
  }

  private fun captureResolve(promise: TestPromise): Any? {
    promise.await()
    return promise.resolvedValue
  }

  private fun captureReject(promise: TestPromise): WritableMap {
    promise.await()
    return promise.rejectUserInfo ?: JavaOnlyMap()
  }

  private fun callbackInput(type: String, value: Any?): ReadableMap {
    val callback = JavaOnlyMap.of("type", type, "value", value)
    return JavaOnlyMap.of("callbacks", JavaOnlyArray.of(callback))
  }

  private fun setContinueNode(journeyId: String, continueNode: ContinueNode) {
    val field = RNPingJourneyCommon::class.java.getDeclaredField("continueNodeMap")
    field.isAccessible = true
    @Suppress("UNCHECKED_CAST")
    val map = field.get(RNPingJourneyCommon) as MutableMap<String, ContinueNode>
    map[journeyId] = continueNode
  }

  /** Reads the bridge's stored node state for assertions without native maps. */
  private fun capturedNode(journeyId: String): Node? {
    val field = RNPingJourneyCommon::class.java.getDeclaredField("nodeMap")
    field.isAccessible = true
    @Suppress("UNCHECKED_CAST")
    val map = field.get(RNPingJourneyCommon) as MutableMap<String, Node>
    return map[journeyId]
  }

  private fun registerWorkflow(workflow: Workflow): String {
    val clazz = Class.forName("com.pingidentity.rnjourney.RNPingJourneyCommon\$JourneyHandle")
    val ctor = clazz.getDeclaredConstructor(Workflow::class.java, String::class.java)
    ctor.isAccessible = true
    val handle = ctor.newInstance(workflow, null) as NativeHandle
    return CoreRuntime.journeyRegistry.register(handle)
  }
}

@Implements(className = "com.facebook.react.bridge.Arguments")
object ShadowJourneyCommonArguments {
  @Implementation
  @JvmStatic
  fun createMap(): WritableMap = JavaOnlyMap()

  @Implementation
  @JvmStatic
  fun createArray(): WritableArray = com.facebook.react.bridge.JavaOnlyArray()
}

private class TestPromise : Promise {
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

private open class BaseCallback : Callback {
  override fun init(jsonObject: JsonObject): Callback = this
  override fun payload(): JsonObject = buildJsonObject { }
}

private class UnsupportedCustomCallback : BaseCallback()


private class DeviceProfileCallback : BaseCallback()

private class DummyContinueNode(
  actions: List<Action>
) : ContinueNode(
  context = FlowContext(SharedContext(mutableMapOf())),
  workflow = Workflow(WorkflowConfig()),
  input = buildJsonObject { },
  actions = actions
) {
  override fun asRequest(): HttpRequest {
    throw UnsupportedOperationException("DummyContinueNode.asRequest should not be called in this test")
  }
}


