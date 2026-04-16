/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnexternalidp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the External IDP package scaffold on Android.
 */
@ReactModule(name = RNPingExternalIdpModule.NAME)
class RNPingExternalIdpModule(reactContext: ReactApplicationContext) :
  NativeRNPingExternalIdpSpec(reactContext) {

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  companion object {
    const val NAME = "RNPingExternalIdp"
  }
}
