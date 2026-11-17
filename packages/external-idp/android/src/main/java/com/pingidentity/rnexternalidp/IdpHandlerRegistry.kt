/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnexternalidp

import androidx.annotation.VisibleForTesting
import com.pingidentity.idp.IdpHandler
import java.util.concurrent.ConcurrentHashMap

/**
 * Process-scoped registry of app-registered custom [IdpHandler] implementations.
 *
 * App code implements the native SDK's `com.pingidentity.idp.IdpHandler` interface and
 * registers it here at startup (typically `Application.onCreate`, before any React context
 * exists) so the authorize path in [RNPingExternalIdpCommon] can route providers beyond the
 * native built-ins (google, facebook, apple).
 */
internal object IdpHandlerRegistry {

    /**
     * Built-in provider tokens reserved by the native SDKs' case-insensitive `contains`
     * matching. Registration for any name containing one of these is rejected so a custom
     * handler can never shadow a built-in route.
     */
    private val RESERVED_TOKENS = listOf("apple", "siwa", "google", "facebook", "fb-limited")

    private val handlers = ConcurrentHashMap<String, IdpHandler>()

    /**
     * Registers a custom handler for a provider name.
     *
     * Names are normalized to trimmed lowercase before storing, so `"LINE"`, `" line "`, and
     * `"line"` resolve identically. Re-registering an already-registered custom name replaces
     * the previous handler.
     *
     * @param provider Custom provider name as supplied by the app.
     * @param handler Handler invoked when the authorize path resolves this provider.
     * @throws IllegalArgumentException when the provider name is blank or contains a reserved
     * built-in token (matched case-insensitively as a substring, mirroring how the native
     * built-ins route provider names).
     */
    fun register(provider: String, handler: IdpHandler) {
        val normalized = provider.trim().lowercase()
        require(normalized.isNotEmpty()) {
            "Provider name must not be blank for external IdP handler registration."
        }
        val reserved = RESERVED_TOKENS.firstOrNull { normalized.contains(it) }
        require(reserved == null) {
            "Provider name '$provider' conflicts with the built-in '$reserved' provider and cannot be registered."
        }
        handlers[normalized] = handler
    }

    /**
     * Resolves the registered handler for a provider name.
     *
     * Matching is exact on the trimmed lowercase name; unknown providers return null so the
     * authorize path falls through to the native built-in resolution.
     *
     * @param provider Provider name from the active Journey callback.
     * @return The registered handler, or null when no custom handler is registered.
     */
    fun resolve(provider: String): IdpHandler? {
        return handlers[provider.trim().lowercase()]
    }

    /**
     * Removes all registered handlers. Test seam only — the registry survives module cleanup
     * by design, so production code never resets it.
     */
    @VisibleForTesting
    @JvmSynthetic
    internal fun clear() {
        handlers.clear()
    }
}
