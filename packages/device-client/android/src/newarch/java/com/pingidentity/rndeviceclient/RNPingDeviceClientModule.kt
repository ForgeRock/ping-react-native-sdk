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
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the Device Client API on Android (New Architecture).
 *
 * This module provides React Native bindings for device management functionality
 * on the New Architecture (TurboModules). All operations are delegated to
 * [RNPingDeviceClientCommon] for shared implementation.
 *
 * @param reactContext The React Native application context.
 */
@ReactModule(name = RNPingDeviceClientModule.NAME)
class RNPingDeviceClientModule(reactContext: ReactApplicationContext) :
  NativeRNPingDeviceClientSpec(reactContext) {

  init {
    RNPingDeviceClientCommon.configure(reactContext)
  }

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  /**
   * Create a new Device Client instance from the supplied configuration.
   *
   * @param config Configuration payload containing `serverUrl`, `ssoToken`, and optional fields.
   * @param promise React Native promise resolved with the opaque handle id.
   */
  override fun create(config: ReadableMap, promise: Promise) {
    RNPingDeviceClientCommon.create(config, promise)
  }

  /**
   * Retrieve all devices of the given type from the server.
   *
   * @param handleId Opaque handle id returned by [create].
   * @param deviceType One of `oath`, `push`, `bound`, `profile`, or `webAuthn`.
   * @param promise React Native promise resolved with the device list.
   */
  override fun get(handleId: String, deviceType: String, promise: Promise) {
    RNPingDeviceClientCommon.get(handleId, deviceType, promise)
  }

  /**
   * Update a device on the server.
   *
   * @param handleId Opaque handle id returned by [create].
   * @param deviceType One of `oath`, `push`, `bound`, `profile`, or `webAuthn`.
   * @param device Device payload with updated fields.
   * @param promise React Native promise resolved with the updated device.
   */
  override fun update(
    handleId: String,
    deviceType: String,
    device: ReadableMap,
    promise: Promise,
  ) {
    RNPingDeviceClientCommon.update(handleId, deviceType, device, promise)
  }

  /**
   * Delete a device from the server.
   *
   * @param handleId Opaque handle id returned by [create].
   * @param deviceType One of `oath`, `push`, `bound`, `profile`, or `webAuthn`.
   * @param device Device payload identifying the device to delete.
   * @param promise React Native promise resolved with the deleted device.
   */
  override fun deleteDevice(
    handleId: String,
    deviceType: String,
    device: ReadableMap,
    promise: Promise,
  ) {
    RNPingDeviceClientCommon.deleteDevice(handleId, deviceType, device, promise)
  }

  /**
   * Destroy a Device Client instance, removing it from the handle registry.
   *
   * @param handleId Opaque handle id returned by [create].
   * @param promise React Native promise resolved with null on success.
   */
  override fun dispose(handleId: String, promise: Promise) {
    RNPingDeviceClientCommon.dispose(handleId, promise)
  }

  companion object {
    /** Module name exposed to the React Native bridge. */
    const val NAME = "RNPingDeviceClient"
  }
}
