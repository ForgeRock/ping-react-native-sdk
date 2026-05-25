/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnoath

/**
 * Stable error codes emitted by the OATH module.
 *
 * @remarks
 * Keep these in sync with JS `OathErrorCode` and iOS `OathErrorCodes`.
 *
 * Four codes present on iOS are intentionally absent here:
 * `OATH_MISSING_PARAMETER`, `OATH_CLEANUP_FAILED`, `OATH_STORAGE_CORRUPTED`,
 * and `OATH_STORAGE_ACCESS_DENIED`. The Android MFA commons library has no
 * equivalent exception types for these conditions, so Android cannot emit them.
 * The TypeScript `OathErrorCode` union includes all codes from both platforms
 * by design.
 */
object OathErrorCodes {
  const val OATH_INVALID_URI = "OATH_INVALID_URI"
  const val OATH_INVALID_PARAMETER = "OATH_INVALID_PARAMETER"
  const val OATH_CREDENTIAL_NOT_FOUND = "OATH_CREDENTIAL_NOT_FOUND"
  const val OATH_CREDENTIAL_LOCKED = "OATH_CREDENTIAL_LOCKED"
  const val OATH_DUPLICATE_CREDENTIAL = "OATH_DUPLICATE_CREDENTIAL"
  const val OATH_CODE_GENERATION_FAILED = "OATH_CODE_GENERATION_FAILED"
  const val OATH_INITIALIZATION_FAILED = "OATH_INITIALIZATION_FAILED"
  const val OATH_STORAGE_FAILURE = "OATH_STORAGE_FAILURE"
  const val OATH_POLICY_VIOLATION = "OATH_POLICY_VIOLATION"
  const val OATH_STATE_ERROR = "OATH_STATE_ERROR"
  const val OATH_UNKNOWN_ERROR = "OATH_UNKNOWN_ERROR"
}
