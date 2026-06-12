/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rncore.utils

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.soloader.SoLoader
import com.facebook.soloader.nativeloader.NativeLoader
import com.facebook.soloader.nativeloader.SystemDelegate
import com.pingidentity.rncore.error.ErrorType
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements

/**
 * Unit tests for the [launchBridge] coroutine extension.
 *
 * Tests use [Dispatchers.Unconfined] for the coroutine scope so that the launched
 * coroutine runs eagerly on the calling thread — the same thread Robolectric uses
 * to shadow React Native's [WritableNativeMap]. This avoids the JNI initialisation
 * failure that occurs when [Arguments.createMap] is called from a background thread
 * that is outside Robolectric's sandbox.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29], manifest = Config.NONE, shadows = [ShadowRnCoreArguments::class])
class CoroutineBridgeTest {

    @Before
    fun setUp() {
        runCatching { SoLoader.init(RuntimeEnvironment.getApplication(), false) }
        runCatching { NativeLoader.init(SystemDelegate()) }
    }

    // ---------------------------------------------------------------------------
    // Test helpers
    // ---------------------------------------------------------------------------

    /**
     * Minimal [Promise] implementation that captures rejection arguments and
     * signals a latch so tests can synchronise against async bridge calls.
     */
    private class TestPromise : Promise {
        private val latch = CountDownLatch(1)

        var rejectedCode: String? = null
            private set
        var rejectedMessage: String? = null
            private set
        var rejectedThrowable: Throwable? = null
            private set
        var rejectedUserInfo: WritableMap? = null
            private set
        var resolved: Boolean = false
            private set

        fun await(timeoutMs: Long = 2_000): Boolean =
            latch.await(timeoutMs, TimeUnit.MILLISECONDS)

        override fun resolve(value: Any?) {
            resolved = true
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
            rejectedUserInfo = userInfo
            latch.countDown()
        }

        @Suppress("DEPRECATION")
        override fun reject(message: String) {
            rejectedMessage = message
            latch.countDown()
        }
    }

    // ---------------------------------------------------------------------------
    // CancellationException behaviour
    // ---------------------------------------------------------------------------

    /**
     * When the block throws [CancellationException], [launchBridge] re-throws it
     * so that structured-concurrency propagation is correct, and the promise is
     * never settled.
     */
    @Test
    fun cancellationExceptionIsRethrownAndPromiseNotSettled() {
        val promise = TestPromise()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)

        val job = scope.launchBridge(promise, "TEST_ERROR") {
            throw CancellationException("test cancellation")
        }

        // The coroutine ran eagerly (Unconfined); join ensures it is done.
        runBlocking { job.join() }

        assertFalse("Promise must not be settled when CancellationException is thrown", promise.await(timeoutMs = 100))
        assertNull("rejectedCode must be null", promise.rejectedCode)
        assertFalse("resolved must be false", promise.resolved)
    }

    // ---------------------------------------------------------------------------
    // Throwable → promise rejection
    // ---------------------------------------------------------------------------

    /**
     * [IllegalArgumentException] must produce [ErrorType.ARGUMENT_ERROR] in the
     * rejected [GenericError].
     */
    @Test
    fun illegalArgumentExceptionRejectsWithArgumentError() {
        val promise = TestPromise()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val errorCode = "TEST_ERROR"
        val cause = IllegalArgumentException("bad argument")

        val job = scope.launchBridge(promise, errorCode) { throw cause }
        runBlocking { job.join() }

        assertTrue("Promise must be settled", promise.await(timeoutMs = 100))
        assertEquals(errorCode, promise.rejectedCode)
        assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, promise.rejectedUserInfo?.getString("type"))
        assertEquals(cause, promise.rejectedThrowable)
    }

    /**
     * [IOException] must produce [ErrorType.NETWORK_ERROR] in the rejected
     * [GenericError].
     */
    @Test
    fun ioExceptionRejectsWithNetworkError() {
        val promise = TestPromise()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val errorCode = "TEST_ERROR"
        val cause = IOException("network failure")

        val job = scope.launchBridge(promise, errorCode) { throw cause }
        runBlocking { job.join() }

        assertTrue("Promise must be settled", promise.await(timeoutMs = 100))
        assertEquals(errorCode, promise.rejectedCode)
        assertEquals(ErrorType.NETWORK_ERROR.rawValue, promise.rejectedUserInfo?.getString("type"))
        assertEquals(cause, promise.rejectedThrowable)
    }

    /**
     * An arbitrary [RuntimeException] must produce [ErrorType.INTERNAL_ERROR] in
     * the rejected [GenericError].
     */
    @Test
    fun runtimeExceptionRejectsWithInternalError() {
        val promise = TestPromise()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val errorCode = "TEST_ERROR"
        val cause = RuntimeException("unexpected failure")

        val job = scope.launchBridge(promise, errorCode) { throw cause }
        runBlocking { job.join() }

        assertTrue("Promise must be settled", promise.await(timeoutMs = 100))
        assertEquals(errorCode, promise.rejectedCode)
        assertEquals(ErrorType.INTERNAL_ERROR.rawValue, promise.rejectedUserInfo?.getString("type"))
        assertEquals(cause, promise.rejectedThrowable)
    }

    /**
     * An arbitrary [Error] subclass (non-Exception Throwable) must also be caught
     * and result in [ErrorType.INTERNAL_ERROR]. This validates that [launchBridge]
     * catches [Throwable], not just [Exception].
     */
    @Test
    fun errorSubclassRejectsWithInternalError() {
        val promise = TestPromise()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val errorCode = "TEST_ERROR"
        val cause = Error("jvm error")

        val job = scope.launchBridge(promise, errorCode) { throw cause }
        runBlocking { job.join() }

        assertTrue("Promise must be settled", promise.await(timeoutMs = 100))
        assertEquals(errorCode, promise.rejectedCode)
        assertEquals(ErrorType.INTERNAL_ERROR.rawValue, promise.rejectedUserInfo?.getString("type"))
        assertEquals(cause, promise.rejectedThrowable)
    }

    /**
     * When the block completes without throwing, the promise is NOT rejected by
     * [launchBridge] — promise settlement is the responsibility of the block itself.
     */
    @Test
    fun successfulBlockDoesNotRejectPromise() {
        val promise = TestPromise()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)

        val job = scope.launchBridge(promise, "TEST_ERROR") {
            // Block succeeds without resolving/rejecting the promise.
        }

        runBlocking { job.join() }

        assertNull("rejectedCode must be null on success", promise.rejectedCode)
        assertFalse("resolved must be false — block did not resolve", promise.resolved)
    }

    /**
     * The original [Throwable] is passed as the second argument to
     * [Promise.reject] so the native stack trace is preserved.
     */
    @Test
    fun originalThrowableIsPassedToPromiseReject() {
        val promise = TestPromise()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val cause = RuntimeException("original")

        val job = scope.launchBridge(promise, "TEST_ERROR") { throw cause }
        runBlocking { job.join() }

        assertTrue(promise.await(timeoutMs = 100))
        assertNotNull(promise.rejectedThrowable)
        assertEquals(cause, promise.rejectedThrowable)
    }

    // ---------------------------------------------------------------------------
    // Context forwarding
    // ---------------------------------------------------------------------------

    /**
     * Verifies that [launchBridge] forwards the [context] parameter to the underlying
     * [kotlinx.coroutines.launch] call. A [CoroutineName] element is passed as the
     * context; the block reads [currentCoroutineContext] and captures the name. After
     * the coroutine completes the captured name must equal the one that was passed in.
     */
    @Test
    fun contextParameterIsForwardedToLaunch() {
        val expectedName = "test-coroutine-context"
        var capturedName: String? = null

        val promise = TestPromise()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)

        val job = scope.launchBridge(promise, "TEST_ERROR", CoroutineName(expectedName)) {
            capturedName = currentCoroutineContext()[CoroutineName]?.name
        }

        runBlocking { job.join() }

        assertEquals(
            "context parameter must be forwarded to the underlying launch call",
            expectedName,
            capturedName
        )
    }
}

/**
 * Shadows [com.facebook.react.bridge.Arguments] to avoid loading native JNI libraries
 * during unit tests. Returns [JavaOnlyMap] and [JavaOnlyArray] instead of their
 * native-backed counterparts.
 */
@Implements(className = "com.facebook.react.bridge.Arguments")
object ShadowRnCoreArguments {
    @Implementation
    @JvmStatic
    fun createMap(): WritableMap = JavaOnlyMap()

    @Implementation
    @JvmStatic
    fun createArray(): WritableArray = JavaOnlyArray()
}
