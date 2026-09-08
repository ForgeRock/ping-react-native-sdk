/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.config

/**
 * Parsed DaVinci OIDC module configuration supplied by JavaScript.
 *
 * @param discoveryEndpoint OIDC discovery endpoint URL.
 * @param clientId OAuth2 client identifier.
 * @param redirectUri OAuth2 redirect URI.
 * @param scopes OAuth2 scopes to request. Empty when omitted.
 * @param par Optional PAR enablement flag.
 * @param storageId Optional OIDC storage handle id.
 * @param signOutRedirectUri Optional sign-out redirect URI.
 * @param loginHint Optional login hint.
 * @param nonce Optional nonce parameter.
 * @param state Optional state parameter.
 * @param prompt Optional prompt parameter.
 * @param display Optional display parameter.
 * @param uiLocales Optional UI locales.
 * @param acrValues Optional ACR values.
 * @param refreshThreshold Optional proactive token refresh threshold in seconds.
 * @param additionalParameters Optional additional authorization parameters.
 */
internal data class DaVinciOidcPayload(
    val discoveryEndpoint: String,
    val clientId: String,
    val redirectUri: String,
    val scopes: List<String>,
    val par: Boolean?,
    val storageId: String?,
    val signOutRedirectUri: String?,
    val loginHint: String?,
    val nonce: String?,
    val state: String?,
    val prompt: String?,
    val display: String?,
    val uiLocales: String?,
    val acrValues: String?,
    val refreshThreshold: Long?,
    val additionalParameters: Map<String, String>,
)
