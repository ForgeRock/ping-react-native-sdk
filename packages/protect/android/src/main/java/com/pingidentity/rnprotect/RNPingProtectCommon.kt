/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnprotect

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.pingidentity.android.ContextProvider
import com.pingidentity.logger.Logger
import com.pingidentity.protect.Protect
import com.pingidentity.protect.davinci.ProtectCollector
import com.pingidentity.protect.journey.PingOneProtectEvaluationCallback
import com.pingidentity.protect.journey.PingOneProtectInitializeCallback
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.mapThrowableToGenericError
import com.pingidentity.rncore.error.reject
import com.pingidentity.rncore.logger.LoggerHandleContract
import com.pingidentity.rncore.utils.launchBridge
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import java.util.concurrent.atomic.AtomicReference

/**
 * Shared implementation for Protect operations on Android.
 */
object RNPingProtectCommon {
  /** TurboModule name exposed to the React Native bridge (new-arch source set). */
  const val MODULE_NAME = "RNPingProtect"

  private const val LOGGER_ID_KEY = "loggerId"
  private const val INDEX_KEY = "index"

  /** Stable registry key identifying the Protect DaVinci lifecycle module. */
  private const val PROTECT_LIFECYCLE_KEY = "protect"

  /** Indicates whether shared runtime wiring has been initialized. */
  private var configured = false

  /** Guards one-time collector serializer registration. */
  private var serializerRegistered = false

  /**
   * Records which path completed the native once-only Protect initialization.
   *
   * NOTE: Initialization performed outside the bridge (for example by the DaVinci
   * `ProtectCollector`) is not observable here because the native SDK exposes no
   * initialized accessor. The value is intentionally not reset by [cleanup] because native
   * Protect state persists and has no teardown API.
   */
  private val initialized = AtomicReference<InitializationSource?>(null)

  /** Coroutine scope for executing Protect operations asynchronously on the IO dispatcher. */
  private var scope: CoroutineScope = createScope()

  /**
   * Creates an IO-backed coroutine scope used for native bridge operations.
   *
   * NOTE: The native Protect SDK never switches dispatchers itself (`Protect.initialize` and
   * `Protect.data` only wrap the PingOneSignals callbacks in `suspendCancellableCoroutine`), so
   * the bridge scope is what keeps the PingOneSignals calls off the main thread. `Dispatchers.IO`
   * is used so the closed source PingOneSignals implementation never blocks the calling thread,
   * and was derived from the DaVinci path.
   *
   * @return Fresh coroutine scope with supervisor semantics.
   */
  private fun createScope(): CoroutineScope {
    return CoroutineScope(SupervisorJob() + Dispatchers.IO)
  }

  /**
   * Identifies which bridge path completed the native Protect initialization.
   *
   * @property description Human-readable label used in diagnostic log messages.
   */
  private enum class InitializationSource(val description: String) {
    INITIALIZED_BY_APP("app config"),
    INITIALIZED_BY_JOURNEY("Journey tree config"),
  }

  /**
   * Per-call Protect runtime configuration.
   */
  private data class CallConfig(val loggerId: String?)

  /**
   * Protect SDK initialization configuration parsed from the JS payload.
   */
  private data class ProtectInitConfig(
    val envId: String?,
    val isBehavioralDataCollection: Boolean,
    val isLazyMetadata: Boolean,
    val customHost: String?,
    val isConsoleLogEnabled: Boolean,
    val deviceAttributesToIgnore: List<String>,
    val pauseBehavioralDataOnSuccess: Boolean,
    val resumeBehavioralDataOnStart: Boolean,
  )

  /**
   * Configure application context required by Ping native SDKs.
   */
  @JvmStatic
  @Synchronized
  fun configure(reactContext: ReactApplicationContext) {
    ContextProvider.init(reactContext.applicationContext)
    registerDaVinciSerializer()
    if (!configured) {
      scope = createScope()
      configured = true
    }
  }

