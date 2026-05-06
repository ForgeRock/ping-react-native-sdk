/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnexternalidp

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the External IdP API on Android.
 */
@ReactModule(name = RNPingExternalIdpModule.NAME)
class RNPingExternalIdpModule(reactContext: ReactApplicationContext) :
  NativeRNPingExternalIdpSpec(reactContext) {

  init {
    RNPingExternalIdpCommon.configure(reactContext)
  }

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  /**
   * Clean up common runtime state when the module is invalidated.
   */
  override fun invalidate() {
    RNPingExternalIdpCommon.cleanup()
    super.invalidate()
  }

  /**
   * Launches the external IdP authorization flow for an active Journey IdpCallback.
   */
  override fun authorizeForJourney(
    journeyId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    RNPingExternalIdpCommon.authorizeForJourney(journeyId, options, config, promise)
  }

  /**
   * Mutates the native SelectIdpCallback state for an active Journey before journey.next().
   */
  override fun selectProviderForJourney(
    journeyId: String,
    provider: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    RNPingExternalIdpCommon.setSelectedProvider(journeyId, provider, options, config, promise)
  }

  companion object {
    const val NAME = "RNPingExternalIdp"
  }
}
