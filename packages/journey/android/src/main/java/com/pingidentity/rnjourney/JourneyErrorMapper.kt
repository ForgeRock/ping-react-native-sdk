/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnjourney

import com.reactnativepingidentity.core.error.ErrorType
import com.reactnativepingidentity.core.error.GenericError
import com.reactnativepingidentity.core.error.mapThrowableToGenericError

/**
 * Maps Journey runtime failures into shared `GenericError` payloads.
 */
internal object JourneyErrorMapper {

    /**
     * Map native throwables into a shared error payload.
     *
     * @param error Native throwable.
     * @param code Stable Journey error code.
     * @return Generic error payload for JS promise rejection.
     */
    fun map(error: Throwable?, code: String): GenericError {
        return when (error) {
            is IllegalArgumentException -> GenericError(
                type = ErrorType.ARGUMENT_ERROR,
                error = code,
                message = error.message
            )
            is IllegalStateException -> GenericError(
                type = ErrorType.STATE_ERROR,
                error = code,
                message = error.message
            )
            else -> mapThrowableToGenericError(error, code)
        }
    }

    /**
     * Build a deterministic state error payload.
     */
    fun state(code: String, message: String): GenericError {
        return GenericError(
            type = ErrorType.STATE_ERROR,
            error = code,
            message = message
        )
    }

    /**
     * Build a deterministic argument error payload.
     */
    fun argument(code: String, message: String): GenericError {
        return GenericError(
            type = ErrorType.ARGUMENT_ERROR,
            error = code,
            message = message
        )
    }
}
