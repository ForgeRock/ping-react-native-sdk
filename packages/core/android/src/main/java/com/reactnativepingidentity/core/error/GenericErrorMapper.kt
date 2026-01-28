/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.reactnativepingidentity.core.error

import java.io.IOException

/**
 * Map arbitrary native failures into the shared GenericError contract.
 *
 * @param error The native throwable to translate.
 * @param code The module-specific error code to surface to JS.
 */
fun mapThrowableToGenericError(error: Throwable?, code: String): GenericError {
    return when (error) {
        is IllegalArgumentException -> GenericError(
            type = ErrorType.ARGUMENT_ERROR,
            error = code,
            message = error.message
        )
        is IOException -> GenericError(
            type = ErrorType.NETWORK_ERROR,
            error = code,
            message = error.message
        )
        else -> GenericError(
            type = ErrorType.INTERNAL_ERROR,
            error = code,
            message = error?.message
        )
    }
}
