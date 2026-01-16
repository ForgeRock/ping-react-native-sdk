package com.reactnativepingidentity.storage

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.Promise
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = RNPingStorageModule.NAME)
class RNPingStorageModule(reactContext: ReactApplicationContext) :
    NativeRNPingStorageSpec(reactContext) {

    override fun getName(): String = NAME

    companion object {
        const val NAME = "RNPingStorage"
    }

    // ---------------------------
    // CONFIGURE
    // ---------------------------
    override fun configure(config: ReadableMap): String {
        // Native common handles validation + registry; keep module thin
        return RNPingStorageCommon.configure(config, reactApplicationContext)
    }

    // ---------------------------
    // SAVE
    // ---------------------------
    override fun save(id: String, item: ReadableMap, promise: Promise) {
        RNPingStorageCommon.save(id, item, promise)
    }

    // ---------------------------
    // GET
    // ---------------------------
    override fun get(id: String, promise: Promise) {
        RNPingStorageCommon.get(id, promise)
    }

    // ---------------------------
    // REMOVE
    // ---------------------------
    override fun remove(id: String, promise: Promise) {
        RNPingStorageCommon.remove(id, promise)
    }
}
