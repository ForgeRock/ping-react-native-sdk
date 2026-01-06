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
<<<<<<< HEAD
    override fun get(id: String, promise: Promise) {
        RNPingStorageCommon.get(id, promise)
=======
    override fun getItem(id: String, promise: Promise) {
        scope.launch {
            try {
                val storage = StorageRegistry.get(id)
                if (storage == null) {
                    promise.reject("GET_ERROR", "Invalid storage id")
                    return@launch
                }

                val jsonString = storage.get()
                if (jsonString == null) {
                    promise.resolve(null)
                    return@launch
                }

                val json = JSONObject(jsonString)
                val map = Arguments.createMap()
                json.keys().forEach { key ->
                    map.putString(key, json.getString(key))
                }

                promise.resolve(map)

            } catch (e: Exception) {
                Log.e("NativePingStorage", "Error fetching item", e)
                promise.reject("GET_ERROR", e)
            }
        }
>>>>>>> 9cfd8bf (chore: turbomodules minor fixes)
    }

    // ---------------------------
    // DELETE
    // ---------------------------
<<<<<<< HEAD
    override fun remove(id: String, promise: Promise) {
        RNPingStorageCommon.remove(id, promise)
=======
    override fun delete(id: String, promise: Promise) {
        scope.launch {
            try {
                val storage = StorageRegistry.get(id)
                if (storage == null) {
                    promise.reject("DELETE_ERROR", "Invalid storage id")
                    return@launch
                }

                storage.delete()

                promise.resolve(true)

            } catch (e: Exception) {
                Log.e("NativePingStorage", "Error deleting item", e)
                promise.reject("DELETE_ERROR", e)
            }
        }
    }

    override fun invalidate() {
        super.invalidate()
        scope.cancel()
>>>>>>> 9cfd8bf (chore: turbomodules minor fixes)
    }
}
