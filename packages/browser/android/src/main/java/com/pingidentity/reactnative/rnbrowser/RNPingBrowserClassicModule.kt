/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.reactnative.rnbrowser

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = RNPingBrowserClassicModule.NAME)
/**
 * Classic (non-Turbo) module entry point for the Browser API on Android.
 */
class RNPingBrowserClassicModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "RNPingBrowserClassic"
  }

  override fun getName(): String = NAME

  /**
   * Apply global browser configuration.
   */
  @ReactMethod
  fun configure(config: ReadableMap) {
    RNPingBrowserCommon.configure(config, reactApplicationContext)
  }

  /**
   * Launch a browser session.
   */
  @ReactMethod
  fun open(url: String, options: ReadableMap, promise: Promise) {
    RNPingBrowserCommon.open(url, options, promise)
  }

  /**
   * Reset any in-flight browser session (no-op on Android).
   */
  @ReactMethod
  fun reset() {
    RNPingBrowserCommon.reset()
  }
}
