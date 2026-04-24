/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnexternalidp

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * Classic (Old Architecture) entry point for the External IdP API on Android.
 *
 * All operations are delegated to [RNPingExternalIdpCommon] for shared implementation.
 *
 * @param reactContext The React Native application context.
 */
@ReactModule(name = RNPingExternalIdpClassicModule.NAME)
class RNPingExternalIdpClassicModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  init {
    RNPingExternalIdpCommon.configure(reactContext)
  }

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  /**
   * Launches the external IdP authorization flow for an active Journey IdpCallback.
   *
   * @param journeyId Native Journey instance id.
   * @param options Per-call options payload (index).
   * @param config Per-call configuration payload (loggerId, redirectUri).
   * @param promise React Native promise resolved with ExternalIdpResult or rejected on error.
   */
  @ReactMethod
  fun authorizeForJourney(
    journeyId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    RNPingExternalIdpCommon.authorizeForJourney(journeyId, options, config, promise)
  }

  /**
   * Mutates the native SelectIdpCallback state for an active Journey before journey.next().
   *
   * @param journeyId Native Journey instance id.
   * @param provider The provider string selected by the user.
   * @param options Per-call options payload (index).
   * @param config Per-call configuration payload (loggerId).
   * @param promise React Native promise resolved on success or rejected on error.
   */
  @ReactMethod
  fun selectProviderForJourney(
    journeyId: String,
    provider: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    RNPingExternalIdpCommon.setSelectedProvider(journeyId, provider, options, config, promise)
  }

  companion object {
    const val NAME = "RNPingExternalIdpClassic"
  }
}
