/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnstorage

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule

/**
 * React Native module for Ping Storage (New Architecture/Turbo Module).
 *
 * This module provides storage configuration methods for the new React Native architecture.
 * It delegates to [RNPingStorageCommon] for actual implementation.
 *
 * @param reactContext The React application context
 */
@ReactModule(name = RNPingStorageModule.NAME)
class RNPingStorageModule(reactContext: ReactApplicationContext) :
    NativeRNPingStorageSpec(reactContext) {

    /**
     * Return the module name exposed to the React Native bridge.
     */
    override fun getName(): String = NAME

    companion object {
        const val NAME = "RNPingStorage"
    }

    /**
     * Register session storage configuration.
     *
     * @param config Storage configuration containing fileName and keyAlias
     * @return Unique ID that can be used to reference this storage configuration
     */
    override fun registerSessionStorage(config: ReadableMap): String {
        return RNPingStorageCommon.registerSessionStorage(config)
    }

    /**
     * Register OIDC storage configuration.
     *
     * @param config Storage configuration containing fileName and keyAlias
     * @return Unique ID that can be used to reference this storage configuration
     */
    override fun registerOidcStorage(config: ReadableMap): String {
        return RNPingStorageCommon.registerOidcStorage(config)
    }

    override fun registerBindingUserKeyStorage(config: ReadableMap): String {
        return RNPingStorageCommon.registerBindingUserKeyStorage(config)
    }

    /**
     * Resolve session storage configuration by id.
     *
     * @param id Storage configuration id
     * @return Storage configuration map
     */
    override fun configureSessionStorage(id: String): WritableMap {
        return RNPingStorageCommon.configureSessionStorage(id)
    }

    /**
     * Resolve OIDC storage configuration by id.
     *
     * @param id Storage configuration id
     * @return Storage configuration map
     */
    override fun configureOidcStorage(id: String): WritableMap {
        return RNPingStorageCommon.configureOidcStorage(id)
    }

    override fun configureBindingUserKeyStorage(id: String): WritableMap {
        return RNPingStorageCommon.configureBindingUserKeyStorage(id)
    }
}
