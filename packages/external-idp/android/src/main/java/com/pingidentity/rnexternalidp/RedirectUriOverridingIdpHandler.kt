/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnexternalidp

import com.pingidentity.idp.IdpClient
import com.pingidentity.idp.IdpHandler
import com.pingidentity.idp.IdpResult

/**
 * Decorator that rewrites `IdpClient.redirectUri` with the JS-configured override before
 * delegating authorization to a custom handler.
 *
 * The native `IdpCallback.authorize` builds the `IdpClient` from the callback's own
 * server-supplied `redirectUri` only, so without this wrapper the redirect URI configured
 * on the client factory would never reach a custom handler. This mirrors the iOS bridge's
 * `RedirectUriOverridingIdpHandler`.
 */
internal class RedirectUriOverridingIdpHandler(
    private val baseHandler: IdpHandler,
    private val redirectUri: String
) : IdpHandler {

    override var tokenType: String
        get() = baseHandler.tokenType
        set(value) {
            baseHandler.tokenType = value
        }

    /**
     * Authorizes through the wrapped handler with the redirect URI replaced.
     *
     * @param idpClient Native client payload created from the Journey callback.
     * @return The provider authorization result.
     */
    override suspend fun authorize(idpClient: IdpClient): IdpResult {
        val overriddenClient = idpClient.copy(redirectUri = redirectUri)
        return baseHandler.authorize(overriddenClient)
    }
}
