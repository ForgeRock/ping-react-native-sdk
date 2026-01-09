package com.reactnativepingidentity.storage

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.core.DataStoreFactory
import com.facebook.react.bridge.*
import com.reactnativepingidentity.core.CoreRuntime
import com.reactnativepingidentity.core.registry.NativeHandle
import com.pingidentity.storage.*
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.File

object RNPingStorageCommon {

  private const val TAG = "RNPingStorageCommon"
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  // Wrap Storage<String> so Core registry stays type-agnostic
  private class StorageHandle(val storage: Storage<String>) : NativeHandle

  // -------------------------------------------------------
  // CONFIGURE (SYNC)
  // -------------------------------------------------------
  @JvmStatic
  fun configure(config: ReadableMap, context: ReactApplicationContext): String {
    return try {
      val map = config.toHashMap()

      // Use background dispatcher to avoid blocking main thread
      val id = runBlocking(Dispatchers.IO) {
        val storage = buildStorage(map, context)
        CoreRuntime.storageRegistry.register(StorageHandle(storage))
      }
      id
    } catch (e: Exception) {
      Log.e(TAG, "Error configuring storage", e)
      throw e
    }
  }

  // -------------------------------------------------------
  // SAVE
  // -------------------------------------------------------
  @JvmStatic
  fun save(id: String, item: ReadableMap, promise: Promise) {
    scope.launch {
      try {
        val storage = resolveStorage(id)
        if (storage == null) {
          promise.reject("SAVE_ERROR", "Invalid storage id")
          return@launch
        }

        val json = JSONObject(item.toHashMap()).toString()

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
  fun getItem(id: String, promise: Promise) {
    scope.launch {
      try {
        val storage = resolveStorage(id)
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
        val out = Arguments.createMap()

        // POC behavior: write everything back as string (same as before)
        json.keys().forEach { key ->
          out.putString(key, json.optString(key, null))
        }

        promise.resolve(out)
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
  fun deleteItem(id: String, promise: Promise) {
    scope.launch {
      try {
        val storage = resolveStorage(id)
        if (storage == null) {
          promise.reject("DELETE_ERROR", "Invalid storage id")
          return@launch
        }

        storage.delete()

        // Mirror iOS: drop the handle after deletion
        CoreRuntime.storageRegistry.remove(id)

        promise.resolve(true)
      } catch (e: Exception) {
        Log.e(TAG, "Error deleting item", e)
        promise.reject("DELETE_ERROR", e)
      }
    }
  }

  // -------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------
  private suspend fun resolveStorage(id: String): Storage<String>? {
    val raw = CoreRuntime.storageRegistry.resolve(id) ?: return null
    val handle = raw as? StorageHandle ?: return null
    return handle.storage
  }

  private fun buildStorage(config: Map<String, Any?>, context: Context): Storage<String> {

    val type = config["type"] as? String
      ?: throw IllegalArgumentException("Missing required 'type' parameter in storage configuration")
    val fileName = config["fileName"] as? String ?: "secure_prefs"

    val cacheStrategy = when ((config["cacheStrategy"] as? String)?.uppercase()) {
      "CACHE" -> CacheStrategy.CACHE
      "CACHE_ON_FAILURE" -> CacheStrategy.CACHE_ON_FAILURE
      else -> CacheStrategy.NO_CACHE
    }

    return when (type.lowercase()) {
      "memory" -> {
        MemoryStorage()
      }

      "datastore" -> {
        val dataStore = createStringDataStore(context, fileName)
        DataStoreStorage(
          dataStore = dataStore,
          cacheStrategy = cacheStrategy
        )
      }

      "encrypted" -> {
        val keyAlias = (config["keyAlias"] as? String) ?: "defaultKey"
        val strongBox = config["strongBoxPreferred"] as? Boolean ?: false

        EncryptedDataStoreStorage<String> {
          this.fileName = fileName
          this.cacheStrategy = cacheStrategy
          this.keyAlias = keyAlias
          this.strongBoxPreferred = strongBox
        }
      }

      else -> {
        throw IllegalArgumentException("Invalid storage type '$type'. Must be 'memory', 'encrypted', or 'datastore'")
      }
    }
  }

  // Same helper from old StorageRegistry (kept as-is for POC parity)
  // Reuses the shared scope to avoid leaking coroutine scopes/threads on repeated configure calls
  private fun createStringDataStore(context: Context, fileName: String): DataStore<String?> {
    return DataStoreFactory.create(
      serializer = DataToJsonSerializer(),
      scope = scope
    ) {
      File(context.filesDir, "datastore/$fileName")
    }
  }
}
