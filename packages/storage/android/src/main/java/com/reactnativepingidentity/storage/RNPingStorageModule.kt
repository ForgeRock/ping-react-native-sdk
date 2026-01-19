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
     * Configure and register session storage configuration.
     *
     * @param config Storage configuration containing fileName and keyAlias
     * @return Unique ID that can be used to reference this storage configuration
     */
    override fun configureSessionStorage(config: ReadableMap): String {
        return RNPingStorageCommon.configureSessionStorage(config)
    }

    /**
     * Configure and register OIDC storage configuration.
     *
     * @param config Storage configuration containing fileName and keyAlias
     * @return Unique ID that can be used to reference this storage configuration
     */
    override fun configureOidcStorage(config: ReadableMap): String {
        return RNPingStorageCommon.configureOidcStorage(config)
    }
}
