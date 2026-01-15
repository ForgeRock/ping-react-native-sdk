/*
 * Copyright (c) 2025 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.browser

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = RNPingBrowserModule.NAME)
/**
 * TurboModule entry point for the Browser API on Android.
 */
class RNPingBrowserModule(reactContext: ReactApplicationContext) :
  NativeRNPingBrowserSpec(reactContext) {

  /**
   * Expose the module name to React Native.
   */
  override fun getName(): String = NAME

  /**
   * Apply global browser configuration.
   */
  override fun configure(config: ReadableMap) {
    RNPingBrowserCommon.configure(config, reactApplicationContext)
  }

  /**
   * Launch a browser session.
   */
  override fun open(url: String, options: ReadableMap, promise: Promise) {
    RNPingBrowserCommon.open(url, options, promise)
  }

  companion object {
    const val NAME = "RNPingBrowser"
  }
}
