/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
package com.pingidentity.rnlogger

import android.util.Log
import com.facebook.react.bridge.ReadableMap
import com.pingidentity.logger.Logger
import com.pingidentity.logger.NONE
import com.pingidentity.logger.STANDARD
import com.pingidentity.logger.WARN
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.logger.LoggerHandleContract
import com.pingidentity.rncore.registry.NativeHandle
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
  private class LoggerHandle(
    @Volatile var level: NativeLoggerLevel
  ) : NativeHandle, LoggerHandleContract {
    override val loggerLevel: String
      get() = level.name

    override val nativeLogger: Any = object : Logger {
      override fun d(message: String) {
        nativeLoggerForLevel(level).d(message)
      }

      override fun i(message: String) {
        nativeLoggerForLevel(level).i(message)
      }

      override fun w(message: String, throwable: Throwable?) {
        nativeLoggerForLevel(level).w(message, throwable)
      }

      override fun e(message: String, throwable: Throwable?) {
        nativeLoggerForLevel(level).e(message, throwable)
      }
    }
  }

  /**
   * Configures the logger synchronously with the provided configuration.
   *
   * @param config A ReadableMap containing the logger configuration with a "level" key
   * @return The unique identifier (ID) for the registered logger
   */
  @JvmStatic
  fun configure(config: ReadableMap): String {
    val level = parseLevel(config.getString("level")) ?: NativeLoggerLevel.NONE
    val handle = LoggerHandle(level)
    Logger.logger = handle.nativeLogger as Logger

    return runBlocking(Dispatchers.IO) {
      CoreRuntime.loggerRegistry.register(handle)
    }
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
      Log.w(TAG, "syncLogger called with missing required value")
      return
    }
    if (level.isNullOrBlank()) {
      Log.w(TAG, "syncLogger called without level for logger request")
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
        Log.w(TAG, "Logger is not available")
        return@launch
      }

      handle.level = parsed
      Logger.logger = handle.nativeLogger as Logger
    }
  }

  /**
   * Resolve a native logger instance for a registered logger id.
   *
   * @param id Logger identifier returned by the JS logger module
   * @return Native logger instance or null when id is missing/unknown
   */
  @JvmStatic
  fun resolveLogger(id: String?): com.pingidentity.logger.Logger? {
    if (id.isNullOrBlank()) {
      return null
    }

    val handle = runBlocking(Dispatchers.IO) {
      CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandle
    }
    if (handle == null) {
      Log.w(TAG, "Logger is not available")
      return false
    }

    return handle.nativeLogger as? Logger
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
   * Map internal level values to concrete Ping logger implementations.
   */
  private fun nativeLoggerForLevel(level: NativeLoggerLevel): com.pingidentity.logger.Logger {
    return when (level) {
      NativeLoggerLevel.STANDARD -> Logger.STANDARD
      NativeLoggerLevel.WARN -> Logger.WARN
      NativeLoggerLevel.NONE -> Logger.NONE
    }
  }
}
