/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnstorage

import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.pingidentity.rnstorage.RNPingStorageCommon

/**
 * React Native module for Ping Storage (Classic/Old Architecture).
 *
 * This module provides storage configuration methods for the old React Native architecture.
 * It delegates to [RNPingStorageCommon] for actual implementation.
 *
 * @param reactContext The React application context
 */
@ReactModule(name = RNPingStorageClassicModule.NAME)
class RNPingStorageClassicModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "RNPingStorageClassic"
    }

    /**
     * Return the module name exposed to the React Native bridge.
     */
    override fun getName(): String = NAME

    /**
     * Register session storage configuration (synchronous blocking method).
     *
     * @param config Storage configuration containing fileName and keyAlias
     * @return Unique ID that can be used to reference this storage configuration
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun registerSessionStorage(config: ReadableMap): String {
        return RNPingStorageCommon.registerSessionStorage(config)
    }

    /**
     * Register OIDC storage configuration (synchronous blocking method).
     *
     * @param config Storage configuration containing fileName and keyAlias
     * @return Unique ID that can be used to reference this storage configuration
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun registerOidcStorage(config: ReadableMap): String {
        return RNPingStorageCommon.registerOidcStorage(config)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun registerBindingUserKeyStorage(config: ReadableMap): String {
        return RNPingStorageCommon.registerBindingUserKeyStorage(config)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun registerPushStorage(config: ReadableMap): String {
        return RNPingStorageCommon.registerPushStorage(config)
    }

    /**
     * Register OATH storage configuration (synchronous blocking method).
     *
     * @param config Storage configuration containing databaseName
     * @return Unique ID that can be used to reference this storage configuration
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun registerOathStorage(config: ReadableMap): String {
        return RNPingStorageCommon.registerOathStorage(config)
    }

    /**
     * Resolve session storage configuration by id (synchronous blocking method).
     *
     * @param id Storage configuration id
     * @return Storage configuration map
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun configureSessionStorage(id: String): WritableMap {
        return RNPingStorageCommon.configureSessionStorage(id)
    }

    /**
     * Resolve OIDC storage configuration by id (synchronous blocking method).
     *
     * @param id Storage configuration id
     * @return Storage configuration map
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun configureOidcStorage(id: String): WritableMap {
        return RNPingStorageCommon.configureOidcStorage(id)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun configureBindingUserKeyStorage(id: String): WritableMap {
        return RNPingStorageCommon.configureBindingUserKeyStorage(id)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun configurePushStorage(id: String): WritableMap {
        return RNPingStorageCommon.configurePushStorage(id)
    }

    /**
     * Resolve OATH storage configuration by id (synchronous blocking method).
     *
     * @param id Storage configuration id
     * @return Storage configuration map
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun configureOathStorage(id: String): WritableMap {
        return RNPingStorageCommon.configureOathStorage(id)
    }
}
