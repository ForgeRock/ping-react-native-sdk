/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.reactnative.rndeviceid

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the Device ID API on Android.
 */
@ReactModule(name = RNPingDeviceIdModule.NAME)
class RNPingDeviceIdModule(reactContext: ReactApplicationContext) :
  NativeRNPingDeviceIdSpec(reactContext) {

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  /**
   * Return the default secure device identifier.
   */
  override fun getDefaultDeviceId(promise: Promise) {
    RNPingDeviceIdCommon.getDefaultDeviceId(promise)
  }

  companion object {
    const val NAME = "RNPingDeviceId"
  }
}