  /**
   * Registers the Protect collector serializer with the generic DaVinci mapper.
   */
  @JvmStatic
  @Synchronized
  fun registerDaVinciSerializer() {
    if (serializerRegistered) return
    serializerRegistered = true
    CoreRuntime.registerDaVinciCollectorSerializer { collectorAny ->
      val collector = collectorAny as? ProtectCollector ?: return@registerDaVinciCollectorSerializer null
      linkedMapOf("key" to collector.id(), "type" to "PROTECT")
    }
  }

  /**
   * Release shared runtime state. Cancels in-flight coroutines so a React context
   * teardown (dev reload, catalyst restart) does not leak captured Promises.
   */
  @JvmStatic
  @Synchronized
  fun cleanup() {
    if (!configured) {
      return
    }
    scope.cancel()
    scope = createScope()
    configured = false
    // Drop the lifecycle hook registered with the last initialize() config so a
    // re-initialized module does not inherit stale Protect settings. The
    // collector serializer is intentionally retained — it is stateless
    // ({key, type} only) and the registry has no removal API; leaving it
    // registered keeps DaVinci collector mapping working across re-inits.
    CoreRuntime.unregisterDaVinciModuleHook(PROTECT_LIFECYCLE_KEY)
    // TODO: call Protect SDK teardown here once a public cleanup API is available.
    // Verified against com.pingidentity.sdks:protect:2.1.0: public API is config(), initialize(),
    // data(), pauseBehavioralData(), resumeBehavioralData() — no shutdown method. Re-evaluate when
    // upgrading the Protect SDK.
  }

  /**
   * Runs Protect SDK data collection for the active `ProtectCollector` in a DaVinci flow.
   *
   * The collected payload is set internally on the native collector so that
   * `daVinci.next({})` picks it up automatically via `collector.payload()`.
   *
   * @param davinciId Native DaVinci instance id.
   * @param options Per-call options payload (index).
   * @param config Per-client runtime configuration payload (loggerId).
   * @param promise React Native promise resolved on success or rejected on error.
   */
  @JvmStatic
  fun collectForDaVinci(
    davinciId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    val callConfig = parseCallConfig(config)
    val logger = resolveLoggerFromCore(callConfig.loggerId)
    if (davinciId.isBlank()) {
      logger?.w("Protect collectForDaVinci rejected because DaVinci id was empty", null)
      rejectWithError(
        promise = promise,
        code = ProtectErrorCodes.COLLECTOR_NOT_FOUND,
        message = "DaVinci id must not be empty for Protect data collection.",
        type = ErrorType.ARGUMENT_ERROR
      )
      return
    }

    val index = 0

    scope.launchBridge(promise, ProtectErrorCodes.COLLECT_ERROR) {
      logger?.i("Protect collectForDaVinci requested for collector index $index")
      val collector = resolveProtectCollector(davinciId, index)
      if (collector == null) {
        logger?.w("Protect collectForDaVinci collector not found at index $index", null)
        rejectWithError(
          promise = promise,
          code = ProtectErrorCodes.COLLECTOR_NOT_FOUND,
          message = "No active Protect collector found for DaVinci $davinciId at index $index.",
          type = ErrorType.STATE_ERROR
        )
        return@launchBridge
      }
      collector.collect().getOrThrow()
      logger?.d("Protect collectForDaVinci succeeded")
      promise.resolve(null)
    }
  }

