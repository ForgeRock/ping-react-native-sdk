/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndeviceclient

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Classic (Old Architecture) entry point for the Device Client on Android.
 */
@ReactModule(name = RNPingDeviceClientClassicModule.NAME)
class RNPingDeviceClientClassicModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  init {
    RNPingDeviceClientCommon.configure(reactContext)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun create(config: ReadableMap, promise: Promise) {
    RNPingDeviceClientCommon.create(config, promise)
  }

  @ReactMethod
  fun get(handleId: String, deviceType: String, promise: Promise) {
    RNPingDeviceClientCommon.get(handleId, deviceType, promise)
  }

  @ReactMethod
  fun update(
    handleId: String,
    deviceType: String,
    device: ReadableMap,
    promise: Promise,
  ) {
    RNPingDeviceClientCommon.update(handleId, deviceType, device, promise)
  }

  @ReactMethod
  fun deleteDevice(
    handleId: String,
    deviceType: String,
    device: ReadableMap,
    promise: Promise,
  ) {
    RNPingDeviceClientCommon.deleteDevice(handleId, deviceType, device, promise)
  }

  @ReactMethod
  fun dispose(handleId: String, promise: Promise) {
    RNPingDeviceClientCommon.dispose(handleId, promise)
  }

  companion object {
    const val NAME = "RNPingDeviceClientClassic"
  }
}
