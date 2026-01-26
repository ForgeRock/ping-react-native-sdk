package com.pingidentity.rndeviceprofile

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray

class RNPingDeviceProfileModule(reactContext: ReactApplicationContext) :
  NativeRNPingDeviceProfileSpec(reactContext) {

  /**
   * Collect a device profile outside of Journey flows.
   */
  override fun collectDeviceProfile(collectors: ReadableArray, promise: Promise) {
    promise.reject(
      "NOT_IMPLEMENTED",
      "Device Profile native collection is not yet available."
    )
  }

  /**
   * Collect a device profile as part of a Journey callback.
   */
  override fun collectDeviceProfileForJourney(
    journeyId: String,
    collectors: ReadableArray,
    promise: Promise
  ) {
    promise.reject(
      "NOT_IMPLEMENTED",
      "Device Profile native Journey collection is not yet available."
    )
  }

  companion object {
    const val NAME = NativeRNPingDeviceProfileSpec.NAME
  }
}
