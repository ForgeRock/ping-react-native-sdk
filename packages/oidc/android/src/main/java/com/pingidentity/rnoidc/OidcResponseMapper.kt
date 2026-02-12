/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.pingidentity.oidc.Token
import com.facebook.react.bridge.ReadableMap
import com.reactnativepingidentity.core.utils.buildTokenMap
import com.reactnativepingidentity.core.utils.JsonBridgeMapper
import kotlinx.serialization.json.JsonObject

/**
 * Converts native OIDC payloads into React Native bridge maps.
 */
internal object OidcResponseMapper {

  /**
   * Convert native tokens into the JS-facing token payload.
   *
   * @param token Native token payload
   * @return React Native bridge map of token values
   */
  fun encodeTokens(token: Token): ReadableMap {
    // TODO: Prefer native Token.expiresAt once Android SDK exposes it (matches iOS behavior).
    val expiresAt = (System.currentTimeMillis() / 1000) + token.expiresIn
    return buildTokenMap(
      accessToken = token.accessToken,
      idToken = token.idToken,
      refreshToken = token.refreshToken,
      tokenExpiry = expiresAt
    )
  }

  /**
   * Convert userinfo payload into a React Native map.
   *
   * @param userinfo Native userinfo payload
   * @return React Native bridge map of userinfo values
   */
  fun encodeUserinfo(userinfo: JsonObject) = JsonBridgeMapper.encodeJsonObject(userinfo)

}
