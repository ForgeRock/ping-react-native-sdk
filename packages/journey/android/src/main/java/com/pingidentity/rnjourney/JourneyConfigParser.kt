/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.facebook.react.bridge.ReadableMap
import com.reactnativepingidentity.core.utils.readStringMap
import com.reactnativepingidentity.core.utils.readStringArray
import com.reactnativepingidentity.core.utils.requireString

/**
 * Parsed Journey client payload supplied by JavaScript.
 */
internal data class JourneyClientPayload(
    /** Base AM/Ping server URL. */
    val serverUrl: String,
    /** Optional AM realm path. */
    val realm: String?,
    /** Optional cookie/session namespace override. */
    val cookie: String?,
    /** Optional OIDC client id used for Journey + OIDC composition. */
    val clientId: String?,
    /** Optional OIDC discovery endpoint URL. */
    val discoveryEndpoint: String?,
    /** Optional OIDC redirect URI. */
    val redirectUri: String?,
    /** Optional OIDC scopes requested for token exchanges. */
    val scopes: List<String>,
    /** Optional OpenID endpoint override settings. */
    val openId: JourneyOpenIdPayload?,
    /** Optional ACR values passed to OIDC authorization. */
    val acrValues: String?,
    /** Optional sign-out redirect URI for OIDC end-session. */
    val signOutRedirectUri: String?,
    /** Optional OIDC state parameter. */
    val state: String?,
    /** Optional OIDC nonce parameter. */
    val nonce: String?,
    /** Optional OIDC UI locales parameter. */
    val uiLocales: String?,
    /** Optional token refresh threshold in seconds. */
    val refreshThreshold: Long?,
    /** Optional OIDC login hint parameter. */
    val loginHint: String?,
    /** Optional OIDC display parameter. */
    val display: String?,
    /** Optional OIDC prompt parameter. */
    val prompt: String?,
    /** Optional provider-specific OIDC parameters. */
    val additionalParameters: Map<String, String>,
    /** Optional session storage handle id from the storage bridge module. */
    val sessionStorageId: String?,
    /** Optional logger handle id from the logger bridge module. */
    val loggerId: String?,
    /** Optional OIDC client handle id from the OIDC bridge module. */
    val oidcClientId: String?
)

/**
 * Optional OpenID endpoint override settings for Journey OIDC composition.
 */
internal data class JourneyOpenIdPayload(
    val authorizationEndpoint: String,
    val tokenEndpoint: String,
    val userinfoEndpoint: String,
    val endSessionEndpoint: String?,
    val pingEndIdpSessionEndpoint: String?,
    val revocationEndpoint: String?
)

/**
 * Parse JS configuration maps into strongly typed Journey payloads.
 */
internal object JourneyConfigParser {

    /**
     * Parse and validate Journey configuration.
     *
     * @param config Bridge payload.
     * @return Parsed Journey payload.
     * @throws IllegalArgumentException when required fields are missing or invalid.
     */
    fun parse(config: ReadableMap): JourneyClientPayload {
        val serverUrl = requireString(config, "serverUrl")
        val realm = if (config.hasKey("realm")) config.getString("realm") else null
        val cookie = if (config.hasKey("cookie")) config.getString("cookie") else null
        val clientId = if (config.hasKey("clientId")) config.getString("clientId") else null
        val discoveryEndpoint = if (config.hasKey("discoveryEndpoint")) {
            config.getString("discoveryEndpoint")
        } else {
            null
        }
        val redirectUri = if (config.hasKey("redirectUri")) config.getString("redirectUri") else null
        val scopes = readStringArray(config.getArray("scopes"))
        val openId = parseOpenId(config)
        val acrValues = if (config.hasKey("acrValues")) config.getString("acrValues") else null
        val signOutRedirectUri = if (config.hasKey("signOutRedirectUri")) {
            config.getString("signOutRedirectUri")
        } else {
            null
        }
        val state = if (config.hasKey("state")) config.getString("state") else null
        val nonce = if (config.hasKey("nonce")) config.getString("nonce") else null
        val uiLocales = if (config.hasKey("uiLocales")) config.getString("uiLocales") else null
        val refreshThreshold = if (config.hasKey("refreshThreshold")) {
            config.getDouble("refreshThreshold").toLong()
        } else {
            null
        }
        val loginHint = if (config.hasKey("loginHint")) config.getString("loginHint") else null
        val display = if (config.hasKey("display")) config.getString("display") else null
        val prompt = if (config.hasKey("prompt")) config.getString("prompt") else null
        val additionalParameters = if (config.hasKey("additionalParameters")) {
            readStringMap(config.getMap("additionalParameters"))
        } else {
            emptyMap()
        }
        val sessionStorageId = if (config.hasKey("sessionStorageId")) {
            config.getString("sessionStorageId")
        } else {
            null
        }
        val loggerId = if (config.hasKey("loggerId")) config.getString("loggerId") else null
        val oidcClientId = if (config.hasKey("oidcClientId")) config.getString("oidcClientId") else null

        val hasOidcClientHandle = !oidcClientId.isNullOrBlank()
        val hasAnyOidcField = !clientId.isNullOrBlank() ||
            !discoveryEndpoint.isNullOrBlank() ||
            !redirectUri.isNullOrBlank() ||
            openId != null ||
            !acrValues.isNullOrBlank() ||
            !signOutRedirectUri.isNullOrBlank() ||
            !state.isNullOrBlank() ||
            !nonce.isNullOrBlank() ||
            !uiLocales.isNullOrBlank() ||
            refreshThreshold != null ||
            !loginHint.isNullOrBlank() ||
            !display.isNullOrBlank() ||
            !prompt.isNullOrBlank() ||
            additionalParameters.isNotEmpty()

        if (!hasOidcClientHandle &&
            hasAnyOidcField &&
            (clientId.isNullOrBlank() || redirectUri.isNullOrBlank() || (discoveryEndpoint.isNullOrBlank() && openId == null))
        ) {
            throw IllegalArgumentException(
                "clientId, redirectUri, and either discoveryEndpoint or openId must all be provided when OIDC is configured"
            )
        }

        return JourneyClientPayload(
            serverUrl = serverUrl,
            realm = realm,
            cookie = cookie,
            clientId = clientId,
            discoveryEndpoint = discoveryEndpoint,
            redirectUri = redirectUri,
            scopes = scopes,
            openId = openId,
            acrValues = acrValues,
            signOutRedirectUri = signOutRedirectUri,
            state = state,
            nonce = nonce,
            uiLocales = uiLocales,
            refreshThreshold = refreshThreshold,
            loginHint = loginHint,
            display = display,
            prompt = prompt,
            additionalParameters = additionalParameters,
            sessionStorageId = sessionStorageId,
            loggerId = loggerId,
            oidcClientId = oidcClientId
        )
    }

    /**
     * Parse optional OpenID endpoint override payload.
     *
     * @param config Journey config payload from JS bridge.
     * @return Parsed OpenID settings, or null when not provided.
     */
    private fun parseOpenId(config: ReadableMap): JourneyOpenIdPayload? {
        if (!config.hasKey("openId")) {
            return null
        }
        val openIdMap = config.getMap("openId") ?: return null
        return JourneyOpenIdPayload(
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
}
