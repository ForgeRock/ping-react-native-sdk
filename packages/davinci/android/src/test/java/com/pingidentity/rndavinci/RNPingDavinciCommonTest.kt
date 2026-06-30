/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.pingidentity.davinci.collector.PasswordCollector
import com.pingidentity.network.HttpRequest
import com.pingidentity.orchestrate.Action
import com.pingidentity.orchestrate.Closeable
import com.pingidentity.orchestrate.ContinueNode
import com.pingidentity.orchestrate.FlowContext
import com.pingidentity.orchestrate.SharedContext
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.registry.NativeHandle
import com.pingidentity.rndavinci.error.DaVinciErrorCodes
import com.pingidentity.orchestrate.Workflow
import com.pingidentity.orchestrate.WorkflowConfig
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
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
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29], shadows = [ShadowDaVinciCommonArguments::class])
class RNPingDavinciCommonTest {

    @Before
    fun setUp() {
        RNPingDavinciCommon.configure()
    }

    @After
    fun tearDown() {
        RNPingDavinciCommon.cleanup()
    }

    // ---- configure / cleanup ----

    @Test
    fun configureDaVinci_rejectsWhenDiscoveryEndpointMissing() {
        val config = JavaOnlyMap().apply {
            putString("clientId", "rn-client")
            putString("redirectUri", "com.example.app://oauth2redirect")
        }
        val promise = TestPromise()

        RNPingDavinciCommon.configureDaVinci(config, promise)

        val error = captureReject(promise)
        assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
        assertTrue(error.hasKey("message"))
    }

    @Test
    fun configureDaVinci_rejectsWhenClientIdMissing() {
        val config = JavaOnlyMap().apply {
            putString("discoveryEndpoint", "https://example.com/.well-known/openid-configuration")
            putString("redirectUri", "com.example.app://oauth2redirect")
        }
        val promise = TestPromise()

        RNPingDavinciCommon.configureDaVinci(config, promise)

        val error = captureReject(promise)
        assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
    }

    @Test
    fun configureDaVinci_resolvesWithDavinciIdForValidConfig() {
        val config = JavaOnlyMap().apply {
            putString("discoveryEndpoint", "https://example.com/.well-known/openid-configuration")
            putString("clientId", "rn-client")
            putString("redirectUri", "com.example.app://oauth2redirect")
        }
        val promise = TestPromise()

        RNPingDavinciCommon.configureDaVinci(config, promise)

        val davinciId = captureResolve(promise) as? String
        assertNotNull(davinciId)
        assertTrue(davinciId!!.isNotBlank())
    }

    // ---- dispose closes the active ContinueNode ----

    @Test
    fun dispose_closesActiveContinueNodeActions() {
        val davinciId = registerDaVinciHandle(Workflow(WorkflowConfig()))
        val closed = AtomicBoolean(false)
        setContinueNode(
            davinciId,
            DummyContinueNode(actions = listOf(ClosableAction(closed)))
        )

        val disposePromise = TestPromise()
        RNPingDavinciCommon.dispose(davinciId, disposePromise)
        captureResolve(disposePromise)

        assertTrue(
            "dispose() must close Closeable actions on the held ContinueNode",
            closed.get()
        )
    }

    @Test
    fun cleanup_closesActiveContinueNodeActions() {
        val davinciId = registerDaVinciHandle(Workflow(WorkflowConfig()))
        val closed = AtomicBoolean(false)
        setContinueNode(
            davinciId,
            DummyContinueNode(actions = listOf(ClosableAction(closed)))
        )

        RNPingDavinciCommon.cleanup()

        assertTrue(
            "cleanup() must close Closeable actions on every held ContinueNode",
            closed.get()
        )

        RNPingDavinciCommon.configure()
    }

    // ---- setNodeState closes the displaced ContinueNode on transition ----

    @Test
    fun setNodeState_closesDisplacedContinueNodeOnTransition() {
        val davinciId = registerDaVinciHandle(Workflow(WorkflowConfig()))
        val previousClosed = AtomicBoolean(false)
        val previousNode = DummyContinueNode(actions = listOf(ClosableAction(previousClosed)))
        setContinueNode(davinciId, previousNode)

        val nextNode = DummyContinueNode(actions = emptyList())
        invokeSetNodeState(davinciId, nextNode)

        assertTrue(
            "setNodeState() must close the displaced ContinueNode to wipe collector " +
                "buffers (e.g. PasswordCollector.value), matching iOS DaVinciStateStore.setNode.",
            previousClosed.get()
        )
    }

