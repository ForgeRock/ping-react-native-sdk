/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndeviceid

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.pingidentity.android.ContextProvider
import com.pingidentity.device.id.DeviceIdentifier
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Shared implementation for Device ID operations on Android.
 *
 * This object provides the core logic for device identification functionality,
 * used by both Classic and New Architecture React Native modules. All device ID
 * operations are executed asynchronously using coroutines on the IO dispatcher.
 */
object RNPingDeviceIdCommon {

  /** Coroutine scope for executing device ID operations asynchronously on the IO dispatcher. */
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  /**
   * Initialize the Ping Android SDK context provider.
   *
   * This must be called before any device ID operations to ensure the SDK
   * has access to the Android application context.
   *
   * @param reactContext The React Native application context.
   */
  @JvmStatic
  fun initialize(reactContext: ReactApplicationContext) {
    ContextProvider.init(reactContext.applicationContext)
  }

  /**
   * Return the default secure device identifier.
   *
   * @param promise React Native promise to resolve with the device identifier or reject on error.
   */
  @JvmStatic
  fun getDefaultDeviceId(promise: Promise) {
    resolveDeviceId(promise) { DeviceIdentifier.identifier.id() }
  }

  /**
   * Helper function to execute device ID resolution asynchronously.
   *
   * Launches a coroutine to retrieve the device identifier and handles promise resolution
   * or rejection based on the operation result.
   *
   * @param promise React Native promise to resolve or reject.
   * @param resolver Suspend function that retrieves the device identifier.
   */
  private fun resolveDeviceId(
    promise: Promise,
    resolver: suspend () -> String
  ) {
    scope.launch {
      try {
        val id = resolver()
        promise.resolve(id)
      } catch (e: Exception) {
        promise.reject("DEVICE_ID_ERROR", e.message, e)
      }
    }
  }

}
