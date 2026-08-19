/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnprotect

import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.pingidentity.protect.davinci.ProtectCollector
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.DaVinciCollectorResolver
import com.pingidentity.rncore.error.ErrorType
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

/**
 * Unit tests for Protect module metadata and bridge behavior.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29], shadows = [ShadowProtectArguments::class])
class RNPingProtectTest {
  private var originalDaVinciCollectorResolver: DaVinciCollectorResolver? = null

  /**
   * Configure bridge test seams before each test.
   */
  @Before
  fun setUp() {
    originalDaVinciCollectorResolver = CoreRuntime.davinciCollectorResolver
    CoreRuntime.davinciCollectorResolver = null
  }

  /**
   * Restore global bridge state after each test.
   */
  @After
  fun tearDown() {
    CoreRuntime.davinciCollectorResolver = originalDaVinciCollectorResolver
  }

  /**
   * Ensures the TurboModule name is correct.
   */
  @Test
  fun moduleNameIsCorrect() {
    assertEquals("RNPingProtect", RNPingProtectModule.NAME)
  }

  /**
   * Ensures stable Protect error code values remain unchanged.
   */
  @Test
  fun errorCodeContractsAreCorrect() {
    assertEquals("PROTECT_COLLECT_ERROR", ProtectErrorCodes.COLLECT_ERROR)
    assertEquals("PROTECT_COLLECTOR_NOT_FOUND", ProtectErrorCodes.COLLECTOR_NOT_FOUND)
    assertEquals("PROTECT_INITIALIZE_ERROR", ProtectErrorCodes.INITIALIZE_ERROR)
  }

  /**
   * Ensures pauseBehavioralData resolves successfully.
   * pauseBehavioralData() delegates to PingOneSignals which is a no-op in the Robolectric JVM,
   * so no error is thrown and the promise resolves.
   */
  @Test
  fun pauseBehavioralDataResolvesSuccessfully() {
    val promise = TestPromise()

    RNPingProtectCommon.pauseBehavioralData(JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertNull(promise.rejectCode)
  }

  /**
   * Ensures resumeBehavioralData resolves successfully.
   * resumeBehavioralData() delegates to PingOneSignals which is a no-op in the Robolectric JVM,
   * so no error is thrown and the promise resolves.
   */
  @Test
  fun resumeBehavioralDataResolvesSuccessfully() {
    val promise = TestPromise()

    RNPingProtectCommon.resumeBehavioralData(JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertNull(promise.rejectCode)
  }

  /**
   * Ensures collectForDaVinci rejects blank davinciId with the shared error payload.
   */
  @Test
  fun collectForDaVinciRejectsWhenDaVinciIdIsBlank() {
    val promise = TestPromise()

    RNPingProtectCommon.collectForDaVinci("  ", JavaOnlyMap(), JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ProtectErrorCodes.COLLECTOR_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
    assertEquals(ProtectErrorCodes.COLLECTOR_NOT_FOUND, error.getString("error"))
    assertTrue(error.getString("message")?.contains("DaVinci id must not be empty") == true)
  }

  /**
   * Ensures collectForDaVinci rejects when no collector is registered in CoreRuntime.
   */
  @Test
  fun collectForDaVinciRejectsWhenNoCollectorRegistered() {
    CoreRuntime.davinciCollectorResolver = { emptyList() }
    val promise = TestPromise()

    RNPingProtectCommon.collectForDaVinci("davinci-id", JavaOnlyMap(), JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ProtectErrorCodes.COLLECTOR_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(ProtectErrorCodes.COLLECTOR_NOT_FOUND, error.getString("error"))
    assertTrue(error.getString("message")?.contains("No active Protect collector") == true)
  }

  /**
   * Ensures collectForDaVinci rejects when the requested collector index is out of range.
   */
  @Test
  fun collectForDaVinciRejectsWhenCollectorIndexIsOutOfRange() {
    CoreRuntime.davinciCollectorResolver = { emptyList() }
    val promise = TestPromise()

    RNPingProtectCommon.collectForDaVinci(
      "davinci-id",
      JavaOnlyMap.of("index", 5),
      JavaOnlyMap(),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ProtectErrorCodes.COLLECTOR_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertEquals(ProtectErrorCodes.COLLECTOR_NOT_FOUND, error.getString("error"))
  }

  /**
   * Ensures collectForDaVinci rejects with COLLECT_ERROR when collect() fails.
   *
   * In the Robolectric JVM environment PingOneProtect is not initialized, so
   * ProtectCollector.collect() returns Result.failure(...), which getOrThrow()
   * rethrows and launchBridge maps to PROTECT_COLLECT_ERROR. The generic throwable
   * maps to INTERNAL_ERROR type via mapThrowableToGenericError.
   */
  @Test
  fun collectForDaVinciRejectsWhenCollectFails() {
    CoreRuntime.davinciCollectorResolver = { listOf(ProtectCollector()) }
    val promise = TestPromise()

    RNPingProtectCommon.collectForDaVinci("davinci-id", JavaOnlyMap(), JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ProtectErrorCodes.COLLECT_ERROR, promise.rejectCode)
    assertEquals(ErrorType.INTERNAL_ERROR.rawValue, error.getString("type"))
    assertEquals(ProtectErrorCodes.COLLECT_ERROR, error.getString("error"))
  }

  /**
   * Ensures cleanup cancels in-flight coroutines and recreates the scope.
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
    val field = RNPingProtectCommon::class.java.getDeclaredField("scope")
    field.isAccessible = true
    return field.get(RNPingProtectCommon) as CoroutineScope
  }

  /**
   * Reflectively flips the private configured flag and invokes cleanup so the test
   * does not need to call configure() (which requires a ReactApplicationContext).
   */
  private fun invokeCleanup() {
    val configuredField = RNPingProtectCommon::class.java.getDeclaredField("configured")
    configuredField.isAccessible = true
    configuredField.setBoolean(RNPingProtectCommon, true)
    RNPingProtectCommon.cleanup()
  }
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
