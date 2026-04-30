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
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the Binding module (New Architecture / Fabric).
 *
 * Delegates all operations to [RNPingBindingCommon].
 */
@ReactModule(name = RNPingBindingModule.NAME)
class RNPingBindingModule(reactContext: ReactApplicationContext) :
  NativeRNPingBindingSpec(reactContext) {

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
  override fun bindForJourney(
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
  override fun signForJourney(
    journeyId: String,
    options: ReadableMap,
    config: ReadableMap,
    promise: Promise
  ) {
    RNPingBindingCommon.signForJourney(journeyId, options, config, promise)
  }

  override fun resolvePin(requestId: String, pin: String) {
    RNPingBindingCommon.resolvePin(requestId, pin)
  }

  override fun cancelPin(requestId: String) {
    RNPingBindingCommon.cancelPin(requestId)
  }

  override fun selectUserKey(requestId: String, keyId: String) {
    RNPingBindingCommon.selectUserKey(requestId, keyId)
  }

  override fun cancelUserKey(requestId: String) {
    RNPingBindingCommon.cancelUserKey(requestId)
  }

  override fun getAllKeys(promise: Promise) {
    RNPingBindingCommon.getAllKeys(promise)
  }

  override fun deleteKey(userId: String, keyId: String, promise: Promise) {
    RNPingBindingCommon.deleteKey(userId, keyId, promise)
  }

  override fun deleteAllKeys(promise: Promise) {
    RNPingBindingCommon.deleteAllKeys(promise)
  }

  companion object {
    const val NAME = "RNPingBinding"
  }
}
