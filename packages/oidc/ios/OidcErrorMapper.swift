//
//  OidcErrorMapper.swift
//  RNPingOidc
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation
import PingBrowser
import PingOidc
import RNPingCore

/// Map native OIDC errors into shared JS error contracts.
enum OidcErrorMapper {
  /// Whether an OIDC error represents the user dismissing the browser session.
  ///
  /// The native web client wraps the browser failure as the `cause` of
  /// `OidcError.authorizeError`; the browser layer already normalizes an
  /// `ASWebAuthenticationSession` cancellation into
  /// `BrowserError.externalUserAgentCancelled`.
  ///
  /// - Parameter error: Native OIDC error returned by `authorize()`.
  /// - Returns: `true` when the user cancelled the browser session.
  static func isUserCancellation(_ error: OidcError) -> Bool {
    guard case .authorizeError(let cause, _) = error,
      let browserError = cause as? BrowserError,
      case .externalUserAgentCancelled = browserError
    else { return false }
    return true
  }

  /// Map an OIDC error to the shared error contract.
  ///
  /// - Parameters:
  ///   - error: Native OIDC error instance.
  ///   - code: Stable error code to include in the payload.
  /// - Returns: Mapped generic error payload.
  static func mapOidcError(_ error: OidcError, code: OidcErrorCodes) -> GenericError {
    switch error {
    case .authorizeError(_, let message):
      return GenericError(
        type: .authError,
        error: code.rawValue,
        message: message ?? error.localizedDescription
      )
    case .networkError(_, let message):
      return GenericError(
        type: .networkError,
        error: code.rawValue,
        message: message ?? error.localizedDescription
      )
    case .apiError(let status, let message):
      return GenericError(
        type: .exchangeError,
        error: code.rawValue,
        message: message,
        status: status
      )
    case .configurationError(let message):
      // OidcError.configurationError (PingOidc 2.2.0): a configuration/setup
      // failure is an argument-level error.
      return GenericError(
        type: .argumentError,
        error: code.rawValue,
        message: message
      )
    case .unknown(_, let message):
      return GenericError(
        type: .unknownError,
        error: code.rawValue,
        message: message ?? error.localizedDescription
      )
    }
  }

  /// Map a generic error to the shared error contract.
  ///
  /// - Parameter error: Native error instance.
  /// - Returns: Mapped generic error payload.
  static func mapAuthorizeThrowable(_ error: Error?) -> GenericError {
    guard let error else {
      return GenericError(
        type: .internalError,
        error: OidcErrorCodes.authorizeError.rawValue,
        message: "Unknown authorization error"
      )
    }
    if let oidcError = error as? OidcError {
      return mapOidcError(oidcError, code: .authorizeError)
    }
    return GenericError(
      type: .internalError,
      error: OidcErrorCodes.authorizeError.rawValue,
      message: error.localizedDescription
    )
  }
}
