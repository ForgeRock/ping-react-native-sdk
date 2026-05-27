/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnpush

import com.facebook.react.bridge.Promise
import com.pingidentity.mfa.commons.exception.CredentialLockedException
import com.pingidentity.mfa.commons.exception.CredentialNotFoundException
import com.pingidentity.mfa.commons.exception.DuplicateCredentialException
import com.pingidentity.mfa.commons.exception.MfaClientNotInitializedException
import com.pingidentity.mfa.commons.exception.MfaException
import com.pingidentity.mfa.commons.exception.MfaInitializationException
import com.pingidentity.mfa.commons.exception.MfaPolicyViolationException
import com.pingidentity.mfa.commons.exception.MfaStorageException
import com.pingidentity.mfa.push.exception.DeviceTokenMissingException
import com.pingidentity.mfa.push.exception.NotificationExpiredException
import com.pingidentity.mfa.push.exception.NotificationNotFoundException
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.reject

/**
 * Maps exceptions thrown by the Ping MFA Push Android SDK to stable
 * `PushErrorCode` strings used in `promise.reject(code, message)` calls.
 *
 * Error code constants are intentionally inlined as string literals to keep
 * them in sync with the TypeScript `PushErrorCode` union without requiring a
 * separate constants object.
 *
 * Keep this mapping in sync with the iOS `PushErrorMapper` and the TypeScript
 * `PushErrorCode` type in `@ping-identity/rn-push`.
 */
object PushErrorMapper {

    /**
     * Rejects [promise] with the error code and message derived from [e].
     *
     * Maps the Ping MFA Push exception hierarchy to stable `PushErrorCode` strings:
     * - [MfaInitializationException] → `"initialization_failed"`
     * - [MfaClientNotInitializedException] → `"not_initialized"`
     * - [MfaStorageException] → `"storage_failure"`
     * - [CredentialLockedException] → `"credential_locked"`
     * - [MfaPolicyViolationException] → `"policy_violation"`
     * - [DuplicateCredentialException] → `"duplicate_credential"`
     * - [CredentialNotFoundException] → `"credential_not_found"`
     * - [DeviceTokenMissingException] → `"device_token_not_set"`
     * - [NotificationNotFoundException] → `"notification_not_found"`
     * - [NotificationExpiredException] → `"notification_not_found"` (expired is a subset of not-found)
     * - All other [MfaException] subtypes → `"network_failure"`
     * - All other [Exception] → `"network_failure"`
     *
     * @param e The exception thrown by the native Push SDK operation.
     * @param promise The React Native promise to reject.
     */
    fun reject(e: Throwable, promise: Promise) {
        val code = resolveErrorCode(e)
        val type = resolveErrorType(e)
        val message = e.localizedMessage ?: e.message ?: "Push operation failed"
        promise.reject(GenericError(type = type, error = code, message = message), e)
    }

    /**
     * Resolves the `PushErrorCode` string for the given [throwable].
     *
     * @param throwable The exception to map.
     * @return A stable error code string from the `PushErrorCode` union.
     */
    internal fun resolveErrorType(throwable: Throwable): ErrorType = when (throwable) {
        is MfaStorageException -> ErrorType.INTERNAL_ERROR
        is MfaInitializationException -> ErrorType.INTERNAL_ERROR
        is MfaClientNotInitializedException -> ErrorType.STATE_ERROR
        is CredentialLockedException -> ErrorType.STATE_ERROR
        is MfaPolicyViolationException -> ErrorType.STATE_ERROR
        is DuplicateCredentialException -> ErrorType.STATE_ERROR
        is CredentialNotFoundException -> ErrorType.STATE_ERROR
        is NotificationNotFoundException -> ErrorType.STATE_ERROR
        is NotificationExpiredException -> ErrorType.STATE_ERROR
        is DeviceTokenMissingException -> ErrorType.STATE_ERROR
        else -> ErrorType.NETWORK_ERROR
    }

    internal fun resolveErrorCode(throwable: Throwable): String {
        return when (throwable) {
            // NotificationExpiredException must be checked before NotificationNotFoundException
            // because it is a subtype — the more specific case is handled first.
            is NotificationExpiredException -> PushErrorCode.NOTIFICATION_NOT_FOUND
            is NotificationNotFoundException -> PushErrorCode.NOTIFICATION_NOT_FOUND
            is MfaInitializationException -> PushErrorCode.INITIALIZATION_FAILED
            is MfaClientNotInitializedException -> PushErrorCode.NOT_INITIALIZED
            is MfaStorageException -> PushErrorCode.STORAGE_FAILURE
            is CredentialLockedException -> PushErrorCode.CREDENTIAL_LOCKED
            is MfaPolicyViolationException -> PushErrorCode.POLICY_VIOLATION
            is DuplicateCredentialException -> PushErrorCode.DUPLICATE_CREDENTIAL
            is CredentialNotFoundException -> PushErrorCode.CREDENTIAL_NOT_FOUND
            is DeviceTokenMissingException -> PushErrorCode.DEVICE_TOKEN_NOT_SET
            // All other MfaException subtypes fall through to NETWORK_FAILURE.
            //
            // Android SDK coverage gap: 8 of the 18 PushErrorCode values have no
            // corresponding Android exception class in the mfa-commons / mfa-push SDK:
            //   - INVALID_URI                (URI validation is client-side)
            //   - MISSING_REQUIRED_PARAMETER
            //   - INVALID_PARAMETER_VALUE
            //   - INVALID_PUSH_TYPE
            //   - INVALID_PLATFORM
            //   - NO_HANDLER_FOR_PLATFORM
            //   - MESSAGE_PARSING_FAILED
            //   - REGISTRATION_FAILED
            // iOS emits specific codes for all of these via the PushError Swift enum.
            is MfaException -> PushErrorCode.NETWORK_FAILURE
            else -> PushErrorCode.NETWORK_FAILURE
        }
    }
}

/**
 * Top-level convenience function that rejects [promise] with the error code and
 * message mapped from [e] via [PushErrorMapper].
 *
 * Usage in [RNPingPushCommon] coroutine catch blocks:
 * ```kotlin
 * } catch (e: Throwable) {
 *     reject(e, promise)
 * }
 * ```
 *
 * @param e The exception thrown by the native Push SDK operation.
 * @param promise The React Native promise to reject.
 */
internal fun reject(e: Throwable, promise: Promise) {
    PushErrorMapper.reject(e, promise)
}
