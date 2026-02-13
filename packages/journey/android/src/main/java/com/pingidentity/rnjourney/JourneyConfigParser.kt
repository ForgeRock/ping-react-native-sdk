/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.facebook.react.bridge.ReadableMap
import com.reactnativepingidentity.core.utils.readStringArray
import com.reactnativepingidentity.core.utils.requireString

/**
 * Parsed Journey client payload supplied by JavaScript.
 */
internal data class JourneyClientPayload(
    val serverUrl: String,
    val realm: String?,
    val cookie: String?,
    val clientId: String?,
    val discoveryEndpoint: String?,
    val redirectUri: String?,
    val scopes: List<String>,
    val sessionStorageId: String?,
    val loggerId: String?
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
        val sessionStorageId = if (config.hasKey("sessionStorageId")) {
            config.getString("sessionStorageId")
        } else {
            null
        }
        val loggerId = if (config.hasKey("loggerId")) config.getString("loggerId") else null

        val hasAnyOidcField = !clientId.isNullOrBlank() ||
            !discoveryEndpoint.isNullOrBlank() ||
            !redirectUri.isNullOrBlank()

        if (hasAnyOidcField && (clientId.isNullOrBlank() || discoveryEndpoint.isNullOrBlank() || redirectUri.isNullOrBlank())) {
            throw IllegalArgumentException(
                "clientId, discoveryEndpoint, and redirectUri must all be provided when OIDC is configured"
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
            sessionStorageId = sessionStorageId,
            loggerId = loggerId
        )
    }
}
