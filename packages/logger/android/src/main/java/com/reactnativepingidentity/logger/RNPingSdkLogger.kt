/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.logger

import android.util.Log
import com.pingidentity.logger.Logger
import com.reactnativepingidentity.logger.BuildConfig

/**
 * Custom logger implementation that tags logs with the RN SDK version.
 */
object RNPingSdkLogger {

  private const val TAG_PREFIX = "RNPingSDK v"
  private val tag = "$TAG_PREFIX${BuildConfig.VERSION_NAME.ifBlank { "unknown" }}"

  /** Standard logger that emits all log levels. */
  val standard: Logger = object : Logger {
    override fun d(message: String) {
      logChunks(message) { chunk -> Log.d(tag, chunk) }
    }

    override fun i(message: String) {
      Log.i(tag, message)
    }

    override fun w(message: String, throwable: Throwable?) {
      Log.w(tag, message, throwable)
    }

    override fun e(message: String, throwable: Throwable?) {
      Log.e(tag, message, throwable)
    }
  }

  /** Warning-only logger that suppresses debug and info output. */
  val warn: Logger = object : Logger {
    override fun d(message: String) {
      // no-op
    }

    override fun i(message: String) {
      // no-op
    }

    override fun w(message: String, throwable: Throwable?) {
      Log.w(tag, message, throwable)
    }

    override fun e(message: String, throwable: Throwable?) {
      Log.e(tag, message, throwable)
    }
  }

  private fun logChunks(message: String, write: (String) -> Unit) {
    if (message.length <= 4000) {
      write(message)
      return
    }
    var index = 0
    while (index < message.length) {
      val end = (index + 4000).coerceAtMost(message.length)
      write(message.substring(index, end))
      index = end
    }
  }
}
