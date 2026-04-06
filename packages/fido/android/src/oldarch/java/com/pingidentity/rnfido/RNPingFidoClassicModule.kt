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
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Classic (Old Architecture) entry point for the FIDO API on Android.
 *
 * This module provides React Native bindings for device identification functionality
 * on the Classic Architecture. All operations are delegated to [RNPingFidoCommon]
 * for shared implementation.
 *
 * @param reactContext The React Native application context.
 */
@ReactModule(name = RNPingFidoClassicModule.NAME)
class RNPingFidoClassicModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  init {
    RNPingFidoCommon.configure(reactContext)
  }

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  /**
   * Registers a new FIDO credential.
   *
   * @param options Registration options payload.
   * @param promise React Native promise to resolve with the registration result or reject on error.
   */
  @ReactMethod
  fun registerCredential(options: ReadableMap, promise: Promise) {
    RNPingFidoCommon.register(options, promise)
  }

  /**
   * Authenticates with an existing FIDO credential.
   *
   * @param options Authentication options payload.
   * @param promise React Native promise to resolve with the authentication result or reject on error.
   */
  @ReactMethod
  fun authenticateCredential(options: ReadableMap, promise: Promise) {
    RNPingFidoCommon.authenticate(options, promise)
  }

  /**
   * Executes a Journey-scoped FIDO registration callback.
   *
   * @param journeyId Native Journey instance id.
   * @param options Registration callback execution options.
   * @param promise React Native promise for callback execution result.
   */
  @ReactMethod
  fun registerCredentialForJourney(journeyId: String, options: ReadableMap, promise: Promise) {
    RNPingFidoCommon.registerForJourney(journeyId, options, promise)
  }

  /**
   * Executes a Journey-scoped FIDO authentication callback.
   *
   * @param journeyId Native Journey instance id.
   * @param options Authentication callback execution options.
   * @param promise React Native promise for callback execution result.
   */
  @ReactMethod
  fun authenticateCredentialForJourney(journeyId: String, options: ReadableMap, promise: Promise) {
    RNPingFidoCommon.authenticateForJourney(journeyId, options, promise)
  }

  companion object {
    const val NAME = "RNPingFidoClassic"
  }
}
