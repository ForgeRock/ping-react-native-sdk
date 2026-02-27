//
//  OidcErrorCodes.swift
//  RNPingOidc
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation

/// Stable error codes emitted by the OIDC module.
///
/// Keep these in sync with JS `OidcErrorCode` and Android `OidcErrorCodes`.
enum OidcErrorCodes: String {
  case authorizeError = "OIDC_AUTHORIZE_ERROR"
  case hasUserError = "OIDC_HAS_USER_ERROR"
  case stateError = "OIDC_STATE_ERROR"
  case tokenError = "OIDC_TOKEN_ERROR"
  case refreshError = "OIDC_REFRESH_ERROR"
  case userinfoError = "OIDC_USERINFO_ERROR"
  case revokeError = "OIDC_REVOKE_ERROR"
  case logoutError = "OIDC_LOGOUT_ERROR"
}