  /**
   * Runs PingOne Protect data collection for a Journey evaluation callback.
   *
   * The collected risk signal is written natively into the callback and is never returned
   * to JavaScript; the promise resolves with `{ type: "success" }`. Failures reject with
   * [ProtectErrorCodes.ARGUMENT_ERROR], [ProtectErrorCodes.CALLBACK_NOT_FOUND],
   * [ProtectErrorCodes.NOT_INITIALIZED], or [ProtectErrorCodes.COLLECT_ERROR].
   *
   * @param journeyId Native Journey instance id.
   * @param options Per-call options payload (index).
   * @param config Per-client runtime configuration payload (loggerId).
   * @param promise React Native promise resolved on success or rejected on error.
   */
  @JvmStatic
  fun collectForJourney(
    journeyId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    val callConfig = parseCallConfig(config)
    val logger = resolveLoggerFromCore(callConfig.loggerId)
    if (journeyId.isBlank()) {
      logger?.w("Protect collectForJourney rejected because Journey id was empty", null)
      rejectWithError(
        promise = promise,
        code = ProtectErrorCodes.ARGUMENT_ERROR,
        message = "Journey id must not be empty for Protect data collection.",
        type = ErrorType.ARGUMENT_ERROR
      )
      return
    }

    val index = journeyIndex(options)

    scope.launchBridge(promise, ProtectErrorCodes.COLLECT_ERROR) {
      logger?.i("Protect collectForJourney requested for callback index $index")
      val callback = resolveEvaluationCallback(journeyId, index)
      if (callback == null) {
        logger?.w("Protect collectForJourney callback not found at index $index", null)
        rejectWithError(
          promise = promise,
          code = ProtectErrorCodes.CALLBACK_NOT_FOUND,
          message = "No active Protect evaluation callback found for Journey $journeyId at index $index.",
          type = ErrorType.STATE_ERROR
        )
        return@launchBridge
      }
      if (initialized.get() == null) {
        logger?.w("Protect collectForJourney rejected because Protect was not initialized by the bridge", null)
        rejectWithError(
          promise = promise,
          code = ProtectErrorCodes.NOT_INITIALIZED,
          message = "Protect has not been initialized. Call initializeProtectForJourney() before collecting.",
          type = ErrorType.STATE_ERROR
        )
        return@launchBridge
      }
      callback.collect().fold(
        onSuccess = {
          logger?.d("Protect collectForJourney succeeded")
          promise.resolve(createJourneyResultPayload())
        },
        onFailure = { error ->
          logger?.e("Protect collectForJourney failed", error)
          rejectWithError(
            promise = promise,
            code = ProtectErrorCodes.COLLECT_ERROR,
            message = error.localizedMessage ?: "Protect data collection failed.",
            type = ErrorType.AUTH_ERROR,
            throwable = error
          )
        }
      )
    }
  }

  /**
   * Executes a Journey initialize callback using the configuration carried by the callback.
   *
   * Failures reject with [ProtectErrorCodes.ARGUMENT_ERROR],
   * [ProtectErrorCodes.CALLBACK_NOT_FOUND], or [ProtectErrorCodes.INITIALIZE_ERROR].
   *
   * @param journeyId Native Journey instance id.
   * @param config Per-client runtime configuration payload (loggerId).
   * @param promise React Native promise resolved on success or rejected on error.
   */
  @JvmStatic
  fun initializeForJourney(
    journeyId: String,
    config: ReadableMap,
    promise: Promise
  ) {
    val callConfig = parseCallConfig(config)
    val logger = resolveLoggerFromCore(callConfig.loggerId)
    if (journeyId.isBlank()) {
      logger?.w("Protect initializeForJourney rejected because Journey id was empty", null)
      rejectWithError(
        promise = promise,
        code = ProtectErrorCodes.ARGUMENT_ERROR,
        message = "Journey id must not be empty for Protect initialization.",
        type = ErrorType.ARGUMENT_ERROR
      )
      return
    }

    scope.launchBridge(promise, ProtectErrorCodes.INITIALIZE_ERROR) {
      logger?.i("Protect initializeForJourney requested")
      val callback = resolveInitializeCallback(journeyId)
      if (callback == null) {
        logger?.w("Protect initializeForJourney callback not found", null)
        rejectWithError(
          promise = promise,
          code = ProtectErrorCodes.CALLBACK_NOT_FOUND,
          message = "No active Protect initialize callback found for Journey $journeyId.",
          type = ErrorType.STATE_ERROR
        )
        return@launchBridge
      }
      callback.start().fold(
        onSuccess = {
          markInitialized(InitializationSource.INITIALIZED_BY_JOURNEY, logger)
          logger?.d("Protect initializeForJourney succeeded")
          promise.resolve(createJourneyResultPayload())
        },
        onFailure = { error ->
          logger?.e("Protect initializeForJourney failed", error)
          rejectWithError(
            promise = promise,
            code = ProtectErrorCodes.INITIALIZE_ERROR,
            message = error.localizedMessage ?: "Protect initialization failed.",
            type = ErrorType.AUTH_ERROR,
            throwable = error
          )
        }
      )
    }
  }

