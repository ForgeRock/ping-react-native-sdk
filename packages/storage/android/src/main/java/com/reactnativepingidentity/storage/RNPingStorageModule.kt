package com.reactnativepingidentity.storage

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.core.DataStoreFactory
import com.facebook.react.bridge.*
import com.pingidentity.storage.*
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.File
import com.reactnativepingidentity.core.registries.StorageRegistry

@ReactModule(name = RNPingStorageModule.NAME)
class RNPingStorageModule(reactContext: ReactApplicationContext) :
    NativeRNPingStorageSpec(reactContext) {

    override fun getName(): String = NAME

    companion object {
        const val NAME = "RNPingStorage"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // ---------------------------
    // CONFIGURE
    // ---------------------------
    override fun configure(config: ReadableMap): String {
          val map = config.toHashMap()
          val id = StorageRegistry.configure(map, reactApplicationContext)
          return id
    }

    // ---------------------------
    // SAVE
    // ---------------------------
    override fun save(id: String, item: ReadableMap, promise: Promise) {
        scope.launch {
            try {
                val storage = StorageRegistry.get(id)
                if (storage == null) {
                    promise.reject("SAVE_ERROR", "Invalid storage id")
                    return@launch
                }

                val jsonString = JSONObject(item.toHashMap()).toString()
                Log.d("NativePingStorage", "Saving item for id=$id: $jsonString")

                storage.save(jsonString)

                promise.resolve(true)

            } catch (e: Exception) {
                Log.e("NativePingStorage", "Error saving item", e)
                promise.reject("SAVE_ERROR", e)
            }
        }
    }

    // ---------------------------
    // GET
    // ---------------------------
    override fun get(id: String, promise: Promise) {
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
    }

    // ---------------------------
    // REMOVE
    // ---------------------------
    override fun remove(id: String, promise: Promise) {
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
    }
}
