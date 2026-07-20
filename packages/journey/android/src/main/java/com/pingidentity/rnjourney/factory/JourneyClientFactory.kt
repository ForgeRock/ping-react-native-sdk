/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.pingidentity.journey.Journey
import com.pingidentity.journey.module.Oidc
import com.pingidentity.journey.module.Session
import com.pingidentity.oidc.OidcClientConfig
import com.pingidentity.oidc.OpenIdConfiguration
import com.pingidentity.orchestrate.Workflow
import com.pingidentity.storage.CacheStrategy
import com.pingidentity.storage.EncryptedDataStoreStorageConfig
import com.pingidentity.rncore.CoreRuntime
import com.pingidentity.rncore.network.okHttpClient
import com.pingidentity.rncore.oidc.OidcClientConfigHandle
import com.pingidentity.rncore.oidc.OidcOpenIdConfig
import com.pingidentity.rncore.registry.Registry
import com.pingidentity.rncore.storage.StorageConfigHandleContract

/**
 * Builds native Journey workflow instances from parsed JS payloads.
 *
 * @param sessionStorageRegistry Registry used to resolve session storage handles from JS.
 * @param oidcStorageRegistry Registry used to resolve OIDC storage handles from JS.
 * @param loggerResolver Resolver that maps logger ids to native logger instances.
 */
