/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnfido

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the FIDO API on Android.
 */
@ReactModule(name = RNPingFidoModule.NAME)
class RNPingFidoModule(reactContext: ReactApplicationContext) :
  NativeRNPingFidoSpec(reactContext) {

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  /**
   * Return the default FIDO identifier.
   */
  override fun getDefaultFido(promise: Promise) {
    RNPingFidoCommon.getDefaultFido(promise)
  }

  companion object {
    const val NAME = "RNPingFido"
  }
}
