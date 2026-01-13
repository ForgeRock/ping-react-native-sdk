package com.reactnativepingidentity.storage

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.Promise
import com.facebook.react.module.annotations.ReactModule

/**
 * React Native module for Ping Storage (New Architecture/Turbo Module).
 */
@ReactModule(name = RNPingStorageModule.NAME)
class RNPingStorageModule(reactContext: ReactApplicationContext) :
    NativeRNPingStorageSpec(reactContext) {

    override fun getName(): String = NAME

    companion object {
        const val NAME = "RNPingStorage"
    }

    /**
     * Configure session storage.
     * @param config Storage configuration
     * @return Storage instance ID
     */
    override fun configureSessionStorage(config: ReadableMap): String {
        return RNPingStorageCommon.configureSessionStorage(config, reactApplicationContext)
    }

    /**
     * Configure OIDC storage.
     * @param config Storage configuration
     * @return Storage instance ID
     */
    override fun configureOidcStorage(config: ReadableMap): String {
        return RNPingStorageCommon.configureOidcStorage(config, reactApplicationContext)
    }
}
