/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnprotect

import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.pingidentity.logger.Logger
import com.pingidentity.protect.Protect
import com.pingidentity.protect.ProtectException
import com.pingidentity.protect.davinci.ProtectCollector
import com.pingidentity.protect.journey.PingOneProtectEvaluationCallback
import com.pingidentity.protect.journey.PingOneProtectInitializeCallback
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.DaVinciCollectorResolver
import com.pingidentity.rncore.JourneyCallbackResolver
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.logger.LoggerHandleContract
import io.mockk.coEvery
import io.mockk.every
import io.mockk.just
import io.mockk.mockkObject
import io.mockk.runs
import io.mockk.unmockkObject
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
  private var originalJourneyCallbackResolver: JourneyCallbackResolver? = null

  /**
   * Configure bridge test seams before each test.
   */
  @Before
  fun setUp() {
    originalDaVinciCollectorResolver = CoreRuntime.davinciCollectorResolver
    CoreRuntime.davinciCollectorResolver = null
    originalJourneyCallbackResolver = CoreRuntime.journeyCallbackResolver
    CoreRuntime.journeyCallbackResolver = null
    resetInitialization()
  }

  /**
   * Restore global bridge state after each test.
   */
  @After
  fun tearDown() {
    CoreRuntime.davinciCollectorResolver = originalDaVinciCollectorResolver
    CoreRuntime.journeyCallbackResolver = originalJourneyCallbackResolver
    CoreRuntime.unregisterDaVinciModuleHook("protect")
    unmockkObject(Protect)
    resetInitialization()
  }

  /**
   * Ensures the TurboModule name is correct.
   */
  @Test
  fun moduleNameIsCorrect() {
    assertEquals("RNPingProtect", RNPingProtectCommon.MODULE_NAME)
  }

  /**
   * Ensures stable Protect error code values remain unchanged.
   */
  @Test
  fun errorCodeContractsAreCorrect() {
    assertEquals("PROTECT_COLLECT_ERROR", ProtectErrorCodes.COLLECT_ERROR)
    assertEquals("PROTECT_COLLECTOR_NOT_FOUND", ProtectErrorCodes.COLLECTOR_NOT_FOUND)
    assertEquals("PROTECT_INITIALIZE_ERROR", ProtectErrorCodes.INITIALIZE_ERROR)
    assertEquals("PROTECT_NOT_INITIALIZED", ProtectErrorCodes.NOT_INITIALIZED)
    assertEquals("PROTECT_CALLBACK_NOT_FOUND", ProtectErrorCodes.CALLBACK_NOT_FOUND)
    assertEquals("PROTECT_ARGUMENT_ERROR", ProtectErrorCodes.ARGUMENT_ERROR)
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
   * Ensures collectForJourney rejects a blank journeyId as an argument error.
   */
  @Test
  fun collectForJourneyRejectsBlankJourneyId() {
    val promise = TestPromise()

    RNPingProtectCommon.collectForJourney("  ", JavaOnlyMap(), JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ProtectErrorCodes.ARGUMENT_ERROR, promise.rejectCode)
    assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
    assertTrue(error.getString("message")?.contains("Journey id must not be empty") == true)
  }

  /**
   * Ensures collectForJourney rejects when no evaluation callback exists on the node.
   */
  @Test
  fun collectForJourneyRejectsWhenCallbackMissing() {
    CoreRuntime.journeyCallbackResolver = { emptyList() }
    val promise = TestPromise()

    RNPingProtectCommon.collectForJourney("journey-id", JavaOnlyMap(), JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ProtectErrorCodes.CALLBACK_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertTrue(error.getString("message")?.contains("No active Protect evaluation callback") == true)
  }

  /**
   * Ensures collectForJourney rejects when the requested index is out of range.
   */
  @Test
  fun collectForJourneyRejectsWhenIndexIsOutOfRange() {
    CoreRuntime.journeyCallbackResolver = { listOf(evaluationCallback()) }
    val promise = TestPromise()

    RNPingProtectCommon.collectForJourney(
      "journey-id",
      JavaOnlyMap.of("index", 1),
      JavaOnlyMap(),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ProtectErrorCodes.CALLBACK_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
  }

  /**
   * Ensures collectForJourney reports a negative index as callback-not-found.
   */
  @Test
  fun collectForJourneyRejectsWhenIndexIsNegative() {
    CoreRuntime.journeyCallbackResolver = { listOf(evaluationCallback()) }
    val promise = TestPromise()

    RNPingProtectCommon.collectForJourney(
      "journey-id",
      JavaOnlyMap.of("index", -1),
      JavaOnlyMap(),
      promise
    )

    val error = captureReject(promise)
    assertEquals(ProtectErrorCodes.CALLBACK_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
  }

  /**
   * Ensures collectForJourney rejects when the bridge has not recorded an initialization
   * and leaves the callback input untouched.
   */
  @Test
  fun collectForJourneyRejectsWhenNotInitialized() {
    val callback = evaluationCallback()
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    val promise = TestPromise()

    RNPingProtectCommon.collectForJourney("journey-id", JavaOnlyMap(), JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ProtectErrorCodes.NOT_INITIALIZED, promise.rejectCode)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertTrue(error.getString("message")?.contains("initializeProtectForJourney()") == true)
    assertEquals("", callbackInput(callback, 0))
    assertEquals("", callbackInput(callback, 1))
  }

  /**
   * Ensures collectForJourney resolves a success payload and writes the signal natively.
   */
  @Test
  fun collectForJourneyResolvesSuccessWhenCollectSucceeds() {
    mockProtectSdk()
    coEvery { Protect.data() } returns "signal"
    initializeFromApp()
    val callback = evaluationCallback()
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    val promise = TestPromise()

    RNPingProtectCommon.collectForJourney("journey-id", JavaOnlyMap(), JavaOnlyMap(), promise)

    assertTrue(promise.await())
    assertNull(promise.rejectCode)
    assertEquals("success", (promise.resolvedValue as ReadableMap).getString("type"))
    assertEquals("signal", callbackInput(callback, 0))
    assertEquals("", callbackInput(callback, 1))
  }

  /**
   * Ensures collectForJourney honors a non-zero index.
   */
  @Test
  fun collectForJourneyUsesRequestedIndex() {
    mockProtectSdk()
    coEvery { Protect.data() } returns "signal"
    initializeFromApp()
    val first = evaluationCallback()
    val second = evaluationCallback()
    CoreRuntime.journeyCallbackResolver = { listOf(first, second) }
    val promise = TestPromise()

    RNPingProtectCommon.collectForJourney(
      "journey-id",
      JavaOnlyMap.of("index", 1),
      JavaOnlyMap(),
      promise
    )

    assertTrue(promise.await())
    assertEquals("", callbackInput(first, 0))
    assertEquals("signal", callbackInput(second, 0))
  }

  /**
   * Ensures collectForJourney rejects with an explicit auth error when collect() fails.
   */
  @Test
  fun collectForJourneyRejectsWhenCollectFails() {
    mockProtectSdk()
    coEvery { Protect.data() } throws ProtectException("boom")
    initializeFromApp()
    val callback = evaluationCallback()
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    val promise = TestPromise()

    RNPingProtectCommon.collectForJourney("journey-id", JavaOnlyMap(), JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ProtectErrorCodes.COLLECT_ERROR, promise.rejectCode)
    assertEquals(ErrorType.AUTH_ERROR.rawValue, error.getString("type"))
    assertEquals("boom", error.getString("message"))
    assertEquals("boom", callbackInput(callback, 1))
  }

  /**
   * Ensures initializeForJourney rejects a blank journeyId as an argument error.
   */
  @Test
  fun initializeForJourneyRejectsBlankJourneyId() {
    val promise = TestPromise()

    RNPingProtectCommon.initializeForJourney(" ", JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ProtectErrorCodes.ARGUMENT_ERROR, promise.rejectCode)
    assertEquals(ErrorType.ARGUMENT_ERROR.rawValue, error.getString("type"))
  }

  /**
   * Ensures initializeForJourney rejects when no initialize callback exists on the node.
   */
  @Test
  fun initializeForJourneyRejectsWhenCallbackMissing() {
    CoreRuntime.journeyCallbackResolver = { listOf(evaluationCallback()) }
    val promise = TestPromise()

    RNPingProtectCommon.initializeForJourney("journey-id", JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ProtectErrorCodes.CALLBACK_NOT_FOUND, promise.rejectCode)
    assertEquals(ErrorType.STATE_ERROR.rawValue, error.getString("type"))
    assertTrue(error.getString("message")?.contains("No active Protect initialize callback") == true)
  }

  /**
   * Ensures a successful callback start resolves success and unlocks a following collect.
   */
  @Test
  fun initializeForJourneyResolvesSuccessAndAllowsCollect() {
    mockProtectSdk()
    coEvery { Protect.data() } returns "signal"
    CoreRuntime.journeyCallbackResolver = { listOf(initializeCallback()) }
    val initPromise = TestPromise()

    RNPingProtectCommon.initializeForJourney("journey-id", JavaOnlyMap(), initPromise)

    assertTrue(initPromise.await())
    assertNull(initPromise.rejectCode)
    assertEquals("success", (initPromise.resolvedValue as ReadableMap).getString("type"))

    val callback = evaluationCallback()
    CoreRuntime.journeyCallbackResolver = { listOf(callback) }
    val collectPromise = TestPromise()

    RNPingProtectCommon.collectForJourney("journey-id", JavaOnlyMap(), JavaOnlyMap(), collectPromise)

    assertTrue(collectPromise.await())
    assertNull(collectPromise.rejectCode)
    assertEquals("signal", callbackInput(callback, 0))
  }

  /**
   * Ensures a failing callback start rejects with an explicit auth error and does not unlock collect.
   */
  @Test
  fun initializeForJourneyRejectsWhenStartFails() {
    mockProtectSdk()
    coEvery { Protect.initialize() } throws ProtectException("init boom")
    CoreRuntime.journeyCallbackResolver = { listOf(initializeCallback()) }
    val promise = TestPromise()

    RNPingProtectCommon.initializeForJourney("journey-id", JavaOnlyMap(), promise)

    val error = captureReject(promise)
    assertEquals(ProtectErrorCodes.INITIALIZE_ERROR, promise.rejectCode)
    assertEquals(ErrorType.AUTH_ERROR.rawValue, error.getString("type"))
    assertEquals("init boom", error.getString("message"))
    assertNull(readInitialized().get())
  }

  /**
   * Ensures initializing from a different path warns that native initialization is once-only.
   */
  @Test
  fun journeyInitializeAfterAppInitializeLogsOnceOnlyWarning() {
    mockProtectSdk()
    val logger = RecordingLogger()
    val loggerId = registerLogger(logger)
    initializeFromApp()
    CoreRuntime.journeyCallbackResolver = { listOf(initializeCallback()) }
    val promise = TestPromise()

    RNPingProtectCommon.initializeForJourney(
      "journey-id",
      JavaOnlyMap.of("loggerId", loggerId),
      promise
    )

    assertTrue(promise.await())
    assertNull(promise.rejectCode)
    assertTrue(logger.warnings.any {
      it.contains("once-only") && it.contains("app config") && it.contains("Journey tree config")
    })
  }

  /**
   * Ensures the reverse ordering also warns while still resolving success.
   */
  @Test
  fun appInitializeAfterJourneyInitializeLogsOnceOnlyWarning() {
    mockProtectSdk()
    CoreRuntime.journeyCallbackResolver = { listOf(initializeCallback()) }
    val journeyPromise = TestPromise()
    RNPingProtectCommon.initializeForJourney("journey-id", JavaOnlyMap(), journeyPromise)
    assertTrue(journeyPromise.await())
    val logger = RecordingLogger()
    val loggerId = registerLogger(logger)
    val promise = TestPromise()

    RNPingProtectCommon.initialize(
      JavaOnlyMap.of("envId", "env"),
      JavaOnlyMap.of("loggerId", loggerId),
      promise
    )

    assertTrue(promise.await())
    assertNull(promise.rejectCode)
    assertTrue(logger.warnings.any {
      it.contains("once-only") && it.contains("Journey tree config") && it.contains("app config")
    })
  }

  /**
   * Ensures re-initializing from the same path logs no warning.
   */
  @Test
  fun sameSourceReinitializeLogsNoWarning() {
    mockProtectSdk()
    val logger = RecordingLogger()
    val loggerId = registerLogger(logger)
    initializeFromApp()
    val promise = TestPromise()

    RNPingProtectCommon.initialize(
      JavaOnlyMap.of("envId", "env"),
      JavaOnlyMap.of("loggerId", loggerId),
      promise
    )

    assertTrue(promise.await())
    assertNull(promise.rejectCode)
    assertTrue(logger.warnings.isEmpty())
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
   * Ensures cleanup removes the Protect lifecycle module from the shared registry
   * so a re-initialized module does not inherit stale per-initialization config.
   */
  @Test
  fun cleanupRemovesDaVinciModuleHook() {
    val lifecycleKey = "protect"
    CoreRuntime.registerDaVinciModuleHook(lifecycleKey) { }
    assertTrue(readRegisteredHookKeys().contains(lifecycleKey))

    invokeCleanup()

    assertFalse(readRegisteredHookKeys().contains(lifecycleKey))
  }

  /**
   * Stubs the native Protect singleton so initialization and callback start succeed in the JVM.
   */
  private fun mockProtectSdk() {
    mockkObject(Protect)
    every { Protect.config(any()) } just runs
    every { Protect.resumeBehavioralData() } just runs
    every { Protect.pauseBehavioralData() } just runs
    coEvery { Protect.initialize() } just runs
  }

  /**
   * Initializes Protect through the app-config bridge path and waits for completion.
   */
  private fun initializeFromApp() {
    val promise = TestPromise()
    RNPingProtectCommon.initialize(JavaOnlyMap.of("envId", "env"), JavaOnlyMap(), promise)
    assertTrue(promise.await())
    assertNull(promise.rejectCode)
  }

  /**
   * Builds an evaluation callback initialized from direct-form Journey JSON.
   */
  private fun evaluationCallback(): PingOneProtectEvaluationCallback {
    return PingOneProtectEvaluationCallback().apply {
      init(parseJson(EVALUATION_JSON))
    }
  }

  /**
   * Builds an initialize callback initialized from direct-form Journey JSON.
   */
  private fun initializeCallback(): PingOneProtectInitializeCallback {
    return PingOneProtectInitializeCallback().apply {
      init(parseJson(INITIALIZE_JSON))
    }
  }

  /**
   * Parses a JSON literal into the object shape consumed by Journey callbacks.
   */
  private fun parseJson(json: String): JsonObject = Json.parseToJsonElement(json).jsonObject

  /**
   * Reads the value of a callback input entry by position.
   */
  private fun callbackInput(callback: PingOneProtectEvaluationCallback, position: Int): String {
    return callback.payload().getValue("input").jsonArray[position].jsonObject.getValue("value").jsonPrimitive.content
  }

  /**
   * Registers a logger in the shared Core registry and returns its handle id.
   */
  private fun registerLogger(logger: Logger): String {
    return CoreRuntime.loggerRegistry.register(TestLoggerHandle(logger))
  }

  /**
   * Reflectively reads the private initialization marker.
   */
  private fun readInitialized(): AtomicReference<*> {
    val field = RNPingProtectCommon::class.java.getDeclaredField("initialized")
    field.isAccessible = true
    return field.get(RNPingProtectCommon) as AtomicReference<*>
  }

  /**
   * Clears the private initialization marker so tests do not leak state.
   */
  private fun resetInitialization() {
    readInitialized().set(null)
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

  /**
   * Reflectively reads the registered DaVinci module hook keys from CoreRuntime.
   */
  private fun readRegisteredHookKeys(): Set<String> {
    val field = CoreRuntime::class.java.getDeclaredField("davinciModuleHooks")
    field.isAccessible = true
    @Suppress("UNCHECKED_CAST")
    val hooks = field.get(CoreRuntime) as Map<String, Any>
    return hooks.keys
  }
}

private const val EVALUATION_JSON = """
  {"type":"PingOneProtectEvaluationCallback",
   "output":[{"name":"pauseBehavioralData","value":false}],
   "input":[{"name":"IDToken1signals","value":""},{"name":"IDToken1clientError","value":""}]}
"""

private const val INITIALIZE_JSON = """
  {"type":"PingOneProtectInitializeCallback",
   "output":[{"name":"envId","value":"env-1"},{"name":"behavioralDataCollection","value":true}],
   "input":[{"name":"IDToken1clientError","value":""}]}
"""

/**
 * Logger test double that records warning messages.
 */
private class RecordingLogger : Logger {
  val warnings = CopyOnWriteArrayList<String>()

  override fun d(message: String) = Unit

  override fun i(message: String) = Unit

  override fun w(message: String, throwable: Throwable?) {
    warnings.add(message)
  }

  override fun e(message: String, throwable: Throwable?) = Unit
}

/**
 * Logger handle test double exposing a native logger through the Core registry.
 */
private class TestLoggerHandle(override val nativeLogger: Any) : LoggerHandleContract {
  override val loggerLevel: String = "STANDARD"
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
