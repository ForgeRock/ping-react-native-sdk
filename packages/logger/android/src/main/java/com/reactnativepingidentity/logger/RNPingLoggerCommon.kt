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

object RNPingLoggerCommon {

  private const val TAG = "RNPingLoggerCommon"
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  private enum class NativeLoggerLevel {
    STANDARD,
    WARN,
    NONE,
  }

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
      NativeLoggerLevel.STANDARD -> Logger.STANDARD
      NativeLoggerLevel.WARN -> Logger.WARN
      NativeLoggerLevel.NONE -> Logger.NONE
    }
  }
}
