/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rncore.storage

import com.pingidentity.rncore.registry.NativeHandle

/**
 * Native handle contract for OATH storage configuration values.
 *
 * OATH uses `SQLOathStorage(SQLiteStorageConfig)` whose only user-configurable parameter is
 * `databaseName`; this is unrelated to binding's `keyAlias`/`fileName`/`strongBoxPreferred`
 * fields. Extending the shared contract would conflate two unrelated storage backends.
 */
interface OathStorageConfigHandleContract : NativeHandle {
  /** SQLite database filename for the OATH credential store. */
  val databaseName: String?
}
