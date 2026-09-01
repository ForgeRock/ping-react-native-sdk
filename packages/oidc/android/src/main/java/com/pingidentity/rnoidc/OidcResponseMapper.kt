/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.pingidentity.oidc.DeviceAuthorizationResponse
import com.pingidentity.oidc.DeviceFlowStatus
import com.pingidentity.oidc.Token
import com.facebook.react.bridge.ReadableMap
import com.pingidentity.rncore.utils.buildTokenMap
import com.pingidentity.rncore.utils.JsonBridgeMapper
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

  fun encodeDeviceStatus(status: DeviceFlowStatus): WritableMap {
    val payload = Arguments.createMap()
    when (status) {
      is DeviceFlowStatus.Started -> {
        payload.putString("type", "started")
        payload.putMap("response", encodeDeviceAuthorizationResponse(status.response))
      }
      is DeviceFlowStatus.Polling -> {
        payload.putString("type", "polling")
        payload.putInt("pollCount", status.pollCount)
        payload.putInt("pollInterval", status.pollInterval)
        payload.putDouble("nextPollAt", status.nextPollAt.toDouble())
      }
      is DeviceFlowStatus.Success -> payload.putString("type", "success")
      DeviceFlowStatus.Expired -> payload.putString("type", "expired")
      DeviceFlowStatus.AccessDenied -> payload.putString("type", "accessDenied")
      is DeviceFlowStatus.Failure -> {
        payload.putString("type", "failure")
        payload.putMap("error", Arguments.createMap().apply {
          putString("message", status.exception.message ?: "Device authorization failed")
        })
      }
    }
    return payload
  }

  private fun encodeDeviceAuthorizationResponse(
    response: DeviceAuthorizationResponse,
  ): WritableMap = Arguments.createMap().apply {
    putString("deviceCode", response.deviceCode)
    putString("userCode", response.userCode)
    putString("verificationUri", response.verificationUri)
    response.verificationUriComplete?.let { putString("verificationUriComplete", it) }
    putInt("expiresIn", response.expiresIn)
    putInt("interval", response.interval)
  }

}
