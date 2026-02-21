/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.storage

import com.reactnativepingidentity.core.storage.StorageConfigHandleContract
import com.reactnativepingidentity.core.registry.NativeHandle

/**
 * Configuration data class for storage settings.
 *
 * @property keyAlias The alias for the encryption key used in secure storage. If null, a default alias may be used.
 * @property fileName The name of the file where data will be stored. If null, a default file name may be used.
 * @property strongBoxPreferred Indicates whether to prefer StrongBox-backed keystore for enhanced security on supported devices. If null, the system will use the default behavior.
 * @property cacheStrategy The caching strategy to be used for storage operations. Defines how and when data should be cached.
 */
data class StorageConfig(
  val keyAlias: String? = null,
  val fileName: String? = null,
  val strongBoxPreferred: Boolean? = null,
  val cacheStrategy: String? = null
)

/**
 * Handle wrapper for StorageConfig that implements NativeHandle.
 *
 * This class provides a native handle for the storage configuration,
 * allowing it to be registered and managed within the native registry system.
 *
 * @property config The storage configuration to be wrapped.
 */
class StorageConfigHandle(val config: StorageConfig) : NativeHandle, StorageConfigHandleContract {
  override val keyAlias: String?
    get() = config.keyAlias

  override val fileName: String?
    get() = config.fileName

  override val strongBoxPreferred: Boolean?
    get() = config.strongBoxPreferred

  override val cacheStrategy: String?
    get() = config.cacheStrategy
}
