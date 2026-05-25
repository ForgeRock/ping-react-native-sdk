/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnstorage

import com.pingidentity.rncore.registry.NativeHandle
import com.pingidentity.rncore.storage.OathStorageConfigHandleContract

/**
 * Native handle for OATH storage configuration.
 *
 * Implements [OathStorageConfigHandleContract] so that the OATH native SDK can cast
 * handles resolved from [CoreRuntime.oathStorageConfigRegistry] to the correct type.
 * [StorageConfigHandle] implements [StorageConfigHandleContract] only, so registering
 * OATH config through [StorageConfigRegistry] would cause a silent null on the cast.
 *
 * @property databaseName SQLite database filename for the OATH credential store.
 */
class OathStorageConfigHandle(override val databaseName: String?) : NativeHandle, OathStorageConfigHandleContract
