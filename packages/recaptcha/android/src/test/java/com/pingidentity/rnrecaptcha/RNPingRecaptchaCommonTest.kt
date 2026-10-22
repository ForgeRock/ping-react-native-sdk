/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnrecaptcha

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.soloader.SoLoader
import com.facebook.soloader.nativeloader.NativeLoader
import com.facebook.soloader.nativeloader.SystemDelegate
import com.google.android.recaptcha.RecaptchaAction
import com.google.android.recaptcha.RecaptchaErrorCode
import com.google.android.recaptcha.RecaptchaException
import com.pingidentity.recaptcha.enterprise.ReCaptchaEnterpriseCallback
import com.pingidentity.recaptcha.enterprise.ReCaptchaEnterpriseConfig
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.JourneyCallbackResolver
import io.mockk.CapturingSlot
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.slot
import io.mockk.unmockkStatic
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.jsonPrimitive
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for the reCAPTCHA bridge common implementation.
 *
 * Covers argument validation, callback resolution and index handling, success
 * and failure payload mapping, config parsing (action/timeout/payload), and
 * cancellation propagation.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class RNPingRecaptchaCommonTest {

    private var originalJourneyCallbackResolver: JourneyCallbackResolver? = null

    @Before
    fun setUp() {
        runCatching { SoLoader.init(RuntimeEnvironment.getApplication(), false) }
        runCatching { NativeLoader.init(SystemDelegate()) }
        mockArguments()
        originalJourneyCallbackResolver = CoreRuntime.journeyCallbackResolver
    }

    @After
    fun tearDown() {
        CoreRuntime.journeyCallbackResolver = originalJourneyCallbackResolver
        unmockArguments()
    }

    /**
     * Swaps `Arguments.createMap` for [JavaOnlyMap] so `JsonBridgeMapper` and
     * `GenericError.toWritableMap` work without the native bridge.
     */
    private fun mockArguments() {
        mockkStatic(Arguments::class)
        every { Arguments.createMap() } answers { JavaOnlyMap() }
        every { Arguments.createArray() } answers { JavaOnlyArray() }
    }

    private fun unmockArguments() {
        unmockkStatic(Arguments::class)
    }

    private fun options(
        index: Int? = null,
        action: String? = null,
        timeoutMs: Double? = null,
        payload: JavaOnlyMap? = null
    ): JavaOnlyMap {
        val map = JavaOnlyMap()
        index?.let { map.putDouble("index", it.toDouble()) }
        action?.let { map.putString("action", it) }
        timeoutMs?.let { map.putDouble("timeoutMs", it) }
        payload?.let { map.putMap("payload", it) }
        return map
    }

    /**
     * Installs a callback resolver returning [callbacks] for any journey id.
     */
    private fun installResolver(callbacks: List<Any>) {
        CoreRuntime.journeyCallbackResolver = { callbacks }
    }

    // MARK: - Argument validation

    /**
     * Ensures a blank journey id rejects with an argument error before any
     * coroutine work or callback resolution happens.
     */
    @Test
    fun verifyForJourneyRejectsBlankJourneyIdAsArgumentError() {
        val resolverInvoked = mutableListOf<String>()
        CoreRuntime.journeyCallbackResolver = { id ->
            resolverInvoked.add(id)
            null
        }
        val promise = TestPromise()

        RNPingRecaptchaCommon.verifyForJourney("  ", JavaOnlyMap(), JavaOnlyMap(), promise)

        assertTrue(promise.await())
        assertEquals(RecaptchaErrorCodes.RECAPTCHA_ERROR, promise.rejectedCode)
        assertEquals("argument_error", promise.rejectedType)
        assertTrue(resolverInvoked.isEmpty())
        assertNull(promise.resolvedValue)
    }

    // MARK: - Callback resolution and index handling

    /**
     * Ensures verification rejects with the stable not-found code when the
     * journey id resolves no callbacks at all.
     */
    @Test
    fun verifyForJourneyRejectsWhenJourneyUnknown() {
        CoreRuntime.journeyCallbackResolver = { null }
        val promise = TestPromise()

        RNPingRecaptchaCommon.verifyForJourney("journey-missing", JavaOnlyMap(), JavaOnlyMap(), promise)

        assertTrue(promise.await())
        assertEquals(RecaptchaErrorCodes.RECAPTCHA_CALLBACK_NOT_FOUND, promise.rejectedCode)
        assertEquals("state_error", promise.rejectedType)
    }

    /**
     * Ensures the callback is selected by type index among enterprise callbacks,
     * skipping non-enterprise callbacks in the resolved list.
     */
    @Test
    fun verifyForJourneyUsesTypeIndexAmongEnterpriseCallbacks() {
        val first = mockEnterpriseCallback(Result.success("token-a"))
        val second = mockEnterpriseCallback(Result.success("token-b"))
        installResolver(listOf(mockk<Any>(), first, second))
        val promise = TestPromise()

        RNPingRecaptchaCommon.verifyForJourney("j1", options(index = 1), JavaOnlyMap(), promise)

        assertTrue(promise.await())
        assertEquals("token-b", promise.resolvedToken)
    }

    /**
     * Ensures an out-of-range index rejects with the stable not-found code.
     */
    @Test
    fun verifyForJourneyRejectsWhenIndexOutOfRange() {
        installResolver(listOf(mockEnterpriseCallback(Result.success("token-a"))))
        val promise = TestPromise()

        RNPingRecaptchaCommon.verifyForJourney("j1", options(index = 5), JavaOnlyMap(), promise)

        assertTrue(promise.await())
        assertEquals(RecaptchaErrorCodes.RECAPTCHA_CALLBACK_NOT_FOUND, promise.rejectedCode)
        assertEquals("state_error", promise.rejectedType)
    }

    // MARK: - Result payload mapping

    /**
     * Ensures a successful verification resolves (never rejects) with the token.
     */
    @Test
    fun verifyForJourneyResolvesSuccessPayloadWithToken() {
        installResolver(listOf(mockEnterpriseCallback(Result.success("the-token"))))
        val promise = TestPromise()

        RNPingRecaptchaCommon.verifyForJourney("j1", JavaOnlyMap(), JavaOnlyMap(), promise)

        assertTrue(promise.await())
        assertNull(promise.rejectedCode)
        assertEquals("success", promise.resolvedType)
        assertEquals("the-token", promise.resolvedToken)
    }

    /**
     * Ensures a verification failure resolves with a failure payload carrying
     * the Google error code and message — no promise rejection.
     */
    @Test
    fun verifyForJourneyResolvesFailurePayloadWithoutRejecting() {
        val failure = RecaptchaException(RecaptchaErrorCode.NETWORK_ERROR, "network down")
        installResolver(listOf(mockEnterpriseCallback(Result.failure(failure))))
        val promise = TestPromise()

        RNPingRecaptchaCommon.verifyForJourney("j1", JavaOnlyMap(), JavaOnlyMap(), promise)

        assertTrue(promise.await())
        assertNull(promise.rejectedCode)
        assertEquals("failure", promise.resolvedType)
        assertEquals("NETWORK_ERROR", promise.resolvedCode)
        assertEquals("network down", promise.resolvedMessage)
    }

    /**
     * Ensures a non-Google failure maps to the upstream UNKNOWN_ERROR fallback.
     */
    @Test
    fun verifyForJourneyMapsNonGoogleFailureToUnknownError() {
        installResolver(listOf(mockEnterpriseCallback(Result.failure(IllegalStateException("boom")))))
        val promise = TestPromise()

        RNPingRecaptchaCommon.verifyForJourney("j1", JavaOnlyMap(), JavaOnlyMap(), promise)

        assertTrue(promise.await())
        assertNull(promise.rejectedCode)
        assertEquals("failure", promise.resolvedType)
        assertEquals("UNKNOWN_ERROR", promise.resolvedCode)
        assertEquals("boom", promise.resolvedMessage)
    }

    // MARK: - Config parsing (MockK-verified verify block)

    /**
     * Ensures option defaults map to `RecaptchaAction.LOGIN`, timeout 15000ms,
     * and no custom payload inside the native verify config block.
     */
    @Test
    fun verifyForJourneyAppliesDefaultConfigBlock() {
        val configSlot = slot<ReCaptchaEnterpriseConfig.() -> Unit>()
        val callback = mockEnterpriseCallback(Result.success("token"), configSlot)
        installResolver(listOf(callback))
        val promise = TestPromise()

        RNPingRecaptchaCommon.verifyForJourney("j1", JavaOnlyMap(), JavaOnlyMap(), promise)

        assertTrue(promise.await())
        val config = ReCaptchaEnterpriseConfig().apply(configSlot.captured)
        assertEquals(RecaptchaAction.LOGIN, config.recaptchaAction)
        assertEquals(15000L, config.timeoutInMills)
        assertNull(config.customPayload)
    }

    /**
     * Ensures explicit action/timeout/payload options are forwarded into the
     * native verify config block.
     */
    @Test
    fun verifyForJourneyForwardsExplicitConfigBlock() {
        val configSlot = slot<ReCaptchaEnterpriseConfig.() -> Unit>()
        val callback = mockEnterpriseCallback(Result.success("token"), configSlot)
        installResolver(listOf(callback))
        val payload = JavaOnlyMap()
        payload.putString("risk", "low")
        val promise = TestPromise()

        RNPingRecaptchaCommon.verifyForJourney(
            "j1",
            options(action = "signup", timeoutMs = 2000.0, payload = payload),
            JavaOnlyMap(),
            promise
        )

        assertTrue(promise.await())
        val config = ReCaptchaEnterpriseConfig().apply(configSlot.captured)
        assertEquals(RecaptchaAction.SIGNUP, config.recaptchaAction)
        assertEquals(2000L, config.timeoutInMills)
        assertNotNull(config.customPayload)
        assertEquals("low", config.customPayload?.get("risk")?.jsonPrimitive?.content)
    }

    /**
     * Ensures an unrecognized action name maps to `RecaptchaAction.custom`.
     */
    @Test
    fun verifyForJourneyMapsCustomAction() {
        val configSlot = slot<ReCaptchaEnterpriseConfig.() -> Unit>()
        val callback = mockEnterpriseCallback(Result.success("token"), configSlot)
        installResolver(listOf(callback))
        val promise = TestPromise()

        RNPingRecaptchaCommon.verifyForJourney("j1", options(action = "checkout"), JavaOnlyMap(), promise)

        assertTrue(promise.await())
        val config = ReCaptchaEnterpriseConfig().apply(configSlot.captured)
        assertEquals(RecaptchaAction.custom("checkout"), config.recaptchaAction)
    }

    // MARK: - Cancellation propagation

    /**
     * Ensures a `CancellationException` thrown inside the verify block propagates
     * through `launchBridge` without settling the promise.
     */
    @Test
    fun verifyForJourneyPropagatesCancellationWithoutSettlingPromise() {
        val callback = mockk<ReCaptchaEnterpriseCallback>()
        coEvery { callback.verify(any<ReCaptchaEnterpriseConfig.() -> Unit>()) } throws
            CancellationException("scope cancelled")
        installResolver(listOf(callback))
        val promise = TestPromise()

        RNPingRecaptchaCommon.verifyForJourney("j1", JavaOnlyMap(), JavaOnlyMap(), promise)

        // launchBridge rethrows cancellation; the promise latch is never
        // counted down, so the bounded await times out with nothing settled.
        assertEquals(false, promise.await(500))
        assertNull(promise.rejectedCode)
        assertNull(promise.resolvedValue)
    }

    /**
     * Ensures `cleanup()` cancels and recreates the scope so subsequent
     * verifications still complete after module invalidation.
     */
    @Test
    fun cleanupRecreatesScopeSoVerificationStillWorks() {
        RNPingRecaptchaCommon.cleanup()
        installResolver(listOf(mockEnterpriseCallback(Result.success("after-cleanup"))))
        val promise = TestPromise()

        RNPingRecaptchaCommon.verifyForJourney("j1", JavaOnlyMap(), JavaOnlyMap(), promise)

        assertTrue(promise.await())
        assertEquals("success", promise.resolvedType)
        assertEquals("after-cleanup", promise.resolvedToken)
    }

    /**
     * Creates a mocked enterprise callback capturing the verify config block.
     *
     * @param result Result the mocked verify returns.
     * @param configSlot Optional slot capturing the config block for assertions.
     * @return Mocked [ReCaptchaEnterpriseCallback].
     */
    private fun mockEnterpriseCallback(
        result: Result<String>,
        configSlot: CapturingSlot<ReCaptchaEnterpriseConfig.() -> Unit>? = null
    ): ReCaptchaEnterpriseCallback {
        val callback = mockk<ReCaptchaEnterpriseCallback>()
        if (configSlot != null) {
            coEvery { callback.verify(capture(configSlot)) } returns result
        } else {
            coEvery { callback.verify(any<ReCaptchaEnterpriseConfig.() -> Unit>()) } returns result
        }
        return callback
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
        var rejectedType: String? = null
            private set

        /** Resolved payload as a map, when the resolved value was a map. */
        private val resolvedMap: JavaOnlyMap?
            get() = resolvedValue as? JavaOnlyMap

        /** Token extracted from a resolved success payload. */
        val resolvedToken: String?
            get() = resolvedMap?.getString("token")

        /** Discriminant extracted from a resolved payload. */
        val resolvedType: String?
            get() = resolvedMap?.getString("type")

        /** Failure code extracted from a resolved failure payload. */
        val resolvedCode: String?
            get() = resolvedMap?.getString("code")

        /** Failure message extracted from a resolved failure payload. */
        val resolvedMessage: String?
            get() = resolvedMap?.getString("message")

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
            latch.countDown()
        }

        override fun reject(code: String, message: String?, throwable: Throwable?) {
            rejectedCode = code
            rejectedMessage = message
            latch.countDown()
        }

        override fun reject(throwable: Throwable) {
            latch.countDown()
        }

        override fun reject(throwable: Throwable, userInfo: WritableMap) {
            latch.countDown()
        }

        override fun reject(code: String, userInfo: WritableMap) {
            rejectedCode = code
            latch.countDown()
        }

        override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
            rejectedCode = code
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
            rejectedType = userInfo?.getString("type")
            latch.countDown()
        }

        @Deprecated("Deprecated in Promise interface")
        @Suppress("DEPRECATION")
        override fun reject(message: String) {
            rejectedMessage = message
            latch.countDown()
        }
    }
}
