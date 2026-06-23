/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.config

import com.facebook.react.bridge.ReadableMap
import com.pingidentity.rncore.utils.readStringArray
import com.pingidentity.rncore.utils.readStringMap
import com.pingidentity.rncore.utils.requireString

/**
 * Parsed DaVinci client configuration supplied by JavaScript.
 */
internal data class DaVinciClientPayload(
    /** OIDC discovery endpoint URL — required. */
    val discoveryEndpoint: String,
    /** OAuth2 client identifier — required. */
    val clientId: String,
    /** OAuth2 redirect URI — required. */
    val redirectUri: String,
    /** OAuth2 scopes to request. */
    val scopes: List<String>,
    /** Optional OIDC storage handle id. */
    val storageId: String?,
    /** Optional logger handle id. */
    val loggerId: String?,
    /** Optional network timeout in milliseconds. */
    val timeout: Long?,
    /** Optional sign-out redirect URI (TODO-SDK-PARITY: Android only in 2.0.1. iOS ignores it). */
    val signOutRedirectUri: String?,
    /** Optional login hint. */
    val loginHint: String?,
    /** Optional nonce parameter. */
    val nonce: String?,
    /** Optional state parameter. */
    val state: String?,
    /** Optional prompt parameter. */
    val prompt: String?,
    /** Optional display parameter. */
    val display: String?,
    /** Optional UI locales. */
    val uiLocales: String?,
    /** Optional ACR values. */
    val acrValues: String?,
    /** Optional proactive token refresh threshold in seconds. */
    val refreshThreshold: Long?,
    /** Optional additional authorization parameters. */
    val additionalParameters: Map<String, String>
)

/**
 * Parses and validates JS configuration maps into strongly typed DaVinci payloads.
 */
internal object DaVinciConfigParser {

    /**
     * Parse and validate DaVinci configuration from a JS bridge map.
     *
     * @param config Bridge payload.
     * @return Parsed DaVinci client payload.
     * @throws IllegalArgumentException when required fields are missing or blank.
     */
    fun parse(config: ReadableMap): DaVinciClientPayload {
        val discoveryEndpoint = requireString(config, "discoveryEndpoint")
        val clientId = requireString(config, "clientId")
        val redirectUri = requireString(config, "redirectUri")

        val scopes = readStringArray(config.getArray("scopes"))
        val storageId = if (config.hasKey("storageId")) config.getString("storageId") else null
        val loggerId = if (config.hasKey("loggerId")) config.getString("loggerId") else null
        val timeout = if (config.hasKey("timeout")) config.getDouble("timeout").toLong() else null
        val signOutRedirectUri = if (config.hasKey("signOutRedirectUri")) {
            config.getString("signOutRedirectUri")
        } else {
            null
        }
        val loginHint = if (config.hasKey("loginHint")) config.getString("loginHint") else null
        val nonce = if (config.hasKey("nonce")) config.getString("nonce") else null
        val state = if (config.hasKey("state")) config.getString("state") else null
        val prompt = if (config.hasKey("prompt")) config.getString("prompt") else null
        val display = if (config.hasKey("display")) config.getString("display") else null
        val uiLocales = if (config.hasKey("uiLocales")) config.getString("uiLocales") else null
        val acrValues = if (config.hasKey("acrValues")) config.getString("acrValues") else null
        val refreshThreshold = if (config.hasKey("refreshThreshold")) {
            config.getDouble("refreshThreshold").toLong()
        } else {
            null
        }
        val additionalParameters = if (config.hasKey("additionalParameters")) {
            readStringMap(config.getMap("additionalParameters"))
        } else {
            emptyMap()
        }

        return DaVinciClientPayload(
            discoveryEndpoint = discoveryEndpoint,
            clientId = clientId,
            redirectUri = redirectUri,
            scopes = scopes,
            storageId = storageId,
            loggerId = loggerId,
            timeout = timeout,
            signOutRedirectUri = signOutRedirectUri,
            loginHint = loginHint,
            nonce = nonce,
            state = state,
            prompt = prompt,
            display = display,
            uiLocales = uiLocales,
            acrValues = acrValues,
            refreshThreshold = refreshThreshold,
            additionalParameters = additionalParameters
        )
    }
}
