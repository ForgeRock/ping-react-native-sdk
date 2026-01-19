/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.storage

import com.reactnativepingidentity.core.registry.NativeHandle

data class StorageConfig(
  val keyAlias: String? = null,
  val fileName: String? = null,
  val strongBoxPreferred: Boolean? = null,
  val cacheStrategy: String? = null
)

class StorageConfigHandle(val config: StorageConfig) : NativeHandle
