package com.reactnativepingidentity.core.registries

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.core.DataStoreFactory
import com.pingidentity.storage.*
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.File
import java.util.UUID

object StorageRegistry {

  private val instances = mutableMapOf<String, Storage<String>>()

  fun configure(config: Map<String, Any?>, context: Context): String {
    Log.d("StorageRegistry", "Configuring storage with: $config")

    val type = config["type"] as? String ?: "encrypted"
    val fileName = config["fileName"] as? String ?: "secure_prefs"

    val cacheStrategy = when ((config["cacheStrategy"] as? String)?.uppercase()) {
      "CACHE" -> CacheStrategy.CACHE
      "CACHE_ON_FAILURE" -> CacheStrategy.CACHE_ON_FAILURE
      else -> CacheStrategy.NO_CACHE
    }

    val storage: Storage<String> = when (type.lowercase()) {
      "memory" -> {
        Log.d("StorageRegistry", "Using MemoryStorage")
        MemoryStorage()
      }

      "datastore" -> {
        Log.d("StorageRegistry", "Using DataStoreStorage fileName=$fileName")
        val dataStore = createStringDataStore(context, fileName)
        DataStoreStorage(
          dataStore = dataStore,
          cacheStrategy = cacheStrategy
        )
      }

      else -> {
        val keyAlias = (config["keyAlias"] as? String) ?: "defaultKey"
        val strongBox = config["strongBoxPreferred"] as? Boolean ?: false

        Log.d(
          "StorageRegistry",
          "Using EncryptedDataStoreStorage fileName=$fileName keyAlias=$keyAlias strongBox=$strongBox"
        )

        EncryptedDataStoreStorage<String> {
          this.fileName = fileName
          this.cacheStrategy = cacheStrategy
          this.keyAlias = keyAlias
          this.strongBoxPreferred = strongBox
        }
      }
    }

    val id = UUID.randomUUID().toString()
    instances[id] = storage

    Log.d("StorageRegistry", "Registered storage instance id=$id")

    return id
  }

  fun get(id: String): Storage<String>? = instances[id]

  private fun createStringDataStore(context: Context, fileName: String): DataStore<String?> {
    return DataStoreFactory.create(
      serializer = DataToJsonSerializer(),
      scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    ) {
      File(context.filesDir, "datastore/$fileName")
    }
  }

  fun printAllRegisteredIds() {
    println("📦 [StorageRegistry] Registered Storage Instances:")
    if (instances.isEmpty()) {
      println("   — none —")
    } else {
      instances.keys.forEach { key ->
        println("   • $key")
      }
    }
  }

  fun listIds(): List<String> {
    return instances.keys.toList()
  }
}
