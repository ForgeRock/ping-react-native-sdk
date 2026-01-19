package com.reactnativepingidentity.storage

import android.util.Log
import com.facebook.react.bridge.ReadableMap
import com.reactnativepingidentity.core.CoreRuntime
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking

/**
 * Common storage configuration logic shared between Classic and New Architecture modules.
 *
 * This object provides the core implementation for configuring session and OIDC storage,
 * managing storage configuration registries, and building storage configurations.
 */
object RNPingStorageCommon {

  /** Tag for logging purposes */
  private const val TAG = "RNPingStorageCommon"
  
  /** Registry for session storage configurations */
  private val sessionConfigRegistry = StorageConfigRegistry(CoreRuntime.sessionStorageConfigRegistry)
  
  /** Registry for OIDC storage configurations */
  private val oidcConfigRegistry = StorageConfigRegistry(CoreRuntime.oidcStorageConfigRegistry)

  /**
   * Configure session storage with the provided configuration.
   * 
   * Creates a storage configuration and registers it with the Core SDK's session storage registry.
   * The actual storage instance is created lazily when first accessed.
   *
   * @param config Configuration map containing storage settings (fileName, keyAlias, etc.)
   * @return Unique ID for the configured storage that can be used to reference this configuration
   * @throws Exception if configuration fails
   */
  @JvmStatic
  fun configureSessionStorage(config: ReadableMap): String {
    return try {
      val map = config.toHashMap()

      val id = runBlocking(Dispatchers.IO) {
        val storageConfig = buildStorageConfig(map)
        sessionConfigRegistry.register(storageConfig)
      }
      id
    } catch (e: Exception) {
      Log.e(TAG, "Error configuring session storage", e)
      throw e
    }
  }

  /**
   * Configure OIDC storage with the provided configuration.
   * 
   * Creates a storage configuration and registers it with the Core SDK's OIDC storage registry.
   * The actual storage instance is created lazily when first accessed.
   *
   * @param config Configuration map containing storage settings (fileName, keyAlias, etc.)
   * @return Unique ID for the configured storage that can be used to reference this configuration
   * @throws Exception if configuration fails
   */
  @JvmStatic
  fun configureOidcStorage(config: ReadableMap): String {
    return try {
      val map = config.toHashMap()

      val id = runBlocking(Dispatchers.IO) {
        val storageConfig = buildStorageConfig(map)
        oidcConfigRegistry.register(storageConfig)
      }
      id
    } catch (e: Exception) {
      Log.e(TAG, "Error configuring OIDC storage", e)
      throw e
    }
  }

  /**
   * Build a storage configuration based on the provided configuration map.
   *
   * @param config Configuration map containing optional storage settings:
   *   - fileName: File name for persistent storage (default: "secure_prefs")
   *   - keyAlias: Encryption key alias for Android Keystore (default: "defaultKey")
   *   - strongBoxPreferred: Whether to prefer StrongBox-backed keys (default: null)
   *   - cacheStrategy: Cache strategy string (NO_CACHE, CACHE, or CACHE_ON_FAILURE)
   * @return Normalized [StorageConfig] instance with all configuration values
   */
  private fun buildStorageConfig(config: Map<String, Any?>): StorageConfig {

    val fileName = config["fileName"] as? String ?: "secure_prefs"
    val keyAlias = (config["keyAlias"] as? String) ?: "defaultKey"
    val strongBoxPreferred = config["strongBoxPreferred"] as? Boolean
    val cacheStrategy = config["cacheStrategy"] as? String
    return StorageConfig(
      keyAlias = keyAlias,
      fileName = fileName,
      strongBoxPreferred = strongBoxPreferred,
      cacheStrategy = cacheStrategy
    )
  }
}
