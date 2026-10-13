/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnprotect

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
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
   * Runs PingOne Protect data collection for a Journey evaluation callback.
   */
  override fun collectForJourney(
    journeyId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    RNPingProtectCommon.collectForJourney(journeyId, options, config, promise)
  }

  /**
   * Executes a Journey initialize callback using the configuration carried by the callback.
   */
  override fun initializeForJourney(journeyId: String, config: ReadableMap, promise: Promise) {
    RNPingProtectCommon.initializeForJourney(journeyId, config, promise)
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

  /**
   * Registers the Protect collector serializer with the shared DaVinci mapper.
   */
  override fun registerDaVinciSerializer(promise: Promise) {
    RNPingProtectCommon.registerDaVinciSerializer()
    promise.resolve(null)
  }

  /**
   * Resolves without action: the native Android SDK registers its Journey Protect callbacks
   * at app launch through the `androidx.startup` initializer declared in its manifest.
   * The method exists so the shared TurboModule spec is implemented on both platforms.
   */
  override fun registerJourneyCallbacks(promise: Promise) {
    promise.resolve(null)
  }

  companion object {
    const val NAME = RNPingProtectCommon.MODULE_NAME
  }
}
