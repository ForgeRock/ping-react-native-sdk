/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingtestrunner

import com.pingidentity.idp.IdpClient
import com.pingidentity.idp.IdpHandler
import com.pingidentity.idp.IdpResult

/**
 * Stub external IdP handler proving that app code can implement the native
 * SDK's `com.pingidentity.idp.IdpHandler` interface now that the
 * `external-idp` dependency is exposed with `api` scope by
 * `@ping-identity/rn-external-idp`.
 *
 * Returns a fixed token so nothing here is a real credential, and records only
 * the presence of the callback nonce in `additionalParameters` — never the
 * nonce value itself. If this stub ever needs a cancel path it must throw
 * `IdpCanceledException` so the bridge maps it to `EXTERNAL_IDP_CANCELLED`.
 *
 * `additionalParameters` entries are replayed as request parameters by the
 * native `IdpCallback` when the callback is submitted via `journey.next()`,
 * so anything placed there must be treated as server-visible.
 */
class StubIdpHandler : IdpHandler {

    override var tokenType: String = "id_token"

    override suspend fun authorize(idpClient: IdpClient): IdpResult {
        val noncePresent = !idpClient.nonce.isNullOrEmpty()
        return IdpResult(
            token = "stub-idp-token",
            additionalParameters = mapOf("noncePresent" to noncePresent.toString()),
        )
    }
}
