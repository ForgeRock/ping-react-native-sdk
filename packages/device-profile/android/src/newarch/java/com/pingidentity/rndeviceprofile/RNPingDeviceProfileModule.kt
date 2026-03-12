/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndeviceprofile

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray

/**
 * React Native module for collecting device profile information.
 *
 * This module provides functionality to collect device profile data both independently
 * and as part of Journey authentication flows. It supports various collectors for
 * platform, hardware, network, telephony, browser, bluetooth, and location data.
 *
 * @param reactContext The React Native application context.
 */
class RNPingDeviceProfileModule(reactContext: ReactApplicationContext) :
  NativeRNPingDeviceProfileSpec(reactContext) {

  /**
   * Collects device profile information outside of Journey flows.
   *
   * This method gathers device profile data based on the specified collectors and returns
   * the result as a JSON object. The collection includes location data if the location
   * collector is specified.
   *
   * @param collectorNames Array of collector names to use (e.g., "platform", "hardware", "network").
   * @param promise React Native promise that resolves with the collected device profile data or rejects with an error.
   */
  override fun collectDeviceProfile(
    collectorNames: ReadableArray,
    promise: Promise
  ) {
    RNPingDeviceProfileCommon.collectDeviceProfile(collectorNames, promise)
  }

  /**
   * Collects device profile information as part of a Journey authentication flow.
   *
   * This method gathers device profile data specifically for Journey callbacks, using the
   * active DeviceProfileCallback from the current Journey node to ensure the profile is
   * bound to the correct Journey instance.
   *
   * @param journeyId The unique identifier for the Journey flow.
   * @param collectorNames Array of collector names to use for profile collection.
   * @param loggerId Optional native logger handle id.
   * @param promise React Native promise that resolves with the collected device profile result or rejects with an error.
   */
  override fun collectDeviceProfileForJourney(
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

  companion object {
    const val NAME = NativeRNPingDeviceProfileSpec.NAME
  }
}
