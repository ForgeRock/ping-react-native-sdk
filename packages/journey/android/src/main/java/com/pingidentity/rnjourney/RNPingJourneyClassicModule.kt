/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * Classic (non-Turbo) module entry point for Journey APIs on Android.
 */
@ReactModule(name = RNPingJourneyClassicModule.NAME)
class RNPingJourneyClassicModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  init {
    RNPingJourneyCommon.configure(reactContext)
  }

  override fun getName(): String = NAME

  override fun invalidate() {
    RNPingJourneyCommon.cleanup()
    super.invalidate()
  }

  /**
   * Configure a new Journey client and return its internal identifier.
   */
  @ReactMethod
  fun configureJourney(config: ReadableMap, promise: Promise) {
    RNPingJourneyCommon.configureJourney(config, promise)
  }

  /**
   * Start a Journey by name.
   */
  @ReactMethod
  fun start(journeyId: String, journeyName: String, options: ReadableMap?, promise: Promise) {
    RNPingJourneyCommon.start(journeyId, journeyName, options, promise)
  }

  /**
   * Progress an active Journey node.
   */
  @ReactMethod
  fun next(journeyId: String, nodeId: String, input: ReadableMap, promise: Promise) {
    RNPingJourneyCommon.next(journeyId, input, promise)
  }

  /**
   * Resume a suspended Journey flow.
   */
  @ReactMethod
  fun resume(journeyId: String, uri: String, promise: Promise) {
    RNPingJourneyCommon.resume(journeyId, uri, promise)
  }

  /**
   * Resolve active user session details.
   */
  @ReactMethod
  fun getSession(journeyId: String, promise: Promise) {
    RNPingJourneyCommon.getSession(journeyId, promise)
  }

  /**
   * Logout the active Journey user.
   */
  @ReactMethod
  fun logout(journeyId: String, promise: Promise) {
    RNPingJourneyCommon.logout(journeyId, promise)
  }

  /**
   * Dispose a Journey instance and clear native state.
   */
  @ReactMethod
  fun dispose(journeyId: String, promise: Promise) {
    RNPingJourneyCommon.dispose(journeyId, promise)
  }

  companion object {
    const val NAME = "RNPingJourneyClassic"
  }
}
