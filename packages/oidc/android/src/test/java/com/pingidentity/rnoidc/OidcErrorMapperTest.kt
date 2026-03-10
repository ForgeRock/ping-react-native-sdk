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
import com.pingidentity.rncore.error.ErrorType
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.IOException

class OidcErrorMapperTest {

  @Test
  fun mapAuthorizeThrowable_handlesAuthorizeException() {
    val error = AuthorizeException("auth failed")

    val mapped = OidcErrorMapper.mapAuthorizeThrowable(error)

    assertEquals(ErrorType.AUTH_ERROR, mapped.type)
    assertEquals(OidcErrorCodes.OIDC_AUTHORIZE_ERROR, mapped.error)
    assertEquals("auth failed", mapped.message)
  }

  @Test
  fun mapAuthorizeThrowable_handlesApiException() {
    val error = ApiException(401, "unauthorized")

    val mapped = OidcErrorMapper.mapAuthorizeThrowable(error)

    assertEquals(ErrorType.EXCHANGE_ERROR, mapped.type)
    assertEquals(OidcErrorCodes.OIDC_AUTHORIZE_ERROR, mapped.error)
    assertEquals("unauthorized", mapped.message)
    assertEquals(401, mapped.status)
  }

  @Test
  fun mapAuthorizeThrowable_handlesUnknown() {
    val error = IllegalStateException("boom")

    val mapped = OidcErrorMapper.mapAuthorizeThrowable(error)

    assertEquals(ErrorType.INTERNAL_ERROR, mapped.type)
    assertEquals(OidcErrorCodes.OIDC_AUTHORIZE_ERROR, mapped.error)
    assertEquals("boom", mapped.message)
  }

  @Test
  fun mapOidcError_mapsAuthorizeError() {
    val error = OidcError.AuthorizeError(AuthorizeException("authorize failed"))

    val mapped = OidcErrorMapper.mapOidcError(error, OidcErrorCodes.OIDC_TOKEN_ERROR)

    assertEquals(ErrorType.AUTH_ERROR, mapped.type)
    assertEquals(OidcErrorCodes.OIDC_TOKEN_ERROR, mapped.error)
    assertEquals("authorize failed", mapped.message)
  }

  @Test
  fun mapOidcError_mapsNetworkError() {
    val error = OidcError.NetworkError(IOException("timeout"))

    val mapped = OidcErrorMapper.mapOidcError(error, OidcErrorCodes.OIDC_TOKEN_ERROR)

    assertEquals(ErrorType.NETWORK_ERROR, mapped.type)
    assertEquals(OidcErrorCodes.OIDC_TOKEN_ERROR, mapped.error)
    assertEquals("timeout", mapped.message)
  }

  @Test
  fun mapOidcError_mapsApiError() {
    val error = OidcError.ApiError(403, "forbidden")

    val mapped = OidcErrorMapper.mapOidcError(error, OidcErrorCodes.OIDC_TOKEN_ERROR)

    assertEquals(ErrorType.EXCHANGE_ERROR, mapped.type)
    assertEquals(OidcErrorCodes.OIDC_TOKEN_ERROR, mapped.error)
    assertEquals("forbidden", mapped.message)
    assertEquals(403, mapped.status)
  }

  @Test
  fun mapOidcError_mapsUnknownError() {
    val error = OidcError.Unknown(IllegalArgumentException("unknown"))

    val mapped = OidcErrorMapper.mapOidcError(error, OidcErrorCodes.OIDC_TOKEN_ERROR)

    assertEquals(ErrorType.UNKNOWN_ERROR, mapped.type)
    assertEquals(OidcErrorCodes.OIDC_TOKEN_ERROR, mapped.error)
    assertEquals("unknown", mapped.message)
  }
}
