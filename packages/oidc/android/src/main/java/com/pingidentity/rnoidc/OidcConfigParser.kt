/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.facebook.react.bridge.ReadableMap
import com.reactnativepingidentity.core.utils.readStringMap
import com.reactnativepingidentity.core.utils.requireString
import com.reactnativepingidentity.core.utils.requireStringArray

/**
 * Parsed configuration payload supplied by the JS bridge.
 */
internal data class OidcClientPayload(
  val clientId: String,
  val discoveryEndpoint: String,
  val openId: OpenIdPayload?,
  val redirectUri: String,
  val scopes: List<String>,
  val storageId: String?,
  val loggerId: String?,
  val acrValues: String?,
  val signOutRedirectUri: String?,
  val state: String?,
  val nonce: String?,
  val uiLocales: String?,
  val refreshThreshold: Long?,
  val loginHint: String?,
  val display: String?,
  val prompt: String?,
  val additionalParameters: Map<String, String>
)

/**
 * Optional OpenID configuration override supplied by JS.
 */
internal data class OpenIdPayload(
  val authorizationEndpoint: String,
  val tokenEndpoint: String,
  val userinfoEndpoint: String,
  val endSessionEndpoint: String?,
  val pingEndIdpSessionEndpoint: String?,
  val revocationEndpoint: String?
)

/**
 * Parses JS configuration maps into strongly-typed Kotlin payloads.
 */
internal object OidcConfigParser {

  /**
   * Parse and validate the JS configuration payload for an OIDC client.
   *
   * @throws IllegalArgumentException when required fields are missing
   */
  fun parseClientConfig(config: ReadableMap): OidcClientPayload {
    val clientId = requireString(config, "clientId")
    val openId = parseOpenId(config)
    val discoveryEndpoint = requireString(config, "discoveryEndpoint")
    val redirectUri = requireString(config, "redirectUri")
    val scopes = requireStringArray(config, "scopes")

    return OidcClientPayload(
      clientId = clientId,
      discoveryEndpoint = discoveryEndpoint,
      openId = openId,
      redirectUri = redirectUri,
      scopes = scopes,
      storageId = if (config.hasKey("storageId")) config.getString("storageId") else null,
      loggerId = if (config.hasKey("loggerId")) config.getString("loggerId") else null,
      acrValues = if (config.hasKey("acrValues")) config.getString("acrValues") else null,
      signOutRedirectUri = if (config.hasKey("signOutRedirectUri")) {
        config.getString("signOutRedirectUri")
      } else {
        null
      },
      state = if (config.hasKey("state")) config.getString("state") else null,
      nonce = if (config.hasKey("nonce")) config.getString("nonce") else null,
      uiLocales = if (config.hasKey("uiLocales")) config.getString("uiLocales") else null,
      refreshThreshold = if (config.hasKey("refreshThreshold")) {
        config.getDouble("refreshThreshold").toLong()
      } else {
        null
      },
      loginHint = if (config.hasKey("loginHint")) config.getString("loginHint") else null,
      display = if (config.hasKey("display")) config.getString("display") else null,
      prompt = if (config.hasKey("prompt")) config.getString("prompt") else null,
      additionalParameters = if (config.hasKey("additionalParameters")) {
        readStringMap(config.getMap("additionalParameters"))
      } else {
        emptyMap()
      }
    )
  }

  private fun parseOpenId(config: ReadableMap): OpenIdPayload? {
    if (!config.hasKey("openId")) {
      return null
    }
    val openIdMap = config.getMap("openId") ?: return null
    return OpenIdPayload(
      authorizationEndpoint = requireString(openIdMap, "authorizationEndpoint"),
      tokenEndpoint = requireString(openIdMap, "tokenEndpoint"),
      userinfoEndpoint = requireString(openIdMap, "userinfoEndpoint"),
      endSessionEndpoint = if (openIdMap.hasKey("endSessionEndpoint")) {
        openIdMap.getString("endSessionEndpoint")
      } else {
        null
      },
      pingEndIdpSessionEndpoint = if (openIdMap.hasKey("pingEndIdpSessionEndpoint")) {
        openIdMap.getString("pingEndIdpSessionEndpoint")
      } else {
        null
      },
      revocationEndpoint = if (openIdMap.hasKey("revocationEndpoint")) {
        openIdMap.getString("revocationEndpoint")
      } else {
        null
      }
    )
  }

  /**
   * Build authorization parameter overrides from JS options.
   *
   * @param options JS options map
   * @return Normalized authorization parameters
   */
  fun buildAuthorizeParams(options: ReadableMap): MutableMap<String, String> {
    val params = mutableMapOf<String, String>()
    options.getString("acrValues")?.let { params["acr_values"] = it }
    options.getString("state")?.let { params["state"] = it }
    options.getString("nonce")?.let { params["nonce"] = it }
    options.getString("uiLocales")?.let { params["ui_locales"] = it }
    options.getString("loginHint")?.let { params["login_hint"] = it }
    options.getString("display")?.let { params["display"] = it }
    options.getString("prompt")?.let { params["prompt"] = it }
    val additional = if (options.hasKey("additionalParameters")) {
      readStringMap(options.getMap("additionalParameters"))
    } else {
      emptyMap()
    }
    params.putAll(additional)
    return params
  }
}
