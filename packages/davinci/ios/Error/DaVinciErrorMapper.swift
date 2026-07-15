/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingOidc
import RNPingCore

/// Maps native iOS DaVinci failures into shared `GenericError` payloads.
enum DaVinciErrorMapper {
  /// Map native errors to `GenericError`.
  ///
  /// - Parameters:
  ///   - error: Native error instance.
  ///   - code: Stable DaVinci error code.
  /// - Returns: Shared generic error payload.
  static func map(_ error: Error?, code: DaVinciErrorCodes) -> GenericError {
    guard let error else {
      return GenericError(
        type: .internalError,
        error: code.rawValue,
        message: "Unknown DaVinci error"
      )
    }

    if let mapped = mapOidcError(error, code: code) {
      return mapped
    }

    if let bridgeError = error as? DaVinciBridgeError {
      return bridgeError.genericError(code: code)
    }

    if let urlError = error as? URLError {
      return GenericError(
        type: .networkError,
        error: code.rawValue,
        message: urlError.localizedDescription,
        code: urlError.errorCode
      )
    }

    let nsError = error as NSError
    if nsError.domain == NSURLErrorDomain {
      return GenericError(
        type: .networkError,
        error: code.rawValue,
        message: nsError.localizedDescription,
        code: nsError.code
      )
    }

    return GenericError(
      type: .internalError,
      error: code.rawValue,
      message: nsError.localizedDescription,
      code: nsError.code
    )
  }

  /// Build a deterministic state error payload.
  ///
  /// - Parameters:
  ///   - code: Stable DaVinci error code.
  ///   - message: Human-readable error message.
  /// - Returns: Shared state error payload.
  static func state(code: DaVinciErrorCodes, message: String) -> GenericError {
    return GenericError(
      type: .stateError,
      error: code.rawValue,
      message: message
    )
  }

  /// Build a deterministic argument error payload.
  ///
  /// - Parameters:
  ///   - code: Stable DaVinci error code.
  ///   - message: Human-readable error message.
  /// - Returns: Shared argument error payload.
  static func argument(code: DaVinciErrorCodes, message: String) -> GenericError {
    return GenericError(
      type: .argumentError,
      error: code.rawValue,
      message: message
    )
  }

  /// Maps OIDC errors used by DaVinci user/session operations.
  ///
  /// - Parameters:
  ///   - error: Native error instance.
  ///   - code: Stable DaVinci error code.
  /// - Returns: Shared generic error payload when mapping is possible.
  private static func mapOidcError(_ error: Error, code: DaVinciErrorCodes) -> GenericError? {
    guard let oidcError = error as? OidcError else {
      return nil
    }

    switch oidcError {
    case .authorizeError(_, let message):
      return GenericError(
        type: .authError,
        error: code.rawValue,
        message: message ?? oidcError.localizedDescription
      )
    case .networkError(_, let message):
      return GenericError(
        type: .networkError,
        error: code.rawValue,
        message: message ?? oidcError.localizedDescription
      )
    case .apiError(let status, let message):
      return GenericError(
        type: .exchangeError,
        error: code.rawValue,
        message: message,
        status: status
      )
    case .unknown(let codeValue, let message):
      return GenericError(
        type: .unknownError,
        error: code.rawValue,
        message: message ?? oidcError.localizedDescription,
        code: codeValue
      )
    }
  }
}

/// Bridge-local error kinds used for deterministic argument/state rejections.
enum DaVinciBridgeError: Error {
  case argument(String)
  case state(String)
  case unsupportedCollector(String)
  case collectorApply(String)

  /// Converts bridge errors to `GenericError`.
  ///
  /// - Parameter code: Stable DaVinci error code.
  /// - Returns: Shared generic error payload.
  func genericError(code: DaVinciErrorCodes) -> GenericError {
    switch self {
    case .argument(let message):
      return GenericError(
        type: .argumentError,
        error: code.rawValue,
        message: message
      )
    case .state(let message):
      return GenericError(
        type: .stateError,
        error: code.rawValue,
        message: message
      )
    case .unsupportedCollector(let message):
      return GenericError(
        type: .argumentError,
        error: DaVinciErrorCodes.unsupportedCollectorError.rawValue,
        message: message
      )
    case .collectorApply(let message):
      return GenericError(
        type: .argumentError,
        error: DaVinciErrorCodes.collectorApplyError.rawValue,
        message: message
      )
    }
  }
}
