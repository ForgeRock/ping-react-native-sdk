/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the FIDO API on Android.
 */
@ReactModule(name = RNPingFidoModule.NAME)
class RNPingFidoModule(reactContext: ReactApplicationContext) :
  NativeRNPingFidoSpec(reactContext) {

  init {
    RNPingFidoCommon.configure(reactContext)
  }

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  /**
   * Registers a new FIDO credential.
   */
  override fun registerCredential(options: ReadableMap, config: ReadableMap, promise: Promise) {
    RNPingFidoCommon.register(options, config, promise)
  }

  /**
   * Authenticates with an existing FIDO credential.
   */
  override fun authenticateCredential(options: ReadableMap, config: ReadableMap, promise: Promise) {
    RNPingFidoCommon.authenticate(options, config, promise)
  }

  /**
   * Executes a Journey-scoped FIDO registration callback.
   */
  override fun registerCredentialForJourney(
    journeyId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    RNPingFidoCommon.registerForJourney(journeyId, options, config, promise)
  }

  /**
   * Executes a Journey-scoped FIDO authentication callback.
   */
  override fun authenticateCredentialForJourney(
    journeyId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    RNPingFidoCommon.authenticateForJourney(journeyId, options, config, promise)
  }

  companion object {
    const val NAME = "RNPingFido"
  }
}
