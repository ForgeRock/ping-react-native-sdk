package com.reactnativepingidentity.storage

import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.reactnativepingidentity.storage.RNPingStorageCommon

/**
 * React Native module for Ping Storage (Classic/Old Architecture).
 */
@ReactModule(name = RNPingStorageClassicModule.NAME)
class RNPingStorageClassicModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "RNPingStorageClassic"
    }

    override fun getName(): String = NAME

    /**
     * Configure session storage (synchronous blocking method).
     * @param config Storage configuration
     * @return Storage instance ID
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun configureSessionStorage(config: ReadableMap): String {
        return RNPingStorageCommon.configureSessionStorage(config, reactApplicationContext)
    }

    /**
     * Configure OIDC storage (synchronous blocking method).
     * @param config Storage configuration
     * @return Storage instance ID
     */
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun configureOidcStorage(config: ReadableMap): String {
        return RNPingStorageCommon.configureOidcStorage(config, reactApplicationContext)
    }
}
