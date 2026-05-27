/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnstorage

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


  /** Registry for session storage configurations */
  private val sessionConfigRegistry = StorageConfigRegistry(CoreRuntime.sessionStorageConfigRegistry)

  /** Registry for OIDC storage configurations */
  private val oidcConfigRegistry = StorageConfigRegistry(CoreRuntime.oidcStorageConfigRegistry)
  /** Registry for binding user-key storage configurations */
  private val bindingUserKeyConfigRegistry =
    StorageConfigRegistry(CoreRuntime.bindingUserKeyStorageConfigRegistry)

  /** Registry for push MFA storage configurations */
  private val pushConfigRegistry =
    StorageConfigRegistry(CoreRuntime.pushStorageConfigRegistry)

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
    val map = config.toHashMap()
    // TODO: Resolve and apply native logger from `loggerId` once storage logger wiring is implemented.
    val storageConfig = buildStorageConfig(map)
    return sessionConfigRegistry.register(storageConfig)
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
    val map = config.toHashMap()
    // TODO: Resolve and apply native logger from `loggerId` once storage logger wiring is implemented.
    val storageConfig = buildStorageConfig(map)
    return oidcConfigRegistry.register(storageConfig)
  }

  /**
   * Register binding user-key storage with the provided configuration.
   */
  @JvmStatic
  fun registerBindingUserKeyStorage(config: ReadableMap): String {
    val map = config.toHashMap()
    val storageConfig = buildStorageConfig(map)
    return bindingUserKeyConfigRegistry.register(storageConfig)
  }

  /**
   * Register push MFA storage with the provided configuration.
   */
  @JvmStatic
  fun registerPushStorage(config: ReadableMap): String {
    val map = config.toHashMap()
    val storageConfig = buildStorageConfig(map)
    return pushConfigRegistry.register(storageConfig)
  }

  /**
   * Register OATH storage with the provided configuration.
   *
   * OATH on Android uses `SQLOathStorage(SQLiteStorageConfig)` whose only
   * user-configurable parameter is `databaseName`. An [OathStorageConfigHandle]
   * is registered directly into [CoreRuntime.oathStorageConfigRegistry] so that
   * the OATH native SDK can cast the resolved handle to
   * [OathStorageConfigHandleContract] and read [databaseName] without a silent
   * null caused by a contract mismatch.
   *
   * @param config Configuration map. Recognized key: `databaseName` (String).
   * @return Unique ID for the registered storage configuration.
   */
  @JvmStatic
  fun registerOathStorage(config: ReadableMap): String {
    val map = config.toHashMap()
    val databaseName = map["databaseName"] as? String
    val handle = OathStorageConfigHandle(databaseName)
    return CoreRuntime.oathStorageConfigRegistry.register(handle)
  }

  /**
   * Build a storage configuration based on the provided configuration map.
   *
   * @param config Configuration map containing optional storage settings:
   *   - fileName: File name for persistent storage (default: "secure_prefs")
   *   - keyAlias: Encryption key alias for Android Keystore (default: "com.pingidentity.rnstorage.storage")
   *   - strongBoxPreferred: Whether to prefer StrongBox-backed keys (default: null)
   *   - cacheStrategy: Cache strategy string (NO_CACHE, CACHE, or CACHE_ON_FAILURE)
   * @return Normalized [StorageConfig] instance with all configuration values
   */
  private fun buildStorageConfig(config: Map<String, Any?>): StorageConfig {

    val fileName = config["fileName"] as? String ?: "secure_prefs"
    val keyAlias = (config["keyAlias"] as? String) ?: "com.pingidentity.rnstorage.storage"
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
    val resolvedConfig = sessionConfigRegistry.resolve(id)
    return encodeConfig(resolvedConfig)
  }

  /**
   * Resolve and encode a registered OIDC storage configuration by id.
   */
  @JvmStatic
  fun configureOidcStorage(id: String): WritableMap {
    val resolvedConfig = oidcConfigRegistry.resolve(id)
    return encodeConfig(resolvedConfig)
  }

  /**
   * Resolve and encode a registered binding user-key storage configuration by id.
   */
  @JvmStatic
  fun configureBindingUserKeyStorage(id: String): WritableMap {
    val resolvedConfig = bindingUserKeyConfigRegistry.resolve(id)
    return encodeConfig(resolvedConfig)
  }

  /**
   * Resolve and encode a registered push MFA storage configuration by id.
   */
  @JvmStatic
  fun configurePushStorage(id: String): WritableMap {
    val resolvedConfig = pushConfigRegistry.resolve(id)
    return encodeConfig(resolvedConfig)
  }

  /**
   * Resolve and encode a registered OATH storage configuration by id.
   *
   * Resolves an [OathStorageConfigHandle] directly from
   * [CoreRuntime.oathStorageConfigRegistry] and encodes its [databaseName]
   * field under the key `"databaseName"`.
   *
   * @param id The unique ID previously returned by [registerOathStorage].
   * @return A WritableMap containing the encoded OATH storage configuration.
   * @throws IllegalStateException if no OATH storage config is registered for [id].
   */
  @JvmStatic
  fun configureOathStorage(id: String): WritableMap {
    val handle = CoreRuntime.oathStorageConfigRegistry.resolve(id) as? OathStorageConfigHandle
      ?: error("No OATH storage config registered for id=$id")
    val map = Arguments.createMap()
    handle.databaseName?.let { map.putString("databaseName", it) }
    return map
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
