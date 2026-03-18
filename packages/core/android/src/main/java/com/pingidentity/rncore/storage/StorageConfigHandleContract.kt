/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rncore.storage

import com.pingidentity.rncore.registry.NativeHandle

/**
 * Shared native handle contract for storage configuration values.
 *
 * @remarks
 * Modules that consume storage ids (for example OIDC and Journey) can resolve
 * this contract from Core registries without importing storage package internals.
 */
interface StorageConfigHandleContract : NativeHandle {
  /** Android keystore alias. */
  val keyAlias: String?

  /** Android encrypted datastore filename. */
  val fileName: String?

  /** StrongBox preference for keystore-backed storage. */
  val strongBoxPreferred: Boolean?

  /** Raw cache strategy value (for example `cache_on_failure`). */
  val cacheStrategy: String?
}
