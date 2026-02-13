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
import com.pingidentity.orchestrate.Workflow
import com.pingidentity.storage.CacheStrategy
import com.pingidentity.storage.EncryptedDataStoreStorageConfig
import com.reactnativepingidentity.storage.StorageConfig
import com.reactnativepingidentity.storage.StorageConfigRegistry

/**
 * Builds native Journey workflow instances from parsed JS payloads.
 */
internal class JourneyClientFactory(
    private val sessionStorageRegistry: StorageConfigRegistry,
    private val loggerApplier: (String?) -> Unit
) {

    /**
     * Build a Journey workflow from parsed configuration.
     *
     * @param payload Parsed Journey payload.
     * @return Configured native workflow instance.
     */
    fun build(payload: JourneyClientPayload): Workflow {
        return Journey {
            loggerApplier(payload.loggerId)
            serverUrl = payload.serverUrl
            timeout = 30000

            payload.realm?.let { realm = it }
            payload.cookie?.let { cookie = it }

            if (payload.clientId != null && payload.discoveryEndpoint != null && payload.redirectUri != null) {
                module(Oidc) {
                    clientId = payload.clientId
                    discoveryEndpoint = payload.discoveryEndpoint
                    redirectUri = payload.redirectUri
                    scopes = if (payload.scopes.isEmpty()) {
                        mutableSetOf("openid", "email", "address", "profile", "phone")
                    } else {
                        payload.scopes.toMutableSet()
                    }
                }
            }

            applySessionStorageIfPresent(payload.sessionStorageId)
        }
    }

    private fun com.pingidentity.journey.JourneyConfig.applySessionStorageIfPresent(storageId: String?) {
        if (storageId.isNullOrBlank()) {
            return
        }
        val storageConfig = sessionStorageRegistry.resolve(storageId)

        module(Session) {
            storage {
                applyStorageConfig(storageConfig)
            }
        }
    }

    private fun EncryptedDataStoreStorageConfig.applyStorageConfig(config: StorageConfig) {
        config.fileName?.let { fileName = it }
        config.keyAlias?.let { keyAlias = it }
        config.strongBoxPreferred?.let { strongBoxPreferred = it }
        config.cacheStrategy?.let { cacheStrategy = parseCacheStrategy(it) }
    }

    private fun parseCacheStrategy(rawValue: String): CacheStrategy {
        return when (rawValue.lowercase()) {
            "cache_on_failure" -> CacheStrategy.CACHE_ON_FAILURE
            "no_cache" -> CacheStrategy.NO_CACHE
            "cache" -> CacheStrategy.CACHE
            else -> runCatching { CacheStrategy.valueOf(rawValue) }.getOrDefault(CacheStrategy.NO_CACHE)
        }
    }
}
