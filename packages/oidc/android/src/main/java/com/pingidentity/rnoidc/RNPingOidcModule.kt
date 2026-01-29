/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * TurboModule entry point for the OIDC API on Android.
 *
 * @remarks
 * This class binds the generated TurboModule spec to the shared native
 * implementation in [RNPingOidcCommon]. All heavy lifting is delegated to the
 * common object to keep parity with the classic module.
 */
@ReactModule(name = RNPingOidcModule.NAME)
class RNPingOidcModule(reactContext: ReactApplicationContext) :
  NativeRNPingOidcSpec(reactContext) {

  init {
    RNPingOidcCommon.configure(reactContext)
  }

  /**
   * Expose the module name to React Native.
   *
   * @return Registered module name used by the bridge
   */
  override fun getName(): String = NAME

  /**
   * Create a native-backed OIDC client and return its core identifier.
   *
   * @param config JS-provided client configuration
   * @return Stable client identifier
   */
  override fun createClient(config: ReadableMap): String {
    return RNPingOidcCommon.createClient(config)
  }

  /**
   * Create a native-backed OIDC web client from an existing client id.
   *
   * @param clientId Identifier returned by [createClient]
   * @return Stable web client identifier
   */
  override fun createWebClient(clientId: String): String {
    return RNPingOidcCommon.createWebClient(clientId)
  }

  /**
   * Resolve the current client's tokens.
   *
   * @param clientId Identifier returned by [createClient]
   * @param promise Promise resolved with token payload or rejected with GenericError
   */
  override fun clientToken(clientId: String, promise: Promise) {
    RNPingOidcCommon.clientToken(clientId, promise)
  }

  /**
   * Force-refresh the current client's tokens.
   *
   * @param clientId Identifier returned by [createClient]
   * @param promise Promise resolved with token payload or rejected with GenericError
   */
  override fun clientRefresh(clientId: String, promise: Promise) {
    RNPingOidcCommon.clientRefresh(clientId, promise)
  }

  /**
   * Fetch user profile data from the userinfo endpoint for the client.
   *
   * @param clientId Identifier returned by [createClient]
   * @param cache When true, return cached userinfo if available
   * @param promise Promise resolved with userinfo payload or rejected with GenericError
   */
  override fun clientUserinfo(clientId: String, cache: Boolean, promise: Promise) {
    RNPingOidcCommon.clientUserinfo(clientId, cache, promise)
  }

  /**
   * Revoke tokens for the current client.
   *
   * @param clientId Identifier returned by [createClient]
   * @param promise Promise resolved on success or rejected with GenericError
   */
  override fun clientRevoke(clientId: String, promise: Promise) {
    RNPingOidcCommon.clientRevoke(clientId, promise)
  }

  /**
   * Logout the current client session.
   *
   * @param clientId Identifier returned by [createClient]
   * @param promise Promise resolved with end-session status or rejected with GenericError
   */
  override fun clientEndSession(clientId: String, promise: Promise) {
    RNPingOidcCommon.clientEndSession(clientId, promise)
  }

  /**
   * Launch an authorization flow in the system browser.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param options Optional per-request overrides
   * @param promise Promise resolved with success/cancel or rejected with GenericError
   */
  override fun authorize(webClientId: String, options: ReadableMap, promise: Promise) {
    RNPingOidcCommon.authorize(webClientId, options, promise)
  }

  /**
   * Resolve whether a user is available for the given web client.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Promise resolved with a boolean or rejected with GenericError
   */
  override fun hasUser(webClientId: String, promise: Promise) {
    RNPingOidcCommon.hasUser(webClientId, promise)
  }

  /**
   * Resolve the current user's tokens.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Promise resolved with token payload or rejected with GenericError
   */
  override fun token(webClientId: String, promise: Promise) {
    RNPingOidcCommon.token(webClientId, promise)
  }

  /**
   * Force-refresh the current user's tokens.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Promise resolved with token payload or rejected with GenericError
   */
  override fun refresh(webClientId: String, promise: Promise) {
    RNPingOidcCommon.refresh(webClientId, promise)
  }

  /**
   * Fetch user profile data from the userinfo endpoint.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param cache When true, return cached userinfo if available
   * @param promise Promise resolved with userinfo payload or rejected with GenericError
   */
  override fun userinfo(webClientId: String, cache: Boolean, promise: Promise) {
    RNPingOidcCommon.userinfo(webClientId, cache, promise)
  }

  /**
   * Revoke tokens for the current user.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Promise resolved on success or rejected with GenericError
   */
  override fun revoke(webClientId: String, promise: Promise) {
    RNPingOidcCommon.revoke(webClientId, promise)
  }

  /**
   * Logout the current user.
   *
   * @param webClientId Identifier returned by [createWebClient]
   * @param promise Promise resolved with end-session status or rejected with GenericError
   */
  override fun logout(webClientId: String, promise: Promise) {
    RNPingOidcCommon.logout(webClientId, promise)
  }

  companion object {
    /** Name used for React Native module registration. */
    const val NAME = "RNPingOidc"
  }
}
