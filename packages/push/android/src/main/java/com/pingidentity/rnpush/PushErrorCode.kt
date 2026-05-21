/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnpush

/**
 * Stable error code strings passed to `promise.reject(code, message)`.
 *
 * These values form the contract with the TypeScript `PushErrorCode` union in
 * `@ping-identity/rn-push`. Keep in sync with [PushErrorMapper] and the iOS
 * `PushErrorCode` Swift enum.
 */
internal object PushErrorCode {
    const val NOT_INITIALIZED = "not_initialized"
    const val INITIALIZATION_FAILED = "initialization_failed"
    const val INVALID_URI = "invalid_uri"
    const val MISSING_REQUIRED_PARAMETER = "missing_required_parameter"
    const val INVALID_PARAMETER_VALUE = "invalid_parameter_value"
    const val INVALID_PUSH_TYPE = "invalid_push_type"
    const val INVALID_PLATFORM = "invalid_platform"
    const val STORAGE_FAILURE = "storage_failure"
    const val DEVICE_TOKEN_NOT_SET = "device_token_not_set"
    const val NO_HANDLER_FOR_PLATFORM = "no_handler_for_platform"
    const val MESSAGE_PARSING_FAILED = "message_parsing_failed"
    const val CREDENTIAL_NOT_FOUND = "credential_not_found"
    const val CREDENTIAL_LOCKED = "credential_locked"
    const val DUPLICATE_CREDENTIAL = "duplicate_credential"
    const val NOTIFICATION_NOT_FOUND = "notification_not_found"
    const val POLICY_VIOLATION = "policy_violation"
    const val REGISTRATION_FAILED = "registration_failed"
    const val NETWORK_FAILURE = "network_failure"
}
