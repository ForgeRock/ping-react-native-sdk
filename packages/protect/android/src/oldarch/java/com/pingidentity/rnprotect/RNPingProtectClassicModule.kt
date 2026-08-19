/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnprotect

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * Classic (Old Architecture) entry point for the Protect API on Android.
 *
 * All operations are delegated to [RNPingProtectCommon] for shared implementation.
 *
 * @param reactContext The React Native application context.
 */
@ReactModule(name = RNPingProtectClassicModule.NAME)
class RNPingProtectClassicModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

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
   *
   * @param davinciId Native DaVinci instance id.
   * @param options Per-call options payload (index).
   * @param config Per-client runtime configuration payload (loggerId).
   * @param promise React Native promise resolved on success or rejected on error.
   */
  @ReactMethod
  fun collectForDaVinci(
    davinciId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    RNPingProtectCommon.collectForDaVinci(davinciId, options, config, promise)
  }

  /**
   * Initializes the Protect SDK with the provided configuration.
   *
   * @param protectConfig Protect SDK initialization config payload.
   * @param config Per-client runtime configuration payload (loggerId).
   * @param promise React Native promise resolved on success or rejected on error.
   */
  @ReactMethod
  fun initialize(protectConfig: ReadableMap, config: ReadableMap, promise: Promise) {
    RNPingProtectCommon.initialize(protectConfig, config, promise)
  }

  /**
   * Pauses behavioral data collection.
   *
   * @param config Per-client runtime configuration payload (loggerId).
   * @param promise React Native promise resolved on success or rejected on error.
   */
  @ReactMethod
  fun pauseBehavioralData(config: ReadableMap, promise: Promise) {
    RNPingProtectCommon.pauseBehavioralData(config, promise)
  }

  /**
   * Resumes behavioral data collection.
   *
   * @param config Per-client runtime configuration payload (loggerId).
   * @param promise React Native promise resolved on success or rejected on error.
   */
  @ReactMethod
  fun resumeBehavioralData(config: ReadableMap, promise: Promise) {
    RNPingProtectCommon.resumeBehavioralData(config, promise)
  }

  companion object {
    const val NAME = "RNPingProtectClassic"
  }
}
