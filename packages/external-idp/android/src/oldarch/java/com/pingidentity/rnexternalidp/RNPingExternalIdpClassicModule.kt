/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnexternalidp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.module.annotations.ReactModule

/**
 * Classic entry point for the External IDP package scaffold on Android.
 *
 * @param reactContext The React Native application context.
 */
@ReactModule(name = RNPingExternalIdpClassicModule.NAME)
class RNPingExternalIdpClassicModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  /**
   * Return the module name exposed to the React Native bridge.
   */
  override fun getName(): String = NAME

  companion object {
    const val NAME = "RNPingExternalIdpClassic"
  }
}
