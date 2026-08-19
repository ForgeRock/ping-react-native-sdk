/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnprotect

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.pingidentity.android.ContextProvider
import com.pingidentity.logger.Logger
import com.pingidentity.protect.Protect
import com.pingidentity.protect.davinci.ProtectCollector
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

/**
 * Shared implementation for Protect operations on Android.
 */
object RNPingProtectCommon {
  private const val LOGGER_ID_KEY = "loggerId"

  /** Indicates whether shared runtime wiring has been initialized. */
  private var configured = false

  /** Coroutine scope for executing Protect operations asynchronously on the IO dispatcher. */
  private var scope: CoroutineScope = createScope()

  /**
   * Creates an IO-backed coroutine scope used for native bridge operations.
   *
   * @return Fresh coroutine scope with supervisor semantics.
   */
  private fun createScope(): CoroutineScope {
    return CoroutineScope(SupervisorJob() + Dispatchers.IO)
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
  )

  /**
   * Configure application context required by Ping native SDKs.
   */
  @JvmStatic
  @Synchronized
  fun configure(reactContext: ReactApplicationContext) {
    ContextProvider.init(reactContext.applicationContext)
    if (!configured) {
      scope = createScope()
      configured = true
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
    // TODO: call Protect SDK teardown here once a public cleanup API is available.
    // Currently com.pingidentity.protect.Protect exposes no shutdown method.
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
      logger?.d("Protect initialize succeeded")
      promise.resolve(null)
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
    return ProtectInitConfig(
      envId = envId,
      isBehavioralDataCollection = isBehavioralDataCollection,
      isLazyMetadata = isLazyMetadata,
      customHost = customHost,
      isConsoleLogEnabled = isConsoleLogEnabled,
      deviceAttributesToIgnore = deviceAttributesToIgnore,
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

}
