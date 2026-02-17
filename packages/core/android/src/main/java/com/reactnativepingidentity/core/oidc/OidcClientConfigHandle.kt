/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.core.oidc

import com.reactnativepingidentity.core.registry.NativeHandle

/**
 * OpenID endpoint override values used by the native OIDC module.
 *
 * @property authorizationEndpoint Authorization endpoint URL.
 * @property tokenEndpoint Token endpoint URL.
 * @property userinfoEndpoint Userinfo endpoint URL.
 * @property endSessionEndpoint Optional end-session endpoint URL.
 * @property pingEndIdpSessionEndpoint Optional Ping end-session endpoint URL.
 * @property revocationEndpoint Optional token revocation endpoint URL.
 */
data class OidcOpenIdConfig(
    val authorizationEndpoint: String,
    val tokenEndpoint: String,
    val userinfoEndpoint: String,
    val endSessionEndpoint: String?,
    val pingEndIdpSessionEndpoint: String?,
    val revocationEndpoint: String?
)

/**
 * Shared native handle contract that exposes OIDC client configuration values.
 *
 * @remarks
 * Modules that need to compose with OIDC (for example Journey) can resolve this
 * handle from [com.reactnativepingidentity.core.CoreRuntime.oidcClientRegistry]
 * without depending on OIDC package internals.
 */
interface OidcClientConfigHandle : NativeHandle {
    /**
     * OIDC client identifier registered on the authorization server.
     */
    val clientId: String

    /**
     * OIDC discovery endpoint URL, if configured.
     */
    val discoveryEndpoint: String?

    /**
     * OIDC redirect URI used by the native client.
     */
    val redirectUri: String

    /**
     * OIDC scopes configured for this client.
     */
    val scopes: List<String>

    /**
     * Optional OpenID endpoint override configuration.
     */
    val openId: OidcOpenIdConfig?

    /**
     * Optional ACR values.
     */
    val acrValues: String?

    /**
     * Optional sign-out redirect URI.
     */
    val signOutRedirectUri: String?

    /**
     * Optional OIDC state parameter.
     */
    val state: String?

    /**
     * Optional OIDC nonce parameter.
     */
    val nonce: String?

    /**
     * Optional OIDC UI locales parameter.
     */
    val uiLocales: String?

    /**
     * Optional token refresh threshold in seconds.
     */
    val refreshThreshold: Long?

    /**
     * Optional OIDC login hint.
     */
    val loginHint: String?

    /**
     * Optional OIDC display parameter.
     */
    val display: String?

    /**
     * Optional OIDC prompt parameter.
     */
    val prompt: String?

    /**
     * Optional provider-specific parameters.
     */
    val additionalParameters: Map<String, String>
}
