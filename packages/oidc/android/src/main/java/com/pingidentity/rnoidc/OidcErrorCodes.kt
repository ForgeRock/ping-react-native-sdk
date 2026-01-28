/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rnoidc

/**
 * Stable error codes emitted by the OIDC module.
 *
 * @remarks
 * Keep these in sync with JS `OidcErrorCode`.
 */
object OidcErrorCodes {
  const val OIDC_AUTHORIZE_ERROR = "OIDC_AUTHORIZE_ERROR"
  const val OIDC_HAS_USER_ERROR = "OIDC_HAS_USER_ERROR"
  const val OIDC_TOKEN_ERROR = "OIDC_TOKEN_ERROR"
  const val OIDC_REFRESH_ERROR = "OIDC_REFRESH_ERROR"
  const val OIDC_USERINFO_ERROR = "OIDC_USERINFO_ERROR"
  const val OIDC_REVOKE_ERROR = "OIDC_REVOKE_ERROR"
  const val OIDC_LOGOUT_ERROR = "OIDC_LOGOUT_ERROR"
}
