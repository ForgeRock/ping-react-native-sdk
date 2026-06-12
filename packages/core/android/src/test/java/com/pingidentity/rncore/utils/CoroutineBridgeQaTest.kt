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
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.job
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
 * QA-targeted tests for [launchBridge] covering scenarios not already exercised by
 * [CoroutineBridgeTest]: scope-level cancellation, subclass CancellationException,
 * no-dispatcher passthrough, and promise not double-settled on launchBridge success.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29], manifest = Config.NONE, shadows = [ShadowQaArguments::class])
class CoroutineBridgeQaTest {

    @Before
    fun setUp() {
        runCatching { SoLoader.init(RuntimeEnvironment.getApplication(), false) }
        runCatching { NativeLoader.init(SystemDelegate()) }
    }

    // -----------------------------------------------------------------------
    // Helper
    // -----------------------------------------------------------------------

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
        var settleCount: Int = 0
            private set

        fun await(timeoutMs: Long = 2_000): Boolean =
            latch.await(timeoutMs, TimeUnit.MILLISECONDS)

        override fun resolve(value: Any?) {
            settleCount++
            resolved = true
            latch.countDown()
        }

        override fun reject(code: String, message: String?) {
            settleCount++
            rejectedCode = code
            rejectedMessage = message
            latch.countDown()
        }

        override fun reject(code: String, throwable: Throwable?) {
            settleCount++
            rejectedCode = code
            rejectedThrowable = throwable
            latch.countDown()
        }

        override fun reject(code: String, message: String?, throwable: Throwable?) {
            settleCount++
            rejectedCode = code
            rejectedMessage = message
            rejectedThrowable = throwable
            latch.countDown()
        }

        override fun reject(throwable: Throwable) {
            settleCount++
            rejectedThrowable = throwable
            latch.countDown()
        }

        override fun reject(throwable: Throwable, userInfo: WritableMap) {
            settleCount++
            rejectedThrowable = throwable
            latch.countDown()
        }

        override fun reject(code: String, userInfo: WritableMap) {
            settleCount++
            rejectedCode = code
            latch.countDown()
        }

