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

  /**
   * Exposes the module name used by React Native legacy bridge registration.
   *
   * @return Registered legacy module name.
   */
  override fun getName(): String = NAME

  /**
   * Clears shared Journey runtime state when the module is invalidated.
   */
  override fun invalidate() {
    RNPingJourneyCommon.cleanup()
    super.invalidate()
  }

  /**
   * Configure a new Journey client and return its internal identifier.
   *
   * @param config Journey configuration payload from JavaScript.
   * @param promise Promise resolved with the created journey id.
   */
  @ReactMethod
  fun configureJourney(config: ReadableMap, promise: Promise) {
    RNPingJourneyCommon.configureJourney(config, promise)
  }

  /**
   * Start a Journey by name.
   *
   * @param journeyId Native journey client id.
   * @param journeyName Journey/tree name to execute.
   * @param options Optional start flags.
   * @param promise Promise resolved with the first node payload.
   */
  @ReactMethod
  fun start(journeyId: String, journeyName: String, options: ReadableMap?, promise: Promise) {
    RNPingJourneyCommon.start(journeyId, journeyName, options, promise)
  }

  /**
   * Progress an active Journey node.
   *
   * @param journeyId Native journey client id.
   * @param nodeId Legacy node id argument kept for bridge compatibility.
   * @param input Callback mutation payload for `next()`.
   * @param promise Promise resolved with the next node payload.
   */
  @ReactMethod
  fun next(journeyId: String, nodeId: String, input: ReadableMap, promise: Promise) {
    RNPingJourneyCommon.next(journeyId, input, promise)
  }

  /**
   * Resume a suspended Journey flow.
   *
   * @param journeyId Native journey client id.
   * @param uri Resume URI returned by external redirect/magic-link flow.
   * @param promise Promise resolved with the resumed node payload.
   */
  @ReactMethod
  fun resume(journeyId: String, uri: String, promise: Promise) {
    RNPingJourneyCommon.resume(journeyId, uri, promise)
  }

  /**
   * Resolve active user session details.
   *
   * @param journeyId Native journey client id.
   * @param promise Promise resolved with session payload or null.
   */
  @ReactMethod
  fun getSession(journeyId: String, promise: Promise) {
    RNPingJourneyCommon.getSession(journeyId, promise)
  }

  /**
   * Logout the active Journey user.
   *
   * @param journeyId Native journey client id.
   * @param promise Promise resolved when logout completes.
   */
  @ReactMethod
  fun logout(journeyId: String, promise: Promise) {
    RNPingJourneyCommon.logout(journeyId, promise)
  }

  /**
   * Dispose a Journey instance and clear native state.
   *
   * @param journeyId Native journey client id.
   * @param promise Promise resolved when disposal completes.
   */
  @ReactMethod
  fun dispose(journeyId: String, promise: Promise) {
    RNPingJourneyCommon.dispose(journeyId, promise)
  }

  companion object {
    /** Name used for React Native legacy-module registration. */
    const val NAME = "RNPingJourneyClassic"
  }
}