  /**
   * Records a successful native initialization and warns when a different bridge path
   * had already initialized Protect.
   *
   * @param source Bridge path that just completed initialization.
   * @param logger Optional native logger.
   */
  private fun markInitialized(source: InitializationSource, logger: Logger?) {
    val previous = initialized.getAndUpdate { current -> current ?: source }
    if (previous != null && previous != source) {
      logger?.w(
        "Protect already initialized by ${previous.description}; native initialize is once-only, " +
          "so the identity config (envId, customHost, deviceAttributesToIgnore, consoleLogEnabled, " +
          "lazyMetadata) from ${source.description} was not applied; only behavioral-data " +
          "resume/pause, where that path performs it, took effect",
        null
      )
    }
  }

  /**
   * Initializes the Protect SDK with the provided configuration.
   *
   * @param protectConfig Protect SDK initialization config payload.
   * @param config Per-client runtime configuration payload (loggerId).
   * @param promise React Native promise resolved on success or rejected on error.
   */
  @JvmStatic
  fun initialize(
    protectConfig: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    val callConfig = parseCallConfig(config)
    val logger = resolveLoggerFromCore(callConfig.loggerId)
    scope.launchBridge(promise, ProtectErrorCodes.INITIALIZE_ERROR) {
      val initConfig = parseProtectInitConfig(protectConfig)
      logger?.i("Protect initialize requested")
      Protect.config {
        envId = initConfig.envId
        isBehavioralDataCollection = initConfig.isBehavioralDataCollection
        isLazyMetadata = initConfig.isLazyMetadata
        customHost = initConfig.customHost
        isConsoleLogEnabled = initConfig.isConsoleLogEnabled
        deviceAttributesToIgnore = initConfig.deviceAttributesToIgnore
      }
      Protect.initialize()
      markInitialized(InitializationSource.INITIALIZED_BY_APP, logger)
      registerDaVinciModuleHook(initConfig)
      logger?.d("Protect initialize succeeded")
      promise.resolve(null)
    }
  }

  /**
   * Registers the Protect lifecycle module with the generic DaVinci hook registry.
   */
  private fun registerDaVinciModuleHook(config: ProtectInitConfig) {
    CoreRuntime.registerDaVinciModuleHook(PROTECT_LIFECYCLE_KEY) { builderAny ->
      val builder = builderAny as? com.pingidentity.davinci.DaVinciConfig
        ?: return@registerDaVinciModuleHook
      builder.module(com.pingidentity.protect.ProtectLifecycle) {
        config.envId?.let { envId = it }
        isBehavioralDataCollection = config.isBehavioralDataCollection
        isLazyMetadata = config.isLazyMetadata
        config.customHost?.let { customHost = it }
        isConsoleLogEnabled = config.isConsoleLogEnabled
        if (config.deviceAttributesToIgnore.isNotEmpty()) {
          deviceAttributesToIgnore = config.deviceAttributesToIgnore
        }
        pauseBehavioralDataOnSuccess = config.pauseBehavioralDataOnSuccess
        resumeBehavioralDataOnStart = config.resumeBehavioralDataOnStart
      }
    }
  }

