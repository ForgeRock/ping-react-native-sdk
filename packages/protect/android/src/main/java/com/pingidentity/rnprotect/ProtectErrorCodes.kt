/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnprotect

/**
 * Stable error codes emitted by the Protect module.
 *
 * Keep these in sync with JS `ProtectErrorCode`.
 */
object ProtectErrorCodes {
  const val COLLECT_ERROR         = "PROTECT_COLLECT_ERROR"
  const val COLLECTOR_NOT_FOUND   = "PROTECT_COLLECTOR_NOT_FOUND"
  const val INITIALIZE_ERROR      = "PROTECT_INITIALIZE_ERROR"
}
