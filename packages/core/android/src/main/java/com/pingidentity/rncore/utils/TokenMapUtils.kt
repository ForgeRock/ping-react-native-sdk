/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rncore.utils

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap

/**
 * Build a JS-facing token payload map.
 *
 * @param accessToken Required access token string.
 * @param idToken Optional ID token string.
 * @param refreshToken Optional refresh token string.
 * @param tokenExpiry Optional UNIX timestamp in seconds.
 */
fun buildTokenMap(
  accessToken: String,
  idToken: String? = null,
  refreshToken: String? = null,
  tokenExpiry: Long? = null
): ReadableMap {
  val map = Arguments.createMap()
  map.putString("accessToken", accessToken)
  idToken?.let { map.putString("idToken", it) }
  refreshToken?.let { map.putString("refreshToken", it) }
  tokenExpiry?.let { map.putDouble("tokenExpiry", it.toDouble()) }
  return map
}
