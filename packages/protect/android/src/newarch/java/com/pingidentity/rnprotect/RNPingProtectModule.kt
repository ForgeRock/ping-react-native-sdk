/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnprotect

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the Protect API on Android.
 */
@ReactModule(name = RNPingProtectModule.NAME)
class RNPingProtectModule(reactContext: ReactApplicationContext) :
  NativeRNPingProtectSpec(reactContext) {

  init {
    RNPingProtectCommon.configure(reactContext)
  }

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  /**
   * Clean up common runtime state when the module is invalidated.
   */
  override fun invalidate() {
    RNPingProtectCommon.cleanup()
    super.invalidate()
  }

  /**
   * Runs Protect SDK data collection for the active `ProtectCollector` in a DaVinci flow.
   */
  override fun collectForDaVinci(
    davinciId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    RNPingProtectCommon.collectForDaVinci(davinciId, options, config, promise)
  }

  /**
   * Initializes the Protect SDK with the provided configuration.
   */
  override fun initialize(protectConfig: ReadableMap, config: ReadableMap, promise: Promise) {
    RNPingProtectCommon.initialize(protectConfig, config, promise)
  }

  /**
   * Pauses behavioral data collection.
   */
  override fun pauseBehavioralData(config: ReadableMap, promise: Promise) {
    RNPingProtectCommon.pauseBehavioralData(config, promise)
  }

  /**
   * Resumes behavioral data collection.
   */
  override fun resumeBehavioralData(config: ReadableMap, promise: Promise) {
    RNPingProtectCommon.resumeBehavioralData(config, promise)
  }

  companion object {
    const val NAME = "RNPingProtect"
  }
}