internal class JourneyClientFactory(
    private val sessionStorageRegistry: Registry,
    private val oidcStorageRegistry: Registry,
    private val loggerResolver: (String?) -> com.pingidentity.logger.Logger?
) {

    /**
     * OIDC settings resolved from either direct Journey config or shared OIDC client handles.
     */
    private data class ResolvedOidcConfig(
        val clientId: String,
        val discoveryEndpoint: String?,
        val redirectUri: String,
        val scopes: List<String>,
        val openId: OidcOpenIdConfig?,
        val acrValues: String?,
        val signOutRedirectUri: String?,
        val state: String?,
        val nonce: String?,
        val uiLocales: String?,
        val refreshThreshold: Long?,
        val loginHint: String?,
        val display: String?,
        val prompt: String?,
        val additionalParameters: Map<String, String>
    )

    /**
     * Build a Journey workflow from parsed configuration.
     *
     * @param payload Parsed Journey payload.
     * @return Configured native workflow instance.
     * @throws IllegalArgumentException if payload values are invalid for native SDK setup.
     * @throws IllegalStateException if module configuration fails.
     */
    fun build(payload: JourneyClientPayload): Workflow {
        val resolvedLogger = loggerResolver(payload.loggerId)
        return Journey {
            // SDKS-5217 Option C-alt PoC — temporary, not for merge.
            httpClient = okHttpClient()
            resolvedLogger?.let { logger = it }
            serverUrl = payload.serverUrl
            payload.timeout?.let { timeout = it }

            payload.realm?.let { realm = it }
            payload.cookie?.let { cookie = it }

            resolveOidcConfig(payload)?.let { oidcConfig ->
                module(Oidc) {
                    clientId = oidcConfig.clientId
                    oidcConfig.discoveryEndpoint?.let { discoveryEndpoint = it }
                    redirectUri = oidcConfig.redirectUri
                    scopes = oidcConfig.scopes.toMutableSet()
                    acrValues = oidcConfig.acrValues
                    signOutRedirectUri = oidcConfig.signOutRedirectUri
                    state = oidcConfig.state
                    nonce = oidcConfig.nonce
                    uiLocales = oidcConfig.uiLocales
                    oidcConfig.refreshThreshold?.let { refreshThreshold = it }
                    loginHint = oidcConfig.loginHint
                    display = oidcConfig.display
                    prompt = oidcConfig.prompt
                    if (oidcConfig.additionalParameters.isNotEmpty()) {
                        additionalParameters = oidcConfig.additionalParameters
                    }
                    oidcConfig.openId?.let { openIdConfig ->
                        openId = OpenIdConfiguration(
                            authorizationEndpoint = openIdConfig.authorizationEndpoint,
                            tokenEndpoint = openIdConfig.tokenEndpoint,
                            userinfoEndpoint = openIdConfig.userinfoEndpoint,
                            endSessionEndpoint = openIdConfig.endSessionEndpoint ?: "",
                            pingEndIdpSessionEndpoint = openIdConfig.pingEndIdpSessionEndpoint ?: "",
                            revocationEndpoint = openIdConfig.revocationEndpoint ?: ""
                        )
                    }
                    applyOidcStorageIfPresent(payload.oidc?.storageId)
                }
            }

            applySessionStorageIfPresent(payload.sessionStorageId)
        }
    }

    /**
     * Resolves OIDC settings from shared OIDC handles or direct Journey config fields.
     *
     * @param payload Parsed Journey payload.
     * @return Resolved OIDC settings, or null when OIDC is not configured.
     * @throws IllegalArgumentException when OIDC handle resolution fails or required values are missing.
     */
    private fun resolveOidcConfig(payload: JourneyClientPayload): ResolvedOidcConfig? {
        val oidcPayload = payload.oidc ?: return null
        val oidcClientId = oidcPayload.clientHandleId
        if (!oidcClientId.isNullOrBlank()) {
            return resolveOidcConfigFromHandle(oidcClientId)
        }

        val hasDiscoveryConfig = !oidcPayload.clientId.isNullOrBlank() &&
            !oidcPayload.discoveryEndpoint.isNullOrBlank() &&
            !oidcPayload.redirectUri.isNullOrBlank()
        val hasOpenIdConfig = !oidcPayload.clientId.isNullOrBlank() &&
            oidcPayload.openId != null &&
            !oidcPayload.redirectUri.isNullOrBlank()
        if (!hasDiscoveryConfig && !hasOpenIdConfig) {
            return null
        }

        return ResolvedOidcConfig(
            clientId = oidcPayload.clientId!!,
            discoveryEndpoint = oidcPayload.discoveryEndpoint?.trim(),
            redirectUri = oidcPayload.redirectUri!!,
            scopes = oidcPayload.scopes,
            openId = oidcPayload.openId?.toCoreOpenIdConfig(),
            acrValues = oidcPayload.acrValues,
            signOutRedirectUri = oidcPayload.signOutRedirectUri,
            state = oidcPayload.state,
            nonce = oidcPayload.nonce,
            uiLocales = oidcPayload.uiLocales,
            refreshThreshold = oidcPayload.refreshThreshold,
            loginHint = oidcPayload.loginHint,
            display = oidcPayload.display,
            prompt = oidcPayload.prompt,
            additionalParameters = oidcPayload.additionalParameters
        )
    }

    /**
     * Resolves OIDC settings from a registered OIDC client handle.
     *
     * @param oidcClientId OIDC client id returned by `@ping-identity/rn-oidc`.
     * @return Resolved OIDC settings.
     * @throws IllegalArgumentException when the handle cannot be resolved or is missing required fields.
     */
    private fun resolveOidcConfigFromHandle(oidcClientId: String): ResolvedOidcConfig {
        val handle = CoreRuntime.oidcClientRegistry.resolve(oidcClientId) as? OidcClientConfigHandle
            ?: throw IllegalArgumentException("OIDC client instance not found for id=$oidcClientId")

        val discoveryEndpoint = handle.discoveryEndpoint?.trim()
        if (discoveryEndpoint.isNullOrEmpty() && handle.openId == null) {
            throw IllegalArgumentException(
                "OIDC client id=$oidcClientId does not expose discoveryEndpoint or openId. " +
                    "Configure OIDC with discoveryEndpoint or openId before composing Journey."
            )
        }

        return ResolvedOidcConfig(
            clientId = handle.clientId,
            discoveryEndpoint = discoveryEndpoint,
            redirectUri = handle.redirectUri,
            scopes = handle.scopes,
            openId = handle.openId,
            acrValues = handle.acrValues,
            signOutRedirectUri = handle.signOutRedirectUri,
            state = handle.state,
            nonce = handle.nonce,
            uiLocales = handle.uiLocales,
            refreshThreshold = handle.refreshThreshold,
            loginHint = handle.loginHint,
            display = handle.display,
            prompt = handle.prompt,
            additionalParameters = handle.additionalParameters
        )
    }

    /**
     * Maps parser OpenID payload into shared core OpenID config.
     *
     * @return Shared core OpenID config.
     */
    private fun JourneyOpenIdPayload.toCoreOpenIdConfig(): OidcOpenIdConfig {
        return OidcOpenIdConfig(
            authorizationEndpoint = authorizationEndpoint,
            tokenEndpoint = tokenEndpoint,
            userinfoEndpoint = userinfoEndpoint,
            endSessionEndpoint = endSessionEndpoint,
            pingEndIdpSessionEndpoint = pingEndIdpSessionEndpoint,
            revocationEndpoint = revocationEndpoint
        )
    }

    /**
     * Applies session storage module configuration when a storage id is present.
     *
     * @param storageId Optional storage handle id resolved from JavaScript modules payload.
     * @throws IllegalStateException if the storage id cannot be resolved.
     */
    private fun com.pingidentity.journey.JourneyConfig.applySessionStorageIfPresent(storageId: String?) {
        if (storageId.isNullOrBlank()) {
            return
        }
        val storageConfig =
            sessionStorageRegistry.resolve(storageId) as? StorageConfigHandleContract
                ?: throw IllegalArgumentException("No session storage config registered for id=$storageId")

        module(Session) {
            storage {
                applyStorageConfig(storageConfig)
            }
        }
    }

    /**
     * Applies OIDC storage module configuration when a storage id is present.
     *
     * @param storageId Optional OIDC storage handle id resolved from JavaScript modules payload.
     * @throws IllegalStateException if the storage id cannot be resolved.
     */
    private fun OidcClientConfig.applyOidcStorageIfPresent(storageId: String?) {
        if (storageId.isNullOrBlank()) {
            return
        }
        val storageConfig =
            oidcStorageRegistry.resolve(storageId) as? StorageConfigHandleContract
                ?: throw IllegalArgumentException("No OIDC storage config registered for id=$storageId")
        storage {
            applyStorageConfig(storageConfig)
        }
    }

    /**
     * Applies storage configuration fields to native encrypted datastore storage settings.
     *
     * @param config Parsed storage configuration from the shared storage registry.
     */
    private fun EncryptedDataStoreStorageConfig.applyStorageConfig(config: StorageConfigHandleContract) {
        config.fileName?.let { fileName = it }
        config.keyAlias?.let { keyAlias = it }
        config.strongBoxPreferred?.let { strongBoxPreferred = it }
        config.cacheStrategy?.let { cacheStrategy = parseCacheStrategy(it) }
    }

    /**
     * Maps wire cache strategy strings to native enum values.
     *
     * @param rawValue Raw cache strategy value from JavaScript.
     * @return Native cache strategy enum.
     */
    private fun parseCacheStrategy(rawValue: String): CacheStrategy {
        return when (rawValue.lowercase()) {
            "cache_on_failure" -> CacheStrategy.CACHE_ON_FAILURE
            "no_cache" -> CacheStrategy.NO_CACHE
            "cache" -> CacheStrategy.CACHE
            else -> runCatching { CacheStrategy.valueOf(rawValue) }.getOrDefault(CacheStrategy.NO_CACHE)
        }
    }
}