    // ---- next must not close current node before transitioning ----

    @Test
    fun next_doesNotCloseCurrentNodeBeforeNext() {
        val davinciId = registerDaVinciHandle(Workflow(WorkflowConfig()))
        val password = PasswordCollector().apply {
            init(buildJsonObject {
                put("key", "password-key")
                put("type", "PASSWORD")
                put("label", "Password")
            })
        }
        val capturedAtRequest = AtomicReference<String?>(null)
        val sentinel = RuntimeException("short-circuit asRequest")
        val node = object : ContinueNode(
            context = FlowContext(SharedContext(mutableMapOf())),
            workflow = Workflow(WorkflowConfig()),
            input = buildJsonObject { },
            actions = listOf(password)
        ) {
            override fun asRequest(): HttpRequest {
                capturedAtRequest.set(password.value)
                throw sentinel
            }
        }
        setContinueNode(davinciId, node)

        val nextInput = JavaOnlyMap().apply {
            putArray(
                "collectors",
                JavaOnlyArray().apply {
                    pushMap(
                        JavaOnlyMap().apply {
                            putString("key", "password-key")
                            putString("value", "hunter2")
                        }
                    )
                }
            )
        }
        val promise = TestPromise()

        RNPingDavinciCommon.next(davinciId, nextInput, promise)
        promise.await()

        assertEquals(
            "PasswordCollector.value must still be the applied input when the SDK reads it; " +
                "if this is \"\", next() closed the node before submitting (PasswordCollector.close() " +
                "wipes the value when clearPassword=true).",
            "hunter2",
            capturedAtRequest.get()
        )
    }

    // ---- start on unknown id ----

    @Test
    fun start_rejectsWithStateErrorWhenDaVinciIdUnknown() {
        val promise = TestPromise()

        RNPingDavinciCommon.start("no-such-id", promise)

        val error = captureReject(promise)
        assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
        assertEquals(DaVinciErrorCodes.STATE, error.getString("error"))
        assertTrue(error.hasKey("message"))
    }

    // ---- next on unknown id ----

    @Test
    fun next_rejectsWithStateErrorWhenNoContinueNode() {
        val promise = TestPromise()

        RNPingDavinciCommon.next("no-such-id", JavaOnlyMap(), promise)

        val error = captureReject(promise)
        assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
        assertEquals(DaVinciErrorCodes.STATE, error.getString("error"))
    }

    // ---- getSession on unknown id ----

    @Test
    fun getSession_rejectsWhenDaVinciIdUnknown() {
        val promise = TestPromise()

        RNPingDavinciCommon.getSession("no-such-id", promise)

        val error = captureReject(promise)
        assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
        assertEquals(DaVinciErrorCodes.STATE, error.getString("error"))
    }

    // ---- refresh on unknown id ----

    @Test
    fun refresh_rejectsWhenDaVinciIdUnknown() {
        val promise = TestPromise()

        RNPingDavinciCommon.refresh("no-such-id", promise)

        val error = captureReject(promise)
        assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
        assertEquals(DaVinciErrorCodes.STATE, error.getString("error"))
    }

    // ---- revoke on unknown id ----

    @Test
    fun revoke_rejectsWhenDaVinciIdUnknown() {
        val promise = TestPromise()

        RNPingDavinciCommon.revoke("no-such-id", promise)

        val error = captureReject(promise)
        assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
        assertEquals(DaVinciErrorCodes.STATE, error.getString("error"))
    }

    // ---- userinfo on unknown id ----

    @Test
    fun userinfo_rejectsWhenDaVinciIdUnknown() {
        val promise = TestPromise()

        RNPingDavinciCommon.userinfo("no-such-id", promise)

        val error = captureReject(promise)
        assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
        assertEquals(DaVinciErrorCodes.STATE, error.getString("error"))
    }

    // ---- logout on unknown id ----

