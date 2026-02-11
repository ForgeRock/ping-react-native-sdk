/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.reactnative.rnstorage

import com.reactnativepingidentity.core.registry.Registry

/**
 * Registry for managing storage configurations.
 *
 * This class provides methods to register, resolve, and manage storage configurations
 * using the underlying [Registry] implementation.
 *
 * @property registry The underlying registry implementation
 */
class StorageConfigRegistry(private val registry: Registry) {
    
    /**
     * Register a storage configuration.
     *
     * @param config The storage configuration to register
     * @return Unique ID for the registered configuration
     */
    fun register(config: StorageConfig): String {
        return registry.register(StorageConfigHandle(config))
    }

    /**
     * Resolve a storage configuration by its ID.
     *
     * @param id The unique ID of the storage configuration
     * @return The [StorageConfig] associated with the ID
     * @throws IllegalStateException if no configuration is found for the given ID
     */
    fun resolve(id: String): StorageConfig {
        val handle = registry.resolve(id) as? StorageConfigHandle
        return handle?.config ?: error("No storage config registered for id=$id")
    }

    /**
     * Remove a storage configuration by its ID.
     *
     * @param id The unique ID of the storage configuration to remove
     */
    fun remove(id: String) {
        registry.remove(id)
    }

    /**
     * Clear all registered storage configurations.
     */
    fun clear() {
        registry.removeAll()
    }
}
