/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.soloader.SoLoader
import com.facebook.soloader.nativeloader.NativeLoader
import com.facebook.soloader.nativeloader.SystemDelegate
import com.pingidentity.rncore.utils.JsonBridgeMapper
import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.mockkStatic
import io.mockk.unmockkObject
import io.mockk.unmockkStatic
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for FIDO module metadata and bridge behavior.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29])
class RNPingFidoTest {

  @Before
  fun setUp() {
    runCatching { SoLoader.init(RuntimeEnvironment.getApplication(), false) }
    runCatching { NativeLoader.init(SystemDelegate()) }
    mockkStatic(Arguments::class)
    every { Arguments.createMap() } answers { JavaOnlyMap() }
    every { Arguments.createArray() } answers { JavaOnlyArray() }
    RNPingFidoCommon.foregroundActivityProvider = { true }
  }

  @After
  fun tearDown() {
    RNPingFidoCommon.foregroundActivityProvider = { true }
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
