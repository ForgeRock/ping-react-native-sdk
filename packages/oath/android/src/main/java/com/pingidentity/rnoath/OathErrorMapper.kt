/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
package com.pingidentity.rnoath

import com.pingidentity.mfa.commons.exception.CredentialLockedException
import com.pingidentity.mfa.commons.exception.CredentialNotFoundException
import com.pingidentity.mfa.commons.exception.DuplicateCredentialException
import com.pingidentity.mfa.commons.exception.MfaClientNotInitializedException
import com.pingidentity.mfa.commons.exception.MfaException
import com.pingidentity.mfa.commons.exception.MfaInitializationException
import com.pingidentity.mfa.commons.exception.MfaPolicyViolationException
import com.pingidentity.mfa.commons.exception.MfaStorageException
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.mapThrowableToGenericError

/**
 * Maps exceptions from the OATH native SDK and MFA commons to the shared [GenericError] contract.
 *
 * @remarks
 * All OATH SDK exceptions originate from `com.pingidentity.mfa.commons.exception.*`. There is no
 * separate `OathError` class in the Android SDK — errors surface as subclasses of [MfaException]
 * or as standard [IllegalArgumentException] from credential/URI validation.
 */
internal object OathErrorMapper {

  /**
   * Map a [Throwable] from an OATH bridge operation to a [GenericError].
   *
   * Mapping order is most-specific first:
   * - [CredentialNotFoundException] → [OathErrorCodes.OATH_CREDENTIAL_NOT_FOUND]
   * - [CredentialLockedException] → [OathErrorCodes.OATH_CREDENTIAL_LOCKED]
   * - [DuplicateCredentialException] → [OathErrorCodes.OATH_DUPLICATE_CREDENTIAL]
   * - [MfaInitializationException] → [OathErrorCodes.OATH_INITIALIZATION_FAILED]
   * - [MfaStorageException] → [OathErrorCodes.OATH_STORAGE_FAILURE]
   * - [MfaPolicyViolationException] → [OathErrorCodes.OATH_POLICY_VIOLATION]
   * - [MfaClientNotInitializedException] → [OathErrorCodes.OATH_STATE_ERROR]
   * - [IllegalArgumentException] with "uri" in the message → [OathErrorCodes.OATH_INVALID_URI]
   * - [IllegalArgumentException] (all others) → [OathErrorCodes.OATH_INVALID_PARAMETER]
   * - Any other [MfaException] → [OathErrorCodes.OATH_UNKNOWN_ERROR]
   * - Everything else → delegate to `mapThrowableToGenericError` using [fallbackCode]
   *
   * @param e The throwable thrown by the OATH SDK or bridge validation.
   * @param fallbackCode The error code to use when no specific mapping applies and the exception
   *   is not an [MfaException].
   * @return A [GenericError] suitable for rejecting a React Native bridge promise.
   */
  fun mapThrowable(e: Throwable, fallbackCode: String): GenericError = when (e) {
    is CredentialNotFoundException -> GenericError(
      type = ErrorType.STATE_ERROR,
      error = OathErrorCodes.OATH_CREDENTIAL_NOT_FOUND,
      message = e.message
    )
    is CredentialLockedException -> GenericError(
      type = ErrorType.STATE_ERROR,
      error = OathErrorCodes.OATH_CREDENTIAL_LOCKED,
      message = e.message
    )
    is DuplicateCredentialException -> GenericError(
      type = ErrorType.STATE_ERROR,
      error = OathErrorCodes.OATH_DUPLICATE_CREDENTIAL,
      message = e.message
    )
    is MfaInitializationException -> GenericError(
      type = ErrorType.INTERNAL_ERROR,
      error = OathErrorCodes.OATH_INITIALIZATION_FAILED,
      message = e.message
    )
    is MfaStorageException -> GenericError(
      type = ErrorType.INTERNAL_ERROR,
      error = OathErrorCodes.OATH_STORAGE_FAILURE,
      message = e.message
    )
    is MfaPolicyViolationException -> GenericError(
      type = ErrorType.STATE_ERROR,
      error = OathErrorCodes.OATH_POLICY_VIOLATION,
      message = e.message
    )
    is MfaClientNotInitializedException -> GenericError(
      type = ErrorType.STATE_ERROR,
      error = OathErrorCodes.OATH_STATE_ERROR,
      message = e.message
    )
    is IllegalArgumentException -> {
      // TODO: Replace message-sniffing with a typed exception check once the Android SDK
      //  introduces a dedicated InvalidUriException (or equivalent) in
      //  com.pingidentity.mfa.commons.exception. iOS achieves this via
      //  the typed OathError.invalidUri case; parity requires an SDK-level change.
      val isUriError = e.message?.contains("uri", ignoreCase = true) == true
      if (isUriError) {
        GenericError(
          type = ErrorType.ARGUMENT_ERROR,
          error = OathErrorCodes.OATH_INVALID_URI,
          message = e.message
        )
      } else {
        GenericError(
          type = ErrorType.ARGUMENT_ERROR,
          error = OathErrorCodes.OATH_INVALID_PARAMETER,
          message = e.message
        )
      }
    }
    is MfaException -> GenericError(
      type = ErrorType.UNKNOWN_ERROR,
      error = OathErrorCodes.OATH_UNKNOWN_ERROR,
      message = e.message
    )
    else -> mapThrowableToGenericError(e, fallbackCode)
  }
}
