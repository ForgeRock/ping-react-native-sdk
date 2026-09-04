/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rndavinci.factory

import com.pingidentity.davinci.DaVinci
import com.pingidentity.davinci.module.Oidc
import com.pingidentity.oidc.OidcClientConfig
import com.pingidentity.orchestrate.Workflow
import com.pingidentity.rncore.logger.LoggerHandleContract
import com.pingidentity.rncore.registry.Registry
import com.pingidentity.rncore.storage.StorageConfigHandleContract
import com.pingidentity.rndavinci.config.DaVinciClientPayload
import com.pingidentity.storage.CacheStrategy
import com.pingidentity.storage.EncryptedDataStoreStorageConfig
// ProtectLifecycle is compileOnly (provided by rn-protect); guarded at runtime with NoClassDefFoundError.
import com.pingidentity.protect.ProtectLifecycle

/**
 * Builds native DaVinci workflow instances from parsed JS payloads.
 *
 * @param oidcStorageRegistry Registry used to resolve OIDC storage handles from JS.
 * @param loggerRegistry Registry used to resolve logger handles from JS.
 */
internal class DaVinciClientFactory(
    private val oidcStorageRegistry: Registry,
    private val loggerRegistry: Registry,
) {

    private data class ResolvedOidcConfig(
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

    private fun resolveOidcConfig(payload: DaVinciClientPayload): ResolvedOidcConfig {
        val oidc = payload.oidc
        return ResolvedOidcConfig(
            discoveryEndpoint = oidc.discoveryEndpoint,
            clientId = oidc.clientId,
            redirectUri = oidc.redirectUri,
            scopes = oidc.scopes,
            par = oidc.par,
            storageId = oidc.storageId,
            signOutRedirectUri = oidc.signOutRedirectUri,
            loginHint = oidc.loginHint,
            nonce = oidc.nonce,
            state = oidc.state,
            prompt = oidc.prompt,
            display = oidc.display,
            uiLocales = oidc.uiLocales,
            acrValues = oidc.acrValues,
            refreshThreshold = oidc.refreshThreshold,
            additionalParameters = oidc.additionalParameters,
        )
    }

    /**
     * Build a DaVinci workflow from parsed configuration.
     *
     * @param payload Parsed DaVinci payload.
     * @return Configured native workflow instance.
     * @throws IllegalArgumentException if payload values are invalid for native SDK setup.
     */
    fun build(payload: DaVinciClientPayload): Workflow {
        val resolvedOidcConfig = resolveOidcConfig(payload)
        val resolvedLogger = resolveLogger(payload.loggerId)
        return DaVinci {
            resolvedLogger?.let { logger = it }
            payload.timeout?.let { timeout = it }

            module(Oidc) {
                discoveryEndpoint = resolvedOidcConfig.discoveryEndpoint
                clientId = resolvedOidcConfig.clientId
                redirectUri = resolvedOidcConfig.redirectUri
                scopes = resolvedOidcConfig.scopes.toMutableSet()
                resolvedOidcConfig.par?.let { par = it }
                resolvedOidcConfig.signOutRedirectUri?.let { signOutRedirectUri = it }
                resolvedOidcConfig.loginHint?.let { loginHint = it }
                resolvedOidcConfig.nonce?.let { nonce = it }
                resolvedOidcConfig.state?.let { state = it }
                resolvedOidcConfig.prompt?.let { prompt = it }
                resolvedOidcConfig.display?.let { display = it }
                resolvedOidcConfig.uiLocales?.let { uiLocales = it }
                resolvedOidcConfig.acrValues?.let { acrValues = it }
                resolvedOidcConfig.refreshThreshold?.let { refreshThreshold = it }
                if (resolvedOidcConfig.additionalParameters.isNotEmpty()) {
                    additionalParameters = resolvedOidcConfig.additionalParameters
                }
                applyOidcStorageIfPresent(resolvedOidcConfig.storageId)
            }

            payload.protect?.let { protect ->
                try {
                    module(ProtectLifecycle) {
                        protect.envId?.let { envId = it }
                        isBehavioralDataCollection = protect.isBehavioralDataCollection
                        isLazyMetadata = protect.isLazyMetadata
                        protect.customHost?.let { customHost = it }
                        isConsoleLogEnabled = protect.isConsoleLogEnabled
                        if (protect.deviceAttributesToIgnore.isNotEmpty()) {
                            deviceAttributesToIgnore = protect.deviceAttributesToIgnore
                        }
                        pauseBehavioralDataOnSuccess = protect.pauseBehavioralDataOnSuccess
                        resumeBehavioralDataOnStart = protect.resumeBehavioralDataOnStart
                    }
                } catch (e: NoClassDefFoundError) {
                    logger?.e("modules.protect was configured but the PingOne Protect SDK is not on the classpath; ProtectLifecycle was NOT registered. Add com.pingidentity.sdks:protect.", e)
                }
            }
        }
    }

    /**
     * Resolves a native logger from the shared Core logger registry.
     *
     * @param id Logger handle identifier from JS.
     * @return Native logger instance, or null when missing/invalid.
     */
    private fun resolveLogger(id: String?): com.pingidentity.logger.Logger? {
        id ?: return null
        if (id.isBlank()) return null
        val handle = loggerRegistry.resolve(id) as? LoggerHandleContract ?: return null
        return handle.nativeLogger as? com.pingidentity.logger.Logger
    }

    /**
     * Applies OIDC storage configuration when a storage id is present.
     *
     * @param storageId Optional OIDC storage handle id.
     * @throws IllegalArgumentException if the storage id cannot be resolved.
     */
    private fun OidcClientConfig.applyOidcStorageIfPresent(storageId: String?) {
        if (storageId.isNullOrBlank()) return
        val storageConfig = oidcStorageRegistry.resolve(storageId) as? StorageConfigHandleContract
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