  /**
   * Pauses behavioral data collection.
   *
   * @param config Per-client runtime configuration payload (loggerId).
   * @param promise React Native promise resolved on success or rejected on error.
   */
  @JvmStatic
  fun pauseBehavioralData(
    config: ReadableMap,
    promise: Promise
  ) {
    val callConfig = parseCallConfig(config)
    val logger = resolveLoggerFromCore(callConfig.loggerId)
    scope.launchBridge(promise, ProtectErrorCodes.INITIALIZE_ERROR) {
      // TODO-PARITY: Android resolves silently when Protect is not initialized;
      // iOS rejects in the same state (PingOneProtect throws). Align once the
      // native SDK provides a uniform initialization check.
      logger?.i("Protect pauseBehavioralData requested")
      Protect.pauseBehavioralData()
      logger?.d("Protect pauseBehavioralData succeeded")
      promise.resolve(null)
    }
  }

  /**
   * Resumes behavioral data collection.
   *
   * @param config Per-client runtime configuration payload (loggerId).
   * @param promise React Native promise resolved on success or rejected on error.
   */
  @JvmStatic
  fun resumeBehavioralData(
    config: ReadableMap,
    promise: Promise
  ) {
    val callConfig = parseCallConfig(config)
    val logger = resolveLoggerFromCore(callConfig.loggerId)
    scope.launchBridge(promise, ProtectErrorCodes.INITIALIZE_ERROR) {
      logger?.i("Protect resumeBehavioralData requested")
      Protect.resumeBehavioralData()
      logger?.d("Protect resumeBehavioralData succeeded")
      promise.resolve(null)
    }
  }

  /**
   * Rejects a promise with the shared Protect error contract.
   */
  private fun rejectWithError(
    promise: Promise,
    code: String,
    message: String,
    type: ErrorType? = null,
    throwable: Throwable? = null
  ) {
    val mapped = throwable?.let { mapThrowableToGenericError(it, code) }
    val resolvedType = type ?: mapped?.type ?: ErrorType.AUTH_ERROR
    val resolvedMessage = message.ifBlank { mapped?.message ?: "Unknown error" }
    val error = GenericError(
      type = resolvedType,
      error = code,
      message = resolvedMessage
    )
    promise.reject(error, throwable)
  }

  /**
   * Parses per-call configuration payload.
   *
   * @param config Per-call configuration payload.
   * @return Parsed Protect runtime configuration.
   */
  private fun parseCallConfig(config: ReadableMap): CallConfig {
    val loggerId = if (
      config.hasKey(LOGGER_ID_KEY) && config.getType(LOGGER_ID_KEY) == ReadableType.String
    ) {
      config.getString(LOGGER_ID_KEY)?.trim()?.takeIf { it.isNotEmpty() }
    } else {
      null
    }
    return CallConfig(loggerId = loggerId)
  }

  /**
   * Parses Protect SDK initialization configuration from the JS payload.
   *
   * @param config Raw initialization config payload from JS.
   * @return Parsed Protect initialization configuration.
   */
  private fun parseProtectInitConfig(config: ReadableMap): ProtectInitConfig {
    val envId = if (config.hasKey("envId") && config.getType("envId") == ReadableType.String)
      config.getString("envId")?.takeIf { it.isNotEmpty() } else null
    val isBehavioralDataCollection = if (config.hasKey("isBehavioralDataCollection") &&
      config.getType("isBehavioralDataCollection") == ReadableType.Boolean)
      config.getBoolean("isBehavioralDataCollection") else true
    val isLazyMetadata = if (config.hasKey("isLazyMetadata") &&
      config.getType("isLazyMetadata") == ReadableType.Boolean)
      config.getBoolean("isLazyMetadata") else false
    val customHost = if (config.hasKey("customHost") && config.getType("customHost") == ReadableType.String)
      config.getString("customHost")?.takeIf { it.isNotEmpty() } else null
    val isConsoleLogEnabled = if (config.hasKey("isConsoleLogEnabled") &&
      config.getType("isConsoleLogEnabled") == ReadableType.Boolean)
      config.getBoolean("isConsoleLogEnabled") else false
    val deviceAttributesToIgnore: List<String> = if (config.hasKey("deviceAttributesToIgnore") &&
      config.getType("deviceAttributesToIgnore") == ReadableType.Array) {
      val arr: ReadableArray? = config.getArray("deviceAttributesToIgnore")
      arr?.let { a -> (0 until a.size()).mapNotNull { if (a.getType(it) == ReadableType.String) a.getString(it) else null } } ?: emptyList()
    } else emptyList()
    val pauseBehavioralDataOnSuccess = if (config.hasKey("pauseBehavioralDataOnSuccess") &&
      config.getType("pauseBehavioralDataOnSuccess") == ReadableType.Boolean)
      config.getBoolean("pauseBehavioralDataOnSuccess") else false
    val resumeBehavioralDataOnStart = if (config.hasKey("resumeBehavioralDataOnStart") &&
      config.getType("resumeBehavioralDataOnStart") == ReadableType.Boolean)
      config.getBoolean("resumeBehavioralDataOnStart") else false
    return ProtectInitConfig(
      envId = envId,
      isBehavioralDataCollection = isBehavioralDataCollection,
      isLazyMetadata = isLazyMetadata,
      customHost = customHost,
      isConsoleLogEnabled = isConsoleLogEnabled,
      deviceAttributesToIgnore = deviceAttributesToIgnore,
      pauseBehavioralDataOnSuccess = pauseBehavioralDataOnSuccess,
      resumeBehavioralDataOnStart = resumeBehavioralDataOnStart,
    )
  }

