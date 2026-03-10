/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnstorage

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.pingidentity.rncore.CoreRuntime

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
   * Register session storage with the provided configuration.
   *
   * Creates a storage configuration and registers it with the Core SDK's session storage registry.
   * The actual storage instance is created lazily when first accessed.
   *
   * @param config Configuration map containing storage settings (fileName, keyAlias, etc.)
   * @return Unique ID for the registered storage configuration
   * @throws Exception if configuration fails
   */
  @JvmStatic
  fun registerSessionStorage(config: ReadableMap): String {
    return try {
      val map = config.toHashMap()
      // TODO: Resolve and apply native logger from `loggerId` once storage logger wiring is implemented.
      val storageConfig = buildStorageConfig(map)
      sessionConfigRegistry.register(storageConfig)
    } catch (e: Exception) {
      Log.e(TAG, "Error configuring session storage", e)
      throw e
    }
  }

  /**
   * Register OIDC storage with the provided configuration.
   *
   * Creates a storage configuration and registers it with the Core SDK's OIDC storage registry.
   * The actual storage instance is created lazily when first accessed.
   *
   * @param config Configuration map containing storage settings (fileName, keyAlias, etc.)
   * @return Unique ID for the registered storage configuration
   * @throws Exception if configuration fails
   */
  @JvmStatic
  fun registerOidcStorage(config: ReadableMap): String {
    return try {
      val map = config.toHashMap()
      // TODO: Resolve and apply native logger from `loggerId` once storage logger wiring is implemented.
      val storageConfig = buildStorageConfig(map)
      oidcConfigRegistry.register(storageConfig)
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

  /**
   * Resolve and encode a registered session storage configuration by id.
   */
  @JvmStatic
  fun configureSessionStorage(id: String): WritableMap {
    return try {
      val resolvedConfig = sessionConfigRegistry.resolve(id)
      encodeConfig(resolvedConfig)
    } catch (e: Exception) {
      Log.e(TAG, "Error resolving session storage config", e)
      throw e
    }
  }

  /**
   * Resolve and encode a registered OIDC storage configuration by id.
   */
  @JvmStatic
  fun configureOidcStorage(id: String): WritableMap {
    return try {
      val resolvedConfig = oidcConfigRegistry.resolve(id)
      encodeConfig(resolvedConfig)
    } catch (e: Exception) {
      Log.e(TAG, "Error resolving OIDC storage config", e)
      throw e
    }
  }

  /**
   * Encode a storage configuration object for React Native bridge consumption.
   */
  private fun encodeConfig(config: StorageConfig): WritableMap {
    val map = Arguments.createMap()
    config.keyAlias?.let { map.putString("keyAlias", it) }
    config.fileName?.let { map.putString("fileName", it) }
    config.strongBoxPreferred?.let { map.putBoolean("strongBoxPreferred", it) }
    config.cacheStrategy?.let { map.putString("cacheStrategy", it) }
    return map
  }
}
