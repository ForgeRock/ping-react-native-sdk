/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
package com.reactnativepingidentity.logger

import android.util.Log
import com.facebook.react.bridge.ReadableMap
import com.pingidentity.logger.Logger
import com.pingidentity.logger.NONE
import com.pingidentity.logger.STANDARD
import com.pingidentity.logger.WARN
import com.reactnativepingidentity.core.CoreRuntime
import com.reactnativepingidentity.core.registry.NativeHandle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

/**
 * Common logger functionality for managing logger instances across the React Native bridge.
 * Handles synchronization of logger configuration from JavaScript to native Kotlin.
 *
 * This object provides methods to configure and synchronize logger settings,
 * managing the lifecycle of logger instances through the CoreRuntime registry.
 */
object RNPingLoggerCommon {

  private const val TAG = "RNPingLoggerCommon"
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  /**
   * Native logger levels supported by the PingIdentity Logger.
   */
  private enum class NativeLoggerLevel {
    /** Standard logging level - logs all messages */
    STANDARD,
    /** Warning logging level - logs warnings and errors only */
    WARN,
    /** No logging - disables all log output */
    NONE,
  }

  /**
   * Handle for storing logger configuration in the registry.
   *
   * @property level The log level for this logger instance
   */
  private class LoggerHandle(var level: NativeLoggerLevel) : NativeHandle

  /**
   * Configures the logger synchronously with the provided configuration.
   *
   * @param config A ReadableMap containing the logger configuration with a "level" key
   * @return The unique identifier (ID) for the registered logger
   */
  @JvmStatic
  fun configure(config: ReadableMap): String {
    val level = parseLevel(config.getString("level")) ?: NativeLoggerLevel.NONE

    val id = runBlocking(Dispatchers.IO) {
      CoreRuntime.loggerRegistry.register(LoggerHandle(level))
    }

    applyNativeLevel(level)
    return id
  }

  /**
   * Synchronizes the logger configuration asynchronously.
   *
   * Updates the logger level for a previously registered logger identified by its ID.
   *
   * @param config A ReadableMap containing "id" and "level" keys
   */
  @JvmStatic
  fun sync(config: ReadableMap) {
    val id = config.getString("id")
    val level = config.getString("level")

    if (id.isNullOrBlank()) {
      Log.w(TAG, "syncLogger called without id")
      return
    }
    if (level.isNullOrBlank()) {
      Log.w(TAG, "syncLogger called without level for id $id")
      return
    }

    val parsed = parseLevel(level)
    if (parsed == null) {
      Log.w(TAG, "Invalid level '$level'")
      return
    }

    scope.launch {
      val handle = CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandle
      if (handle == null) {
        Log.w(TAG, "No logger registered for id $id")
        return@launch
      }

      handle.level = parsed
      applyNativeLevel(parsed)
    }
  }

  /**
   * Apply a previously registered logger by id.
   *
   * @param id Logger identifier returned by the JS logger module
   * @return True when the logger was resolved and applied
   */
  @JvmStatic
  fun applyLogger(id: String?): Boolean {
    if (id.isNullOrBlank()) {
      return false
    }

    val handle = runBlocking(Dispatchers.IO) {
      CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandle
    }
    if (handle == null) {
      Log.w(TAG, "No logger registered for id $id")
      return false
    }

    applyNativeLevel(handle.level)
    return true
  }

  /**
   * Parses a string representation of a log level into a NativeLoggerLevel enum.
   *
   * @param level The string representation of the log level ("STANDARD", "WARN", or "NONE")
   * @return The corresponding NativeLoggerLevel enum value, or null if invalid
   */
  private fun parseLevel(level: String?): NativeLoggerLevel? {
    return when (level) {
      "STANDARD" -> NativeLoggerLevel.STANDARD
      "WARN" -> NativeLoggerLevel.WARN
      "NONE" -> NativeLoggerLevel.NONE
      else -> null
    }
  }

  /**
   * Applies the native logger level to the PingIdentity Logger.
   *
   * @param level The NativeLoggerLevel to apply
   */
  private fun applyNativeLevel(level: NativeLoggerLevel) {
    Logger.logger = when (level) {
      NativeLoggerLevel.STANDARD -> RNPingSdkLogger.standard
      NativeLoggerLevel.WARN -> RNPingSdkLogger.warn
      NativeLoggerLevel.NONE -> Logger.NONE
    }
  }
}
