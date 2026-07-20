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
import com.pingidentity.rncore.network.okHttpClient
import com.pingidentity.rndavinci.config.DaVinciClientPayload
import com.pingidentity.storage.CacheStrategy
import com.pingidentity.storage.EncryptedDataStoreStorageConfig

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

    /**
     * Build a DaVinci workflow from parsed configuration.
     *
     * @param payload Parsed DaVinci payload.
     * @return Configured native workflow instance.
     * @throws IllegalArgumentException if payload values are invalid for native SDK setup.
     */
    fun build(payload: DaVinciClientPayload): Workflow {
        val resolvedLogger = resolveLogger(payload.loggerId)
        return DaVinci {
            // SDKS-5217 Option C-alt PoC — temporary, not for merge.
            httpClient = okHttpClient()
            resolvedLogger?.let { logger = it }
            payload.timeout?.let { timeout = it }

            module(Oidc) {
                discoveryEndpoint = payload.discoveryEndpoint
                clientId = payload.clientId
                redirectUri = payload.redirectUri
                scopes = payload.scopes.toMutableSet()
                payload.signOutRedirectUri?.let { signOutRedirectUri = it }
                payload.loginHint?.let { loginHint = it }
                payload.nonce?.let { nonce = it }
                payload.state?.let { state = it }
                payload.prompt?.let { prompt = it }
                payload.display?.let { display = it }
                payload.uiLocales?.let { uiLocales = it }
                payload.acrValues?.let { acrValues = it }
                payload.refreshThreshold?.let { refreshThreshold = it }
                if (payload.additionalParameters.isNotEmpty()) {
                    additionalParameters = payload.additionalParameters
                }
                applyOidcStorageIfPresent(payload.storageId)
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
