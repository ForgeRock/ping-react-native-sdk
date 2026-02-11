/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
package com.pingidentity.reactnative.rnlogger

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * Turbo Module implementation for PingLogger.
 * This module is used when the New Architecture is enabled.
 *
 * @param reactContext The React application context
 */
@ReactModule(name = RNPingLoggerModule.NAME)
class RNPingLoggerModule(reactContext: ReactApplicationContext) :
  NativeRNPingLoggerSpec(reactContext) {

  override fun getName(): String {
    return NAME
  }

  override fun registerLogger(config: ReadableMap): String {
    return RNPingLoggerCommon.configure(config)
  }

  override fun syncLogger(config: ReadableMap) {
    RNPingLoggerCommon.sync(config)
  }

  companion object {
    const val NAME = "Logger"
  }
}
