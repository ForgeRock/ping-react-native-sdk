/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnsampleapp

import android.content.Intent
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import com.linecorp.linesdk.Scope
import com.linecorp.linesdk.auth.LineAuthenticationParams
import com.linecorp.linesdk.auth.LineLoginApi
import com.linecorp.linesdk.auth.LineLoginResult
import java.util.UUID
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

/**
 * Adapts the LINE SDK's `startActivityForResult` login contract to a suspend
 * call by driving it through the foreground activity's result registry, so
 * `MainActivity` needs no result forwarding.
 *
 * Limitation: the launcher is registered per call under a random key with no
 * `LifecycleOwner`. If the hosting activity is destroyed and recreated while
 * the login UI is in the foreground (rotation, memory pressure, "don't keep
 * activities"), the recreated instance never re-registers the key, the result
 * has no callback to reach, and the suspended coroutine never resumes. A
 * production handler would register once in `onCreate` under a fixed key with
 * the activity as `LifecycleOwner`, at the cost of editing the host activity.
 */
internal object LineLoginBridge {

    /**
     * Launches LINE Login and suspends until the LINE app or browser returns.
     *
     * Hops to the main thread itself: `launch` reaches the registry's
     * `@MainThread onLaunch`, `unregister` is `@MainThread`, and the registry's
     * maps are unsynchronized, so the whole sequence is confined to main. The
     * bridge's handler dispatch is an implementation detail this bridge does
     * not rely on.
     *
     * @param activity Foreground activity whose result registry hosts the login.
     * @param channelId LINE channel ID the login is issued for.
     * @param scopes LINE scope codes to request, for example `openid`.
     * @param nonce Optional anti-replay value echoed into the ID token.
     * @return The LINE login result, including cancellation and error outcomes.
     */
    suspend fun authorize(
        activity: ComponentActivity,
        channelId: String,
        scopes: List<String>,
        nonce: String?,
    ): LineLoginResult = withContext(Dispatchers.Main) {
        val params = LineAuthenticationParams.Builder()
            .scopes(Scope.convertToScopeList(scopes))
            .apply { nonce?.takeIf { it.isNotEmpty() }?.let { nonce(it) } }
            .build()
        val loginIntent = LineLoginApi.getLoginIntent(activity, channelId, params)

        suspendCancellableCoroutine { continuation ->
            val launcher = activity.activityResultRegistry.register(
                "line-login-${UUID.randomUUID()}",
                ActivityResultContracts.StartActivityForResult(),
            ) { result ->
                continuation.resume(LineLoginApi.getLoginResultFromIntent(result.data ?: Intent()))
            }
            continuation.invokeOnCancellation { launcher.unregister() }
            launcher.launch(loginIntent)
        }
    }
}
