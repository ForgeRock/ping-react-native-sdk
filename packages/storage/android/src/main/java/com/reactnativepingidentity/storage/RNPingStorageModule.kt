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

fun createStringDataStore(context: Context, fileName: String): DataStore<String?> {
    return DataStoreFactory.create(
        serializer = DataToJsonSerializer(),
        scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    ) {
        File(context.filesDir, "datastore/$fileName")
    }
}

// ---------------------------
// INSTANCE REGISTRY (NEW)
// ---------------------------
object StorageRegistry {
    private val instances = mutableMapOf<String, Storage<String>>()

    fun create(storage: Storage<String>): String {
        val id = java.util.UUID.randomUUID().toString()
        instances[id] = storage
        return id
    }

    fun get(id: String): Storage<String>? = instances[id]
}

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
    override fun configure(config: ReadableMap, promise: Promise) {
        scope.launch {
            try {
                Log.d("NativePingStorage", "Configuring storage with: $config")

                val type = config.getString("type") ?: "encrypted"
                val fileName = config.getString("fileName") ?: "secure_prefs"

                val cacheStrategy = when (config.getString("cacheStrategy")?.uppercase()) {
                    "CACHE" -> CacheStrategy.CACHE
                    "CACHE_ON_FAILURE" -> CacheStrategy.CACHE_ON_FAILURE
                    else -> CacheStrategy.NO_CACHE
                }

                val storage: Storage<String> = when (type) {
                    "memory" -> {
                        Log.d("NativePingStorage", "Using MemoryStorage")
                        MemoryStorage()
                    }

                    "datastore" -> {
                        Log.d("NativePingStorage", "Using DataStoreStorage with fileName=$fileName")
                        val dataStore = createStringDataStore(reactApplicationContext, fileName)
                        DataStoreStorage(
                            dataStore = dataStore,
                            cacheStrategy = cacheStrategy
                        )
                    }

                    else -> {
                        val keyAlias =
                            config.getString("keyAlias").takeIf { config.hasKey("keyAlias") }
                                ?: "defaultKey"
                        val strongBox =
                            config.hasKey("strongBoxPreferred") && config.getBoolean("strongBoxPreferred")

                        Log.d(
                            "NativePingStorage",
                            "Using EncryptedDataStoreStorage with fileName=$fileName, keyAlias=$keyAlias, strongBox=$strongBox"
                        )

                        EncryptedDataStoreStorage<String> {
                            this.fileName = fileName
                            this.cacheStrategy = cacheStrategy
                            this.keyAlias = keyAlias
                            this.strongBoxPreferred = strongBox
                        }
                    }
                }

                // Create an instance ID
                val id = StorageRegistry.create(storage)

                Log.d("NativePingStorage", "Storage configured successfully. id=$id")
                promise.resolve(id)

            } catch (e: Exception) {
                Log.e("NativePingStorage", "Error configuring storage", e)
                promise.reject("CONFIG_ERROR", e)
            }
        }
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
