/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.reactnative.rndeviceid

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Classic (Old Architecture) entry point for the Device ID API on Android.
 *
 * This module provides React Native bindings for device identification functionality
 * on the Classic Architecture. All operations are delegated to [RNPingDeviceIdCommon]
 * for shared implementation.
 *
 * @param reactContext The React Native application context.
 */
@ReactModule(name = RNPingDeviceIdClassicModule.NAME)
class RNPingDeviceIdClassicModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  /**
   * Return the default secure device identifier.
   *
   * @param promise React Native promise to resolve with the device identifier or reject on error.
   */
  @ReactMethod
  fun getDefaultDeviceId(promise: Promise) {
    RNPingDeviceIdCommon.getDefaultDeviceId(promise)
  }

  companion object {
    const val NAME = "RNPingDeviceIdClassic"
  }
}
