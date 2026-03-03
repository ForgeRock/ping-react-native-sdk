/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndeviceprofile

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Classic (non-Turbo) module entry point for Device Profile on Android.
 */
@ReactModule(name = RNPingDeviceProfileClassicModule.NAME)
class RNPingDeviceProfileClassicModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "RNPingDeviceProfileClassic"
  }

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  /**
   * Collect device profile information outside of Journey flows.
   *
   * @param collectorNames Array of collector names to use.
   * @param promise React Native promise that resolves with the collected device profile data or rejects with an error.
   */
  @ReactMethod
  fun collectDeviceProfile(
    collectorNames: ReadableArray,
    promise: Promise
  ) {
    RNPingDeviceProfileCommon.collectDeviceProfile(collectorNames, promise)
  }

  /**
   * Collect device profile information for Journey callbacks.
   *
   * @param journeyId The unique identifier for the Journey flow.
   * @param collectorNames Array of collector names to use for profile collection.
   * @param loggerId Optional native logger handle id.
   * @param promise React Native promise that resolves with the collected device profile result or rejects with an error.
   */
  @ReactMethod
  fun collectDeviceProfileForJourney(
    journeyId: String,
    collectorNames: ReadableArray,
    loggerId: String?,
    promise: Promise
  ) {
    RNPingDeviceProfileCommon.collectDeviceProfileForJourney(
      journeyId,
      collectorNames,
      loggerId,
      promise
    )
  }
}
