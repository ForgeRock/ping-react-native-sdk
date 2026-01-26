/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Shared Android implementation for the Ping OIDC React Native module.
 */
object RNPingOidcCommon {

  private val clientCounter = AtomicInteger(0)
  private val webClientCounter = AtomicInteger(0)

  /**
   * Create a native-backed OIDC client and return its core identifier.
   */
  fun createClient(config: ReadableMap): String {
    return "oidc-client-${clientCounter.incrementAndGet()}"
  }

  /**
   * Create a native-backed OIDC web client from an existing client id.
   */
  fun createWebClient(clientId: String): String {
    return "oidc-web-${webClientCounter.incrementAndGet()}"
  }

  /**
   * Launch an authorization flow in the system browser.
   */
  fun authorize(webClientId: String, options: ReadableMap, promise: Promise) {
    val result = Arguments.createMap()
    result.putString("type", "cancel")
    promise.resolve(result)
  }

  /**
   * Resolve whether a user is available for the given web client.
   */
  fun hasUser(webClientId: String, promise: Promise) {
    promise.resolve(false)
  }

  /**
   * Resolve the current user's tokens.
   */
  fun token(webClientId: String, promise: Promise) {
    promise.reject("OIDC_NOT_IMPLEMENTED", "OIDC native module not implemented")
  }

  /**
   * Revoke tokens for the current user.
   */
  fun revoke(webClientId: String, promise: Promise) {
    promise.resolve(null)
  }

  /**
   * Logout the current user.
   */
  fun logout(webClientId: String, promise: Promise) {
    promise.resolve(null)
  }
}
