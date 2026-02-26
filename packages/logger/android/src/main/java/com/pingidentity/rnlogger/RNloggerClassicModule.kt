/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
package com.pingidentity.rnlogger

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * Classic (non-Turbo) React Native module for PingLogger.
 * This module is used when the New Architecture is disabled.
 *
 * @param reactContext The React application context
 */
@ReactModule(name = RNloggerClassicModule.NAME)
class RNloggerClassicModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "LoggerClassic"
  }

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  /**
   * Registers a logger with the provided configuration.
   * This is a synchronous method that blocks until the logger is registered.
   *
   * @param config The configuration map for the logger
   * @return A string representing the registration result
   */
  @ReactMethod(isBlockingSynchronousMethod = true)
  fun registerLogger(config: ReadableMap): String {
    return RNPingLoggerCommon.configure(config)
  }

  /**
   * Synchronizes the logger with the provided configuration.
   * This is an asynchronous method.
   *
   * @param config The configuration map for the logger
   */
  @ReactMethod
  fun syncLogger(config: ReadableMap) {
    RNPingLoggerCommon.sync(config)
  }
}
