package com.reactnativepingidentity.storage

import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.reactnativepingidentity.storage.RNPingStorageCommon

@ReactModule(name = RNPingStorageClassicModule.NAME)
class RNPingStorageClassicModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "RNPingStorageClassic"
    }

    override fun getName(): String = NAME

    // --------------------------------------------------
    // CONFIGURE (SYNC)
    // --------------------------------------------------
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun configure(config: ReadableMap): String {
        return RNPingStorageCommon.configure(config, reactApplicationContext)
    }

    // --------------------------------------------------
    // SAVE (ASYNC)
    // --------------------------------------------------
    @ReactMethod
    fun save(id: String, item: ReadableMap, promise: Promise) {
        RNPingStorageCommon.save(id, item, promise)
    }

    // --------------------------------------------------
    // GET (ASYNC)
    // --------------------------------------------------
    @ReactMethod
    fun get(id: String, promise: Promise) {
        RNPingStorageCommon.get(id, promise)
    }

    // --------------------------------------------------
    // REMOVE (ASYNC)
    // --------------------------------------------------
    @ReactMethod
    fun remove(id: String, promise: Promise) {
        RNPingStorageCommon.remove(id, promise)
    }
}
