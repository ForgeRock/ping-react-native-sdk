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

/**
 * Classic (non-Turbo) module entry point for the OIDC API on Android.
 *
 * @remarks
 * Mirrors [RNPingOidcModule] for legacy React Native setups and forwards
 * all work to [RNPingOidcCommon] to keep behavior consistent.
 */
@ReactModule(name = RNPingOidcClassicModule.NAME)
class RNPingOidcClassicModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  init {
    RNPingOidcCommon.configure(reactContext)
  }

  companion object {
    /** Name used for React Native module registration. */
    const val NAME = "RNPingOidcClassic"
  }

  override fun getName(): String = NAME

  /**
   * Create a native-backed OIDC client and return its core identifier.
   *
   * @param config JS-provided client configuration
   * @return Stable client identifier
   */
  @ReactMethod(isBlockingSynchronousMethod = true)
  fun createClient(config: ReadableMap): String {
    return RNPingOidcCommon.createClient(config)
  }

  /**
   * Create a native-backed OIDC web client from an existing client id.
   *
   * @param clientId Identifier returned by [createClient]
   * @return Stable web client identifier
   */
  @ReactMethod(isBlockingSynchronousMethod = true)
  fun createWebClient(clientId: String): String {
    return RNPingOidcCommon.createWebClient(clientId)
  }

  /**
   * Launch an authorization flow in the system browser.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param options Optional per-request overrides
   * @param promise Promise resolved with success/cancel or rejected with GenericError
   */
  @ReactMethod
  fun authorize(webClientId: String, options: ReadableMap, promise: Promise) {
    RNPingOidcCommon.authorize(webClientId, options, promise)
  }

  /**
   * Resolve whether a user is available for the given web client.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Promise resolved with a boolean or rejected with GenericError
   */
  @ReactMethod
  fun hasUser(webClientId: String, promise: Promise) {
    RNPingOidcCommon.hasUser(webClientId, promise)
  }

  /**
   * Resolve the current user's tokens.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Promise resolved with token payload or rejected with GenericError
   */
  @ReactMethod
  fun token(webClientId: String, promise: Promise) {
    RNPingOidcCommon.token(webClientId, promise)
  }

  /**
   * Force-refresh the current user's tokens.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Promise resolved with token payload or rejected with GenericError
   */
  @ReactMethod
  fun refresh(webClientId: String, promise: Promise) {
    RNPingOidcCommon.refresh(webClientId, promise)
  }

  /**
   * Fetch user profile data from the userinfo endpoint.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param cache When true, return cached userinfo if available
   * @param promise Promise resolved with userinfo payload or rejected with GenericError
   */
  @ReactMethod
  fun userinfo(webClientId: String, cache: Boolean, promise: Promise) {
    RNPingOidcCommon.userinfo(webClientId, cache, promise)
  }

  /**
   * Revoke tokens for the current user.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Promise resolved on success or rejected with GenericError
   */
  @ReactMethod
  fun revoke(webClientId: String, promise: Promise) {
    RNPingOidcCommon.revoke(webClientId, promise)
  }

  /**
   * Logout the current user.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Promise resolved with end-session status or rejected with GenericError
   */
  @ReactMethod
  fun logout(webClientId: String, promise: Promise) {
    RNPingOidcCommon.logout(webClientId, promise)
  }
}