    @Test
    fun logout_rejectsWhenDaVinciIdUnknown() {
        val promise = TestPromise()

        RNPingDavinciCommon.logout("no-such-id", promise)

        val error = captureReject(promise)
        assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
        assertEquals(DaVinciErrorCodes.STATE, error.getString("error"))
    }

    // ---- dispose ----

    @Test
    fun dispose_resolvesNullWhenDaVinciIdUnknown() {
        val promise = TestPromise()

        RNPingDavinciCommon.dispose("no-such-id", promise)

        assertEquals(null, captureResolve(promise))
    }

    @Test
    fun dispose_removesHandleFromRegistry() {
        val davinciId = registerDaVinciHandle(Workflow(WorkflowConfig()))
        val disposePromise = TestPromise()

        RNPingDavinciCommon.dispose(davinciId, disposePromise)
        captureResolve(disposePromise)

        val startPromise = TestPromise()
        RNPingDavinciCommon.start(davinciId, startPromise)
        val error = captureReject(startPromise)

        assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
        assertEquals(DaVinciErrorCodes.STATE, error.getString("error"))
    }

    // ---- cleanup clears davinciCollectorResolver ----

    @Test
    fun cleanup_clearsDaVinciCollectorResolver() {
        RNPingDavinciCommon.cleanup()

        assertNull(CoreRuntime.davinciCollectorResolver)

        // re-configure for @After tearDown
        RNPingDavinciCommon.configure()
    }

    // ---- helpers ----

    private fun captureResolve(promise: TestPromise): Any? {
        promise.await()
        return promise.resolvedValue
    }

    private fun captureReject(promise: TestPromise): WritableMap {
        promise.await()
        return promise.rejectUserInfo ?: JavaOnlyMap()
    }

    private fun registerDaVinciHandle(workflow: Workflow): String {
        val clazz = Class.forName("com.pingidentity.rndavinci.RNPingDavinciCommon\$DaVinciHandle")
        val ctor = clazz.getDeclaredConstructor(Workflow::class.java, String::class.java)
        ctor.isAccessible = true
        val handle = ctor.newInstance(workflow, null) as NativeHandle
        return CoreRuntime.davinciRegistry.register(handle)
    }

    private fun setContinueNode(davinciId: String, continueNode: ContinueNode) {
        val field = RNPingDavinciCommon::class.java.getDeclaredField("continueNodeMap")
        field.isAccessible = true
        @Suppress("UNCHECKED_CAST")
        val map = field.get(RNPingDavinciCommon) as MutableMap<String, ContinueNode>
        map[davinciId] = continueNode
    }

    private fun invokeSetNodeState(davinciId: String, node: com.pingidentity.orchestrate.Node) {
        val method = RNPingDavinciCommon::class.java.getDeclaredMethod(
            "setNodeState",
            String::class.java,
            com.pingidentity.orchestrate.Node::class.java
        )
        method.isAccessible = true
        method.invoke(RNPingDavinciCommon, davinciId, node)
    }
}

private class DummyContinueNode(actions: List<Action>) : ContinueNode(
    context = FlowContext(SharedContext(mutableMapOf())),
    workflow = Workflow(WorkflowConfig()),
    input = buildJsonObject { },
    actions = actions
) {
    override fun asRequest(): HttpRequest = throw UnsupportedOperationException()
}

private class ClosableAction(private val closedFlag: AtomicBoolean) : Action, Closeable {
    override fun close() {
        closedFlag.set(true)
    }
}

@Implements(className = "com.facebook.react.bridge.Arguments")
object ShadowDaVinciCommonArguments {
    @Implementation
    @JvmStatic
    fun createMap(): WritableMap = JavaOnlyMap()

    @Implementation
    @JvmStatic
    fun createArray(): WritableArray = JavaOnlyArray()
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
        message = "Prefer passing a module-specific error code",
        replaceWith = ReplaceWith("reject(code, message)")
    )
    override fun reject(message: String) {
        rejectMessage = message
        latch.countDown()
    }

    fun await(timeoutMs: Long = 10_000) {
        if (!latch.await(timeoutMs, TimeUnit.MILLISECONDS)) {
            throw AssertionError("Promise did not settle within ${timeoutMs}ms")
        }
    }
}
