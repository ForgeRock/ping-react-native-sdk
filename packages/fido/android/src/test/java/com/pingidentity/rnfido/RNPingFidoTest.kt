/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import androidx.credentials.exceptions.publickeycredential.GetPublicKeyCredentialDomException
import androidx.credentials.exceptions.domerrors.TimeoutError
import androidx.credentials.exceptions.domerrors.InvalidStateError
import androidx.credentials.exceptions.CreateCredentialCancellationException
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.soloader.SoLoader
import com.facebook.soloader.nativeloader.NativeLoader
import com.facebook.soloader.nativeloader.SystemDelegate
import com.pingidentity.fido.davinci.FidoAuthenticationCollector
import com.pingidentity.fido.davinci.FidoRegistrationCollector
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.DaVinciCollectorResolver
import com.pingidentity.rncore.utils.JsonBridgeMapper
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.mockkStatic
import io.mockk.unmockkObject
import io.mockk.unmockkStatic
import io.mockk.verify
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLog

/**
 * Unit tests for FIDO module metadata and bridge behavior.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class RNPingFidoTest {

  private var originalDaVinciCollectorResolver: DaVinciCollectorResolver? = null

  @Before
  fun setUp() {
    runCatching { SoLoader.init(RuntimeEnvironment.getApplication(), false) }
    runCatching { NativeLoader.init(SystemDelegate()) }
    mockkStatic(Arguments::class)
    every { Arguments.createMap() } answers { JavaOnlyMap() }
    every { Arguments.createArray() } answers { JavaOnlyArray() }
    RNPingFidoCommon.foregroundActivityProvider = { true }
    originalDaVinciCollectorResolver = CoreRuntime.davinciCollectorResolver
    CoreRuntime.davinciCollectorResolver = null
  }

  @After
  fun tearDown() {
    RNPingFidoCommon.foregroundActivityProvider = { true }
    CoreRuntime.davinciCollectorResolver = originalDaVinciCollectorResolver
    unmockkStatic(Arguments::class)
    unmockkObject(JsonBridgeMapper)
  }

  // MARK: - Error code contracts

  /**
   * Ensures FIDO_ERROR is the correct stable value.
   */
  @Test
  fun errorCodeFidoErrorIsCorrect() {
    assertEquals("FIDO_ERROR", FidoErrorCodes.FIDO_ERROR)
  }

  /**
   * Ensures FIDO_REGISTER_ERROR is the correct stable value.
   */
  @Test
  fun errorCodeRegisterErrorIsCorrect() {
    assertEquals("FIDO_REGISTER_ERROR", FidoErrorCodes.FIDO_REGISTER_ERROR)
  }

  /**
   * Ensures FIDO_AUTHENTICATE_ERROR is the correct stable value.
   */
  @Test
  fun errorCodeAuthenticateErrorIsCorrect() {
    assertEquals("FIDO_AUTHENTICATE_ERROR", FidoErrorCodes.FIDO_AUTHENTICATE_ERROR)
  }

  /**
   * Ensures FIDO_AUTHENTICATE_CANCELLED is the correct stable value.
   */
  @Test
  fun errorCodeAuthenticateCancelledIsCorrect() {
    assertEquals("FIDO_AUTHENTICATE_CANCELLED", FidoErrorCodes.FIDO_AUTHENTICATE_CANCELLED)
  }

  /**
   * Ensures FIDO_ACTIVITY_UNAVAILABLE is the correct stable value.
   */
  @Test
  fun errorCodeActivityUnavailableIsCorrect() {
    assertEquals("FIDO_ACTIVITY_UNAVAILABLE", FidoErrorCodes.FIDO_ACTIVITY_UNAVAILABLE)
  }

  /**
   * Ensures FIDO_WINDOW_UNAVAILABLE is the correct stable value.
   * This mirrors the iOS error code used on that platform.
   */
  @Test
  fun errorCodeWindowUnavailableIsCorrect() {
    assertEquals("FIDO_WINDOW_UNAVAILABLE", FidoErrorCodes.FIDO_WINDOW_UNAVAILABLE)
  }

  /**
   * Ensures FIDO_CALLBACK_NOT_FOUND is the correct stable value.
   */
  @Test
  fun errorCodeCallbackNotFoundIsCorrect() {
    assertEquals("FIDO_CALLBACK_NOT_FOUND", FidoErrorCodes.FIDO_CALLBACK_NOT_FOUND)
  }

  // MARK: - Common behavior

  /**
   * Ensures registration rejects when no foreground activity is available.
   */
  @Test
  fun registerRejectsWhenActivityUnavailable() {
    RNPingFidoCommon.foregroundActivityProvider = { false }
    val promise = TestPromise()

    RNPingFidoCommon.register(JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_ACTIVITY_UNAVAILABLE, promise.rejectedCode)
    assertEquals(
      "No foreground activity is available for FIDO registration.",
      promise.rejectedMessage
    )
  }

  /**
   * Ensures authentication rejects when no foreground activity is available.
   */
  @Test
  fun authenticateRejectsWhenActivityUnavailable() {
    RNPingFidoCommon.foregroundActivityProvider = { false }
    val promise = TestPromise()

    RNPingFidoCommon.authenticate(JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_ACTIVITY_UNAVAILABLE, promise.rejectedCode)
    assertEquals(
      "No foreground activity is available for FIDO authentication.",
      promise.rejectedMessage
    )
  }

  /**
   * Ensures registration maps invalid options payload errors to the stable registration code.
   */
  @Test
  fun registerRejectsWithRegisterErrorWhenDecodeFails() {
    RNPingFidoCommon.foregroundActivityProvider = { true }
    mockkObject(JsonBridgeMapper)
    every { JsonBridgeMapper.decodeReadableMap(any()) } throws IllegalArgumentException("bad payload")

    val promise = TestPromise()
    RNPingFidoCommon.register(JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_REGISTER_ERROR, promise.rejectedCode)
    assertEquals("bad payload", promise.rejectedMessage)
  }

  /**
   * Ensures registration rejects with the stable error code and descriptive fallback message
   * when decode errors without a message — preserving the original JS-visible contract.
   */
  @Test
  fun registerRejectsWithInvalidOptionsMessageWhenDecodeFailsWithoutMessage() {
    RNPingFidoCommon.foregroundActivityProvider = { true }
    mockkObject(JsonBridgeMapper)
    every { JsonBridgeMapper.decodeReadableMap(any()) } throws IllegalArgumentException()

    val promise = TestPromise()
    RNPingFidoCommon.register(JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_REGISTER_ERROR, promise.rejectedCode)
    assertEquals("Invalid FIDO registration options payload.", promise.rejectedMessage)
  }

  /**
   * Ensures authentication rejects with the stable error code and descriptive fallback message
   * when decode errors without a message — preserving the original JS-visible contract.
   */
  @Test
  fun authenticateRejectsWithInvalidOptionsMessageWhenDecodeFailsWithoutMessage() {
    RNPingFidoCommon.foregroundActivityProvider = { true }
    mockkObject(JsonBridgeMapper)
    every { JsonBridgeMapper.decodeReadableMap(any()) } throws IllegalArgumentException()

    val promise = TestPromise()
    RNPingFidoCommon.authenticate(JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_AUTHENTICATE_ERROR, promise.rejectedCode)
    assertEquals("Invalid FIDO authentication options payload.", promise.rejectedMessage)
  }

  /**
   * Ensures authentication maps unexpected exceptions to the stable authentication code.
   */
  @Test
  fun authenticateRejectsWithAuthenticateErrorWhenUnexpectedFailureOccurs() {
    RNPingFidoCommon.foregroundActivityProvider = { true }
    mockkObject(JsonBridgeMapper)
    every { JsonBridgeMapper.decodeReadableMap(any()) } throws IllegalStateException("unexpected")

    val promise = TestPromise()
    RNPingFidoCommon.authenticate(JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_AUTHENTICATE_ERROR, promise.rejectedCode)
    assertEquals("unexpected", promise.rejectedMessage)
  }

  /**
   * Ensures journey-scoped registration rejects when callback resolution fails.
   */
  @Test
  fun registerForJourneyRejectsWhenCallbackMissing() {
    val promise = TestPromise()
    RNPingFidoCommon.registerForJourney("journey-missing", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_CALLBACK_NOT_FOUND, promise.rejectedCode)
  }

  /**
   * Ensures journey-scoped authentication rejects when callback resolution fails.
   */
  @Test
  fun authenticateForJourneyRejectsWhenCallbackMissing() {
    val promise = TestPromise()
    RNPingFidoCommon.authenticateForJourney("journey-missing", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_CALLBACK_NOT_FOUND, promise.rejectedCode)
  }

  // MARK: - DaVinci ceremony bridge

  /**
   * Ensures DaVinci registration rejects when no matching collector is resolved.
   */
  @Test
  fun registerForDaVinciRejectsWhenCollectorNotFound() {
    CoreRuntime.davinciCollectorResolver = { emptyList() }
    val promise = TestPromise()

    RNPingFidoCommon.registerForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_COLLECTOR_NOT_FOUND, promise.rejectedCode)
  }

  /**
   * Ensures DaVinci authentication rejects when no matching collector is resolved.
   */
  @Test
  fun authenticateForDaVinciRejectsWhenCollectorNotFound() {
    CoreRuntime.davinciCollectorResolver = { emptyList() }
    val promise = TestPromise()

    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_COLLECTOR_NOT_FOUND, promise.rejectedCode)
  }

  /**
   * Ensures DaVinci registration rejects a blank DaVinci id before resolving collectors.
   */
  @Test
  fun registerForDaVinciRejectsWhenDaVinciIdBlank() {
    val promise = TestPromise()

    RNPingFidoCommon.registerForDaVinci("", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_COLLECTOR_NOT_FOUND, promise.rejectedCode)
  }

  /**
   * Ensures DaVinci registration rejects when no foreground activity is available.
   */
  @Test
  fun registerForDaVinciRejectsWhenActivityUnavailable() {
    RNPingFidoCommon.foregroundActivityProvider = { false }
    val promise = TestPromise()

    RNPingFidoCommon.registerForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_ACTIVITY_UNAVAILABLE, promise.rejectedCode)
  }

  /**
   * Ensures DaVinci authentication rejects when no foreground activity is available.
   */
  @Test
  fun authenticateForDaVinciRejectsWhenActivityUnavailable() {
    RNPingFidoCommon.foregroundActivityProvider = { false }
    val promise = TestPromise()

    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_ACTIVITY_UNAVAILABLE, promise.rejectedCode)
  }

  /**
   * Ensures DaVinci authentication maps a user cancellation to the stable
   * cancelled code rather than the generic authentication error, forwarding the
   * collector's recorded NotAllowedError as the clientError extra.
   */
  @Test
  fun authenticateForDaVinciRejectsWithCancelledWhenUserCancels() {
    val collector = mockk<FidoAuthenticationCollector>()
    coEvery { collector.authenticate(any()) } returns Result.failure(
      GetCredentialCancellationException("Cancelled by user")
    )
    every { collector.errorCode } returns "NotAllowedError"
    every { collector.logger } returns mockk(relaxed = true)
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    val promise = TestPromise()

    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_AUTHENTICATE_CANCELLED, promise.rejectedCode)
    assertEquals("NotAllowedError", promise.rejectedUserInfo?.getString("clientError"))
  }

  // MARK: - DaVinci clientError extras

  /**
   * Ensures a failed DaVinci registration rejection carries the collector's
   * recorded client error code in the userInfo, with the stable register code unchanged.
   */
  @Test
  fun registerForDaVinciRejectionCarriesClientError() {
    val collector = mockk<FidoRegistrationCollector>()
    coEvery { collector.register(any()) } returns Result.failure(
      CreateCredentialCancellationException("Cancelled by user")
    )
    every { collector.errorCode } returns "NotAllowedError"
    every { collector.logger } returns mockk(relaxed = true)
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    val promise = TestPromise()

    RNPingFidoCommon.registerForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_REGISTER_ERROR, promise.rejectedCode)
    assertEquals("NotAllowedError", promise.rejectedUserInfo?.getString("clientError"))
  }

  /**
   * Ensures a cancelled DaVinci authentication keeps the stable cancelled code
   * while carrying the collector's clientError extra.
   */
  @Test
  fun authenticateForDaVinciCancelledKeepsCodeAndCarriesClientError() {
    val collector = mockk<FidoAuthenticationCollector>()
    coEvery { collector.authenticate(any()) } returns Result.failure(
      GetCredentialCancellationException("Cancelled by user")
    )
    every { collector.errorCode } returns "NotAllowedError"
    every { collector.logger } returns mockk(relaxed = true)
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    val promise = TestPromise()

    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_AUTHENTICATE_CANCELLED, promise.rejectedCode)
    assertEquals("NotAllowedError", promise.rejectedUserInfo?.getString("clientError"))
  }

  /**
   * Ensures the NoCredentialException case (plan D8) keeps the bridge-local
   * cancelled code while clientError reports the server-parity UnknownError that
   * the native handleError fallback records; the two intentionally disagree.
   */
  @Test
  fun authenticateForDaVinciNoCredentialMapsToCancelledWithUnknownError() {
    val collector = mockk<FidoAuthenticationCollector>()
    coEvery { collector.authenticate(any()) } returns Result.failure(
      NoCredentialException("No eligible passkey credential")
    )
    every { collector.errorCode } returns "UnknownError"
    every { collector.logger } returns mockk(relaxed = true)
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    val promise = TestPromise()

    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_AUTHENTICATE_CANCELLED, promise.rejectedCode)
    assertEquals("UnknownError", promise.rejectedUserInfo?.getString("clientError"))
  }

  /**
   * Ensures a timed-out DaVinci authentication carries the OS-reported
   * TimeoutError name (open Android set) as clientError under the stable
   * authenticate error code.
   */
  @Test
  fun authenticateForDaVinciTimeoutCarriesTimeoutError() {
    val collector = mockk<FidoAuthenticationCollector>()
    coEvery { collector.authenticate(any()) } returns Result.failure(
      GetPublicKeyCredentialDomException(TimeoutError())
    )
    every { collector.errorCode } returns "TimeoutError"
    every { collector.logger } returns mockk(relaxed = true)
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    val promise = TestPromise()

    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_AUTHENTICATE_ERROR, promise.rejectedCode)
    assertEquals("TimeoutError", promise.rejectedUserInfo?.getString("clientError"))
  }

  /**
   * Ensures an invalid-state DaVinci authentication carries InvalidStateError as
   * clientError with the generic authenticate error code unchanged.
   */
  @Test
  fun authenticateForDaVinciInvalidStateCarriesInvalidStateError() {
    val collector = mockk<FidoAuthenticationCollector>()
    coEvery { collector.authenticate(any()) } returns Result.failure(
      GetPublicKeyCredentialDomException(InvalidStateError())
    )
    every { collector.errorCode } returns "InvalidStateError"
    every { collector.logger } returns mockk(relaxed = true)
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    val promise = TestPromise()

    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_AUTHENTICATE_ERROR, promise.rejectedCode)
    assertEquals("InvalidStateError", promise.rejectedUserInfo?.getString("clientError"))
  }

  /**
   * Ensures a failure without a recorded client error code yields no clientError
   * extra and logs a warning on the collector's logger (no-silent-failures rule).
   */
  @Test
  fun daVinciRejectionWithoutErrorCodeHasNoClientErrorAndLogsWarning() {
    val collector = mockk<FidoAuthenticationCollector>()
    val logger = mockk<com.pingidentity.logger.Logger>()
    coEvery { collector.authenticate(any()) } returns Result.failure(
      IllegalStateException("unexpected failure")
    )
    every { collector.errorCode } returns null
    every { collector.logger } returns logger
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    val promise = TestPromise()

    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_AUTHENTICATE_ERROR, promise.rejectedCode)
    assertNull(promise.rejectedUserInfo?.getString("clientError"))
    verify(exactly = 1) {
      logger.w(
        "FIDO DaVinci ceremony failed but the collector recorded no client error code",
        null
      )
    }
  }

  /**
   * Ensures the bridge keeps no error state between calls: a failure followed by
   * a success on the same mocked collector resolves the second call with the
   * collector payload and no clientError leakage from the first call.
   */
  @Test
  fun daVinciFailureThenSuccessOnSameCollectorResolvesWithoutClientError() {
    val collector = mockk<FidoAuthenticationCollector>()
    coEvery { collector.authenticate(any()) } returnsMany listOf(
      Result.failure(GetCredentialCancellationException("Cancelled by user")),
      Result.success(
        buildJsonObject { put("assertion", JsonPrimitive("assertion-value")) }
      )
    )
    every { collector.errorCode } returnsMany listOf("NotAllowedError", null)
    every { collector.logger } returns mockk(relaxed = true)
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }

    val failurePromise = TestPromise()
    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), failurePromise)
    assertTrue(failurePromise.await())
    assertEquals(FidoErrorCodes.FIDO_AUTHENTICATE_CANCELLED, failurePromise.rejectedCode)
    assertEquals("NotAllowedError", failurePromise.rejectedUserInfo?.getString("clientError"))

    val secondPromise = TestPromise()
    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), secondPromise)
    assertTrue(secondPromise.await())
    assertNull(secondPromise.rejectedCode)
    val resolved = secondPromise.resolvedValue as WritableMap
    assertEquals("assertion-value", resolved.getString("assertion"))
  }

  /**
   * Ensures a successful DaVinci authentication resolves with the collector
   * payload and no clientError, pinning the happy path unchanged.
   */
  @Test
  fun daVinciSuccessResolvesPayloadUnchanged() {
    val collector = mockk<FidoAuthenticationCollector>()
    coEvery { collector.authenticate(any()) } returns Result.success(
      buildJsonObject { put("assertion", JsonPrimitive("assertion-value")) }
    )
    every { collector.errorCode } returns null
    every { collector.logger } returns mockk(relaxed = true)
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    val promise = TestPromise()

    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertNull(promise.rejectedCode)
    assertNull(promise.rejectedUserInfo)
    val resolved = promise.resolvedValue as WritableMap
    assertEquals("assertion-value", resolved.getString("assertion"))
  }

  /**
   * Ensures the fallback path inside rejectWithError is not silent: when the
   * GenericError-based reject itself throws, the bridge logs a warning naming the
   * dropped userInfo extras before falling back to the plain reject, which loses
   * clientError.
   */
  @Test
  fun daVinciRejectionFallbackLogsWarningWhenRejectFails() {
    val collector = mockk<FidoAuthenticationCollector>()
    coEvery { collector.authenticate(any()) } returns Result.failure(
      GetCredentialCancellationException("Cancelled by user")
    )
    every { collector.errorCode } returns "NotAllowedError"
    every { collector.logger } returns mockk(relaxed = true)
    CoreRuntime.davinciCollectorResolver = { listOf(collector) }
    ShadowLog.setupLogging()
    ShadowLog.clear()
    val promise = ThrowingRejectPromise()

    RNPingFidoCommon.authenticateForDaVinci("dv-1", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertEquals(FidoErrorCodes.FIDO_AUTHENTICATE_CANCELLED, promise.rejectedCode)
    val warnings = ShadowLog.getLogsForTag("RNPingFidoCommon")
      .filter { it.msg.contains("dropping userInfo extras (clientError)") }
    assertTrue(warnings.isNotEmpty())
  }

  /**
   * Promise test helper whose GenericError-based reject throws, forcing the
   * rejectWithError fallback onto the plain 3-arg reject.
   */
  private class ThrowingRejectPromise : Promise {
    private val latch = CountDownLatch(1)

    var rejectedCode: String? = null
      private set
    var rejectedMessage: String? = null
      private set
    var rejectedThrowable: Throwable? = null
      private set

    fun await(timeoutMs: Long = 2_000): Boolean {
      return latch.await(timeoutMs, TimeUnit.MILLISECONDS)
    }

    override fun resolve(value: Any?) = Unit

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
      rejectedCode = "EUNSPECIFIED"
      rejectedThrowable = throwable
      latch.countDown()
    }

    override fun reject(throwable: Throwable, userInfo: WritableMap) {
      throw IllegalStateException("Simulated registry failure")
    }

    override fun reject(code: String, userInfo: WritableMap) {
      throw IllegalStateException("Simulated registry failure")
    }

    override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
      throw IllegalStateException("Simulated registry failure")
    }

    override fun reject(code: String, message: String?, userInfo: WritableMap) {
      throw IllegalStateException("Simulated registry failure")
    }

    override fun reject(
      code: String?,
      message: String?,
      throwable: Throwable?,
      userInfo: WritableMap?
    ) {
      throw IllegalStateException("Simulated registry failure")
    }

    @Suppress("DEPRECATION")
    override fun reject(message: String) {
      rejectedCode = "EUNSPECIFIED"
      rejectedMessage = message
      latch.countDown()
    }
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
    var rejectedUserInfo: WritableMap? = null
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
      rejectedUserInfo = userInfo
      latch.countDown()
    }

    override fun reject(code: String, userInfo: WritableMap) {
      rejectedCode = code
      rejectedUserInfo = userInfo
      latch.countDown()
    }

    override fun reject(code: String, throwable: Throwable?, userInfo: WritableMap) {
      rejectedCode = code
      rejectedThrowable = throwable
      rejectedUserInfo = userInfo
      latch.countDown()
    }

    override fun reject(code: String, message: String?, userInfo: WritableMap) {
      rejectedCode = code
      rejectedMessage = message
      rejectedUserInfo = userInfo
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
}