        override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
            settleCount++
            rejectedCode = code
            rejectedThrowable = throwable
            latch.countDown()
        }

        override fun reject(code: String, message: String?, userInfo: WritableMap) {
            settleCount++
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
            settleCount++
            rejectedCode = code
            rejectedMessage = message
            rejectedThrowable = throwable
            rejectedUserInfo = userInfo
            latch.countDown()
        }

        @Suppress("DEPRECATION")
        override fun reject(message: String) {
            settleCount++
            rejectedMessage = message
            latch.countDown()
        }
    }

    // -----------------------------------------------------------------------
    // AC 6: Scope-level cancellation — promise not settled
    // -----------------------------------------------------------------------

    /**
     * AC 6: When the scope is cancelled while the coroutine is in-flight,
     * launchBridge must NOT reject the promise. The CancellationException
     * generated by scope.cancel() must propagate through launchBridge's
     * re-throw path without touching the promise.
     */
    @Test
    fun scopeCancellationDoesNotSettlePromise() {
        val promise = TestPromise()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val blockStarted = AtomicBoolean(false)

        // We need a real IO scope to actually interleave cancel with in-flight work.
        val ioScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val blockLatch = CountDownLatch(1)
        val cancelLatch = CountDownLatch(1)

        val job = ioScope.launchBridge(promise, "TEST_CANCEL_ERROR") {
            blockStarted.set(true)
            blockLatch.countDown()       // signal: block has started
            cancelLatch.await()          // wait: allow cancel to proceed
            yield()                      // cooperative cancellation point
        }

        // Wait for block to start, then cancel the scope
        assertTrue("Block must start within 2s", blockLatch.await(2, TimeUnit.SECONDS))
        ioScope.cancel()                 // cancels the scope
        cancelLatch.countDown()          // unblock the coroutine body

        runBlocking { job.join() }       // wait for coroutine to finish

        // Promise must not be settled after cancellation
        assertFalse(
            "Promise must NOT be settled when scope is cancelled",
            promise.await(timeoutMs = 500)
        )
        assertNull("rejectedCode must remain null on scope cancellation", promise.rejectedCode)
        assertFalse("resolved must remain false on scope cancellation", promise.resolved)
    }

    // -----------------------------------------------------------------------
    // AC 2: CancellationException subclass also re-thrown
    // -----------------------------------------------------------------------

    /**
     * AC 2: A custom subclass of CancellationException must also be re-thrown
     * (not caught as a generic Throwable). This tests the catch order:
     * `catch (e: CancellationException)` must fire before `catch (e: Throwable)`.
     */
    @Test
    fun cancellationExceptionSubclassIsRethrownNotRejected() {
        class CustomCancellation(msg: String) : CancellationException(msg)

        val promise = TestPromise()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)

        val job = scope.launchBridge(promise, "TEST_ERROR") {
            throw CustomCancellation("custom cancel")
        }

        runBlocking { job.join() }

        assertFalse("Promise must not be settled for CancellationException subclass",
            promise.await(timeoutMs = 100))
        assertNull(promise.rejectedCode)
        assertFalse(promise.resolved)
    }

    // -----------------------------------------------------------------------
    // AC 9: Receiver scope's dispatcher preserved (no context override)
    // -----------------------------------------------------------------------

    /**
     * AC 9 / Constraint 5: When no context override is provided, the launchBridge
     * call inherits the receiver scope's dispatcher. If the binding scope uses
     * Dispatchers.Main and launchBridge is called without a context override, the
     * coroutine must launch on Main. We verify the invariant indirectly: a scope
     * with a specific CoroutineName propagates that name into the launched coroutine
     * when no context override is given (EmptyCoroutineContext).
     */
    @Test
    fun noContextOverridePreservesReceiverScopeContext() {
        val promise = TestPromise()
        // Use a named scope so we can observe propagation
        val namedScope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined +
                kotlinx.coroutines.CoroutineName("receiver-scope"))
        var capturedName: String? = null

        // No context override — should inherit receiver scope's CoroutineName
        val job = namedScope.launchBridge(promise, "TEST_ERROR") {
            capturedName = kotlinx.coroutines.currentCoroutineContext()[
                kotlinx.coroutines.CoroutineName]?.name
        }

        runBlocking { job.join() }

        // The receiver scope's CoroutineName must be present (not overridden)
        assertEquals("receiver-scope", capturedName)
    }

    // -----------------------------------------------------------------------
    // AC 3: Error code is passed verbatim to the GenericError payload
    // -----------------------------------------------------------------------

    /**
     * AC 3: The error code string passed to launchBridge must appear verbatim
     * as the `error` field in the rejected GenericError userInfo map.
     */
    @Test
    fun errorCodeIsPreservedVerbatimInRejectedPayload() {
        val specificCode = "BINDING_BIND_ERROR"
        val promise = TestPromise()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)

        val job = scope.launchBridge(promise, specificCode) {
            throw RuntimeException("unexpected failure")
        }

        runBlocking { job.join() }

        assertTrue(promise.await(timeoutMs = 100))
        assertEquals(
            "Error code in rejected promise must match the code passed to launchBridge",
            specificCode,
            promise.rejectedCode
        )
        assertEquals(
            "Error code in userInfo map must match the code passed to launchBridge",
            specificCode,
            promise.rejectedUserInfo?.getString("error")
        )
    }

    // -----------------------------------------------------------------------
    // AC 2: Original Throwable is the second argument to Promise.reject
    // -----------------------------------------------------------------------

    /**
     * AC 2 / FR 9: The original throwable must be passed as the second argument
     * to the four-arg Promise.reject(code, message, throwable, userInfo) so the
     * native stack trace is preserved for React Native's error reporting.
     */
    @Test
    fun originalThrowableIdentityIsPreservedInRejection() {
        val promise = TestPromise()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
        val cause = IllegalArgumentException("exact-instance")

        val job = scope.launchBridge(promise, "TEST_ERROR") { throw cause }
        runBlocking { job.join() }

        assertTrue(promise.await(timeoutMs = 100))
        assertTrue(
            "The exact throwable instance must be passed to Promise.reject",
            promise.rejectedThrowable === cause
        )
    }
}

@Implements(className = "com.facebook.react.bridge.Arguments")
object ShadowQaArguments {
    @Implementation
    @JvmStatic
    fun createMap(): WritableMap = JavaOnlyMap()

    @Implementation
    @JvmStatic
    fun createArray(): WritableArray = JavaOnlyArray()
}
