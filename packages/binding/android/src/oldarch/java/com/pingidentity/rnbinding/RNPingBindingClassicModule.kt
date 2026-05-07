/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnbinding

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Classic bridge entry point for the Binding module (legacy architecture).
 *
 * Delegates all operations to [RNPingBindingCommon].
 */
@ReactModule(name = RNPingBindingClassicModule.NAME)
class RNPingBindingClassicModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  init {
    RNPingBindingCommon.configure(reactContext)
  }

  override fun getName(): String = NAME

  /**
   * Executes a Journey-scoped DeviceBindingCallback.
   *
   * @param journeyId Native Journey instance id.
   * @param options Bind callback execution options.
   * @param config Per-client binding runtime configuration.
   * @param promise React Native promise.
   */
  @ReactMethod
  fun bindForJourney(
    journeyId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    RNPingBindingCommon.bindForJourney(journeyId, options, config, promise)
  }

  /**
   * Executes a Journey-scoped DeviceSigningVerifierCallback.
   *
   * @param journeyId Native Journey instance id.
   * @param options Sign callback execution options.
   * @param config Per-client binding runtime configuration.
   * @param promise React Native promise.
   */
  @ReactMethod
  fun signForJourney(
    journeyId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    RNPingBindingCommon.signForJourney(journeyId, options, config, promise)
  }

  @ReactMethod
  fun resolvePin(requestId: String, pin: String) {
    RNPingBindingCommon.resolvePin(requestId, pin)
  }

  @ReactMethod
  fun cancelPin(requestId: String) {
    RNPingBindingCommon.cancelPin(requestId)
  }

  @ReactMethod
  fun selectUserKey(requestId: String, keyId: String) {
    RNPingBindingCommon.selectUserKey(requestId, keyId)
  }

  @ReactMethod
  fun cancelUserKey(requestId: String) {
    RNPingBindingCommon.cancelUserKey(requestId)
  }

  @ReactMethod
  fun getAllKeys(promise: Promise) {
    RNPingBindingCommon.getAllKeys(promise)
  }

  @ReactMethod
  fun deleteKey(userId: String, keyId: String, promise: Promise) {
    RNPingBindingCommon.deleteKey(userId, keyId, promise)
  }

  @ReactMethod
  fun deleteAllKeys(promise: Promise) {
    RNPingBindingCommon.deleteAllKeys(promise)
  }

  companion object {
    const val NAME = "RNPingBindingClassic"
  }
}
