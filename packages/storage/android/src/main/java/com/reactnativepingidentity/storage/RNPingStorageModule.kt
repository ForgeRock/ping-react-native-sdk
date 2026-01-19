/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.reactnativepingidentity.storage

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.Promise
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

    /**
     * Resolve session storage configuration by id.
     *
     * @param id Storage configuration id
     * @return Serialized storage configuration string
     */
    override fun configureSessionStorage(id: String): String {
        return RNPingStorageCommon.configureSessionStorage(id)
    }

    /**
     * Resolve OIDC storage configuration by id.
     *
     * @param id Storage configuration id
     * @return Serialized storage configuration string
     */
    override fun configureOidcStorage(id: String): String {
        return RNPingStorageCommon.configureOidcStorage(id)
    }
}
