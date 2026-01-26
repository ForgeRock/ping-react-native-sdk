/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = RNPingOidcClassicModule.NAME)
/**
 * Classic (non-Turbo) module entry point for the OIDC API on Android.
 */
class RNPingOidcClassicModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val NAME = "RNPingOidcClassic"
  }

  override fun getName(): String = NAME

  /**
   * Create a native-backed OIDC client and return its core identifier.
   */
  @ReactMethod(isBlockingSynchronousMethod = true)
  fun createClient(config: ReadableMap): String {
    return RNPingOidcCommon.createClient(config)
  }

  /**
   * Create a native-backed OIDC web client from an existing client id.
   */
  @ReactMethod(isBlockingSynchronousMethod = true)
  fun createWebClient(clientId: String): String {
    return RNPingOidcCommon.createWebClient(clientId)
  }

  /**
   * Launch an authorization flow in the system browser.
   */
  @ReactMethod
  fun authorize(webClientId: String, options: ReadableMap, promise: Promise) {
    RNPingOidcCommon.authorize(webClientId, options, promise)
  }

  /**
   * Resolve whether a user is available for the given web client.
   */
  @ReactMethod
  fun hasUser(webClientId: String, promise: Promise) {
    RNPingOidcCommon.hasUser(webClientId, promise)
  }

  /**
   * Resolve the current user's tokens.
   */
  @ReactMethod
  fun token(webClientId: String, promise: Promise) {
    RNPingOidcCommon.token(webClientId, promise)
  }

  /**
   * Revoke tokens for the current user.
   */
  @ReactMethod
  fun revoke(webClientId: String, promise: Promise) {
    RNPingOidcCommon.revoke(webClientId, promise)
  }

  /**
   * Logout the current user.
   */
  @ReactMethod
  fun logout(webClientId: String, promise: Promise) {
    RNPingOidcCommon.logout(webClientId, promise)
  }
}
