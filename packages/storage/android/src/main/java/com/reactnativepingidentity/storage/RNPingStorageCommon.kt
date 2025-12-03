package com.reactnativepingidentity.storage

import android.util.Log
import com.facebook.react.bridge.*
import com.reactnativepingidentity.core.registries.StorageRegistry
import org.json.JSONObject
import kotlinx.coroutines.*

object RNPingStorageCommon {

    private const val TAG = "RNPingStorageCommon"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // -------------------------------------------------------
    // CONFIGURE (SYNC)
    // -------------------------------------------------------
    @JvmStatic
    fun configure(config: ReadableMap, context: ReactApplicationContext): String {
        val map = config.toHashMap()

        Log.d(TAG, "configure called with $map")

        val id = StorageRegistry.configure(map, context)

        Log.d(TAG, "created storage instance $id")

        return id
    }

    // -------------------------------------------------------
    // SAVE
    // -------------------------------------------------------
    @JvmStatic
    fun save(id: String, item: ReadableMap, promise: Promise) {
      scope.launch {
        try {
          val storage = StorageRegistry.get(id)
          if (storage == null) {
            promise.reject("SAVE_ERROR", "Invalid storage id")
            return@launch
          }

          val json = JSONObject(item.toHashMap()).toString()
          Log.d(TAG, "Saving item for id=$id: $json")

          storage.save(json)

          promise.resolve(true)
        } catch (e: Exception) {
          Log.e(TAG, "Error saving item", e)
          promise.reject("SAVE_ERROR", e)
        }
      }
    }

    // -------------------------------------------------------
    // GET
    // -------------------------------------------------------
    @JvmStatic
    fun get(id: String, promise: Promise) {
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
          Log.e(TAG, "Error getting item", e)
          promise.reject("GET_ERROR", e)
        }
      }
    }

    // -------------------------------------------------------
    // REMOVE
    // -------------------------------------------------------
    @JvmStatic
    fun remove(id: String, promise: Promise) {
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
          Log.e(TAG, "Error deleting item", e)
          promise.reject("DELETE_ERROR", e)
        }
      }
    }
}
