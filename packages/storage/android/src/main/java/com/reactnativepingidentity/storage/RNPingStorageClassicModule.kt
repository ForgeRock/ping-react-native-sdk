package com.reactnativepingidentity.storage

import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.reactnativepingidentity.storage.RNPingStorageCommon

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
        const val NAME = "RNPingStorage"
    }

    override fun getName(): String = NAME

    /**
     * Configure and register session storage configuration (synchronous blocking method).
     *
     * @param config Storage configuration containing fileName and keyAlias
     * @return Unique ID that can be used to reference this storage configuration
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun configureSessionStorage(config: ReadableMap): String {
        return RNPingStorageCommon.configureSessionStorage(config)
    }

    /**
     * Configure and register OIDC storage configuration (synchronous blocking method).
     *
     * @param config Storage configuration containing fileName and keyAlias
     * @return Unique ID that can be used to reference this storage configuration
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun configureOidcStorage(config: ReadableMap): String {
        return RNPingStorageCommon.configureOidcStorage(config)
    }
}