  /**
   * Resolves a native logger from the shared Core logger registry.
   *
   * @param loggerId Logger handle identifier from JS.
   * @return Native logger instance, or null when missing/invalid.
   */
  private fun resolveLoggerFromCore(loggerId: String?): Logger? {
    if (loggerId.isNullOrBlank()) return null
    val handle = CoreRuntime.loggerRegistry.resolve(loggerId) as? LoggerHandleContract ?: return null
    return handle.nativeLogger as? Logger
  }

  /**
   * Resolves a `ProtectCollector` from core-exposed DaVinci collectors by davinciId and type index.
   */
  private suspend fun resolveProtectCollector(davinciId: String, index: Int): ProtectCollector? {
    val collectors = CoreRuntime.resolveDaVinciCollectors(davinciId) ?: return null
    return collectors.filterIsInstance<ProtectCollector>().getOrNull(index)
  }

  /**
   * Resolves a `PingOneProtectEvaluationCallback` from core-exposed Journey callbacks by
   * journeyId and type index.
   */
  private suspend fun resolveEvaluationCallback(
    journeyId: String,
    index: Int
  ): PingOneProtectEvaluationCallback? {
    val callbacks = CoreRuntime.resolveJourneyCallbacks(journeyId) ?: return null
    return callbacks.filterIsInstance<PingOneProtectEvaluationCallback>().getOrNull(index)
  }

  /**
   * Resolves the first `PingOneProtectInitializeCallback` from core-exposed Journey callbacks.
   */
  private suspend fun resolveInitializeCallback(
    journeyId: String
  ): PingOneProtectInitializeCallback? {
    val callbacks = CoreRuntime.resolveJourneyCallbacks(journeyId) ?: return null
    return callbacks.filterIsInstance<PingOneProtectInitializeCallback>().firstOrNull()
  }

  /**
   * Reads the position of the evaluation callback within the node's callback list.
   *
   * The index is derived from the server callback list, not supplied by the app. A missing or
   * null or non-numeric index defaults to 0, and an index outside the matching callbacks is reported as
   * callback-not-found by the caller.
   *
   * @param options Per-call options payload.
   * @return The callback index, or 0 when none is present.
   */
  private fun journeyIndex(options: ReadableMap): Int {
    if (!options.hasKey(INDEX_KEY) || options.getType(INDEX_KEY) != ReadableType.Number) {
      return 0
    }
    return options.getDouble(INDEX_KEY).toInt()
  }

  /**
   * Builds the `{ type: "success" }` Journey result payload.
   */
  private fun createJourneyResultPayload(): ReadableMap {
    return Arguments.createMap().apply { putString("type", "success") }
  }

}
