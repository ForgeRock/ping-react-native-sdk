/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

import com.pingidentity.exception.ApiException
import com.pingidentity.oidc.OidcError
import com.pingidentity.oidc.exception.AuthorizeException
import com.pingidentity.reactnative.rncore.error.ErrorType
import com.pingidentity.reactnative.rncore.error.GenericError
import com.pingidentity.reactnative.rncore.error.mapThrowableToGenericError

/**
 * Maps native OIDC errors into the shared GenericError contract.
 */
internal object OidcErrorMapper {

  /**
   * Map authorization failures into the shared error contract.
   *
   * @param error Throwable raised by the OIDC SDK
   * @return Normalized GenericError payload
   */
  fun mapAuthorizeThrowable(error: Throwable?): GenericError {
    return when (error) {
      is AuthorizeException -> GenericError(
        type = ErrorType.AUTH_ERROR,
        error = OidcErrorCodes.OIDC_AUTHORIZE_ERROR,
        message = error.message
      )
      is ApiException -> GenericError(
        type = ErrorType.EXCHANGE_ERROR,
        error = OidcErrorCodes.OIDC_AUTHORIZE_ERROR,
        message = error.message,
        status = error.status
      )
      else -> mapThrowableToGenericError(error, OidcErrorCodes.OIDC_AUTHORIZE_ERROR)
    }
  }

  /**
   * Map OIDC SDK error results into the shared error contract.
   *
   * @param error OIDC SDK error value
   * @param code Stable error code to include in the payload
   * @return Normalized GenericError payload
   */
  fun mapOidcError(error: OidcError, code: String): GenericError {
    return when (error) {
      is OidcError.AuthorizeError -> GenericError(
        type = ErrorType.AUTH_ERROR,
        error = code,
        message = error.cause.message
      )
      is OidcError.NetworkError -> GenericError(
        type = ErrorType.NETWORK_ERROR,
        error = code,
        message = error.cause.message
      )
      is OidcError.ApiError -> GenericError(
        type = ErrorType.EXCHANGE_ERROR,
        error = code,
        message = error.message,
        status = error.code
      )
      is OidcError.Unknown -> GenericError(
        type = ErrorType.UNKNOWN_ERROR,
        error = code,
        message = error.cause.message
      )
    }
  }
}
