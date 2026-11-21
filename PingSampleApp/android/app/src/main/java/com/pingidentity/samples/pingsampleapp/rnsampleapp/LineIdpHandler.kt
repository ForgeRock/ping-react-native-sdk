/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnsampleapp

import android.app.Activity
import androidx.activity.ComponentActivity
import com.linecorp.linesdk.LineApiResponseCode
import com.pingidentity.idp.IdpCanceledException
import com.pingidentity.idp.IdpClient
import com.pingidentity.idp.IdpHandler
import com.pingidentity.idp.IdpResult

/**
 * Custom external IdP handler that authenticates users through LINE Login.
 *
 * Registered under the provider name "line" at app startup so the
 * `@ping-identity/rn-external-idp` registry routes that provider here. The
 * LINE channel ID comes from the Journey callback (`idpClient.clientId`),
 * never from a local constant, mirroring the native built-in handlers.
 *
 * The handler submits the OIDC ID token to the Journey callback, so the
 * `openid` scope must be part of the authorization: when the server sends no
 * scopes, `openid` is requested by default. A login that completes without an
 * ID token fails with a clear error instead of silently substituting the
 * access token, whose token type would not match `id_token`.
 *
 * @param activityProvider Supplies the foreground activity at call time so the
 * handler never holds a lifecycle-bound reference.
 */
class LineIdpHandler(private val activityProvider: () -> Activity?) : IdpHandler {

    /**
     * Token type submitted with the authorization result.
     */
    override var tokenType: String = TOKEN_TYPE_ID

    /**
     * Runs the LINE Login flow for the given Journey callback configuration.
     *
     * The flow is app-to-app when the LINE app is installed, otherwise it
     * falls back to LINE's browser login. User dismissal maps to
     * [IdpCanceledException] so the bridge rejects with the cancelled code.
     *
     * @param idpClient Client configuration from the Journey callback; the
     * `clientId` is the LINE channel ID, `scopes` the requested LINE scopes
     * (defaults to `openid` when the server sends none), and `nonce` the
     * anti-replay value forwarded to the ID token when present.
     * @return Result carrying the ID token issued by LINE.
     * @throws IllegalArgumentException when the channel ID is blank.
     * @throws IdpCanceledException when the user cancels the login.
     * @throws IllegalStateException when no foreground activity is available,
     * LINE reports an error, or LINE completes without an ID token.
     */
    override suspend fun authorize(idpClient: IdpClient): IdpResult {
        val channelId = idpClient.clientId?.trim().orEmpty()
        if (channelId.isEmpty()) {
            throw IllegalArgumentException("LINE channel ID is required")
        }

        val activity = activityProvider() as? ComponentActivity
            ?: throw IllegalStateException("LINE login requires a ComponentActivity in the foreground")

        val scopes = idpClient.scopes.ifEmpty { listOf(DEFAULT_SCOPE) }
        val loginResult = LineLoginBridge.authorize(activity, channelId, scopes, idpClient.nonce)

        if (!loginResult.isSuccess) {
            if (loginResult.responseCode == LineApiResponseCode.CANCEL) {
                throw IdpCanceledException()
            }
            throw IllegalStateException(
                "LINE authorization failed: " +
                    "code=${loginResult.responseCode} " +
                    "message=${loginResult.errorData.message ?: "unknown"}"
            )
        }

        val idToken = loginResult.lineIdToken?.rawString
        if (idToken.isNullOrEmpty()) {
            throw IllegalStateException(
                "LINE authorization completed but no ID token was returned; " +
                    "the openid scope must be requested"
            )
        }
        return IdpResult(token = idToken)
    }

    private companion object {
        const val DEFAULT_SCOPE = "openid"
        const val TOKEN_TYPE_ID = "id_token"
    }
}
