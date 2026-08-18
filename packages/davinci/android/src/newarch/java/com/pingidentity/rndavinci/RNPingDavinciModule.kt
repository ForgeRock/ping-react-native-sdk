/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rndavinci

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the DaVinci API on Android.
 */
@ReactModule(name = RNPingDavinciModule.NAME)
class RNPingDavinciModule(reactContext: ReactApplicationContext) :
  NativeRNPingDavinciSpec(reactContext) {

  init {
    RNPingDavinciCommon.configure()
  }

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  /**
   * Clean up common runtime state when the module is invalidated.
   */
  override fun invalidate() {
    RNPingDavinciCommon.cleanup()
    super.invalidate()
  }

  /**
   * Configure a new DaVinci client and return its internal identifier.
   *
   * @param config DaVinci configuration payload from JavaScript.
   * @param promise Promise resolved with the created davinciId.
   */
  override fun configureDaVinci(config: ReadableMap, promise: Promise) {
    RNPingDavinciCommon.configureDaVinci(config, promise)
  }

  /**
   * Start the DaVinci flow.
   *
   * @param davinciId Native DaVinci client id.
   * @param promise Promise resolved with the first node payload.
   */
  override fun start(davinciId: String, promise: Promise) {
    RNPingDavinciCommon.start(davinciId, promise)
  }

  /**
   * Advance the active DaVinci flow node.
   *
   * @param davinciId Native DaVinci client id.
   * @param input Key-indexed collector values.
   * @param promise Promise resolved with the next node payload.
   */
  override fun next(davinciId: String, input: ReadableMap, promise: Promise) {
    RNPingDavinciCommon.next(davinciId, input, promise)
  }

  /**
   * Resolve active user session details.
   *
   * @param davinciId Native DaVinci client id.
   * @param promise Promise resolved with session payload or null.
   */
  override fun getSession(davinciId: String, promise: Promise) {
    RNPingDavinciCommon.getSession(davinciId, promise)
  }

  /**
   * Refresh active DaVinci user token set.
   *
   * @param davinciId Native DaVinci client id.
   * @param promise Promise resolved with refreshed session payload or null.
   */
  override fun refresh(davinciId: String, promise: Promise) {
    RNPingDavinciCommon.refresh(davinciId, promise)
  }

  /**
   * Revoke active DaVinci user token set.
   *
   * @param davinciId Native DaVinci client id.
   * @param promise Promise resolved with `true` when revoke completes.
   */
  override fun revoke(davinciId: String, promise: Promise) {
    RNPingDavinciCommon.revoke(davinciId, promise)
  }

  /**
   * Resolve active DaVinci userinfo payload.
   *
   * @param davinciId Native DaVinci client id.
   * @param promise Promise resolved with userinfo payload or null.
   */
  override fun userinfo(davinciId: String, promise: Promise) {
    RNPingDavinciCommon.userinfo(davinciId, promise)
  }

  /**
   * Log out the active DaVinci user.
   *
   * @param davinciId Native DaVinci client id.
   * @param promise Promise resolved when logout completes.
   */
  override fun logout(davinciId: String, promise: Promise) {
    RNPingDavinciCommon.logout(davinciId, promise)
  }

  /**
   * Dispose a DaVinci instance and clear native state.
   *
   * @param davinciId Native DaVinci client id.
   * @param promise Promise resolved when disposal completes.
   */
  override fun dispose(davinciId: String, promise: Promise) {
    RNPingDavinciCommon.dispose(davinciId, promise)
  }

  companion object {
    const val NAME = "RNPingDavinci"
  }
}
