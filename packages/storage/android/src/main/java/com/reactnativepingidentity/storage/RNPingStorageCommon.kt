package com.reactnativepingidentity.storage

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.core.DataStoreFactory
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.reactnativepingidentity.core.CoreRuntime
import com.reactnativepingidentity.core.registry.NativeHandle
import com.pingidentity.storage.*
import kotlinx.coroutines.*
import java.io.File

object RNPingStorageCommon {

  private const val TAG = "RNPingStorageCommon"
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  /** Wrap Storage<String> so Core registry stays type-agnostic */
  private class StorageHandle(val storage: Storage<String>) : NativeHandle

  /**
   * Configure session storage with the provided configuration.
   * @param config Configuration map containing storage settings
   * @param context React application context
   * @return Unique ID for the configured storage
   */
  @JvmStatic
  fun configureSessionStorage(config: ReadableMap, context: ReactApplicationContext): String {
    return try {
      val map = config.toHashMap()

      val id = runBlocking(Dispatchers.IO) {
        val storage = buildStorage(map, context)
        registerSessionStorage(storage)
      }
      id
    } catch (e: Exception) {
      Log.e(TAG, "Error configuring session storage", e)
      throw e
    }
  }

  /**
   * Configure OIDC storage with the provided configuration.
   * @param config Configuration map containing storage settings
   * @param context React application context
   * @return Unique ID for the configured storage
   */
  @JvmStatic
  fun configureOidcStorage(config: ReadableMap, context: ReactApplicationContext): String {
    return try {
      val map = config.toHashMap()

      val id = runBlocking(Dispatchers.IO) {
        val storage = buildStorage(map, context)
        registerOidcStorage(storage)
      }
      id
    } catch (e: Exception) {
      Log.e(TAG, "Error configuring OIDC storage", e)
      throw e
    }
  }

  /**
   * Register session storage in the core registry.
   * @param storage The storage instance to register
   * @return The unique ID for the registered storage
   */
  private suspend fun registerSessionStorage(storage: Storage<String>): String {
    val handle = StorageHandle(storage)
    return CoreRuntime.sessionStorageRegistry.register(handle)
  }

  /**
   * Register OIDC storage in the core registry.
   * @param storage The storage instance to register
   * @return The unique ID for the registered storage
   */
  private suspend fun registerOidcStorage(storage: Storage<String>): String {
    val handle = StorageHandle(storage)
    return CoreRuntime.oidcStorageRegistry.register(handle)
  }

  /**
   * Build a storage instance based on the provided configuration.
   * @param config Configuration map containing storage type and settings
   * @param context Android context
   * @return Configured storage instance
   */
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

  /**
   * Create a DataStore for string values.
   * Same helper from old StorageRegistry (kept as-is for POC parity).
   * Reuses the shared scope to avoid leaking coroutine scopes/threads on repeated configure calls.
   * @param context Android context
   * @param fileName Name of the file for the DataStore
   * @return DataStore instance for nullable strings
   */
  private fun createStringDataStore(context: Context, fileName: String): DataStore<String?> {
    return DataStoreFactory.create(
      serializer = DataToJsonSerializer(),
      scope = scope
    ) {
      File(context.filesDir, "datastore/$fileName")
    }
  }
}
