/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnrecaptcha

import com.google.android.recaptcha.RecaptchaException
import com.pingidentity.rncore.error.ErrorType
import com.pingidentity.rncore.error.GenericError
import com.pingidentity.rncore.error.mapThrowableToGenericError

/**
 * Maps reCAPTCHA verification failures into the shared error contract.
 *
 * Verification failures resolve as `{ type: "failure" }` payloads rather than
 * rejections, so this mapper is used for bridge-level rejections where a
 * `Throwable` needs to surface (for example cancellation or unexpected native
 * errors propagating through `launchBridge`).
 */
internal object RecaptchaErrorMapper {

    /**
     * Maps a verification throwable into a [GenericError].
     *
     * Google's `RecaptchaException` carries a stable `errorCode` enum; its name
     * is surfaced in the `error` field so JS can branch on the platform's error
     * taxonomy. All other throwables fall back to the shared mapper.
     *
     * @param error Native throwable to translate.
     * @param code Module-specific error code (e.g. [RecaptchaErrorCodes.RECAPTCHA_VERIFY_ERROR]).
     * @return Generic error payload for JS promise rejection.
     */
    fun map(error: Throwable?, code: String): GenericError {
        if (error is RecaptchaException) {
            return GenericError(
                type = ErrorType.INTERNAL_ERROR,
                error = error.errorCode.name,
                message = error.errorMessage ?: error.message
            )
        }
        return mapThrowableToGenericError(error, code)
    }

    /**
     * Derives the stable failure code carried by the `{ type: "failure" }` result payload.
     *
     * @param error Throwable from the native `verify()` `Result.failure` branch.
     * @return Google's `RecaptchaErrorCode` enum name when available, otherwise
     *   the upstream `UNKNOWN_ERROR` fallback used by the native callback itself.
     */
    fun failureCode(error: Throwable?): String {
        return if (error is RecaptchaException) {
            error.errorCode.name
        } else {
            UNKNOWN_ERROR
        }
    }

    /**
     * Derives the human-readable failure message carried by the `{ type: "failure" }` payload.
     *
     * @param error Throwable from the native `verify()` `Result.failure` branch.
     * @return The exception message, or a stable fallback when absent.
     */
    fun failureMessage(error: Throwable?): String {
        return error?.message
            ?: error?.localizedMessage
            ?: "reCAPTCHA Enterprise verification failed."
    }
}

/** Fallback code mirroring the upstream callback's own `UNKNOWN_ERROR` constant. */
private const val UNKNOWN_ERROR = "UNKNOWN_ERROR"
