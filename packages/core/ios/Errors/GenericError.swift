/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Shared error contract for JS-facing promise rejections.
///
/// Raw values must match the JS `ErrorType` union in `@ping-identity/rn-types`.
public enum ErrorType: String {
  case argumentError = "argument_error"
  case authError = "auth_error"
  case bindingError = "binding_error"
  case davinciError = "davinci_error"
  case fidoError = "fido_error"
  case exchangeError = "exchange_error"
  case internalError = "internal_error"
  case networkError = "network_error"
  case parseError = "parse_error"
  case stateError = "state_error"
  case unknownError = "unknown_error"
  case wellknownError = "wellknown_error"
}

/// Serializable error payload shared across native modules.
///
/// - `type` classifies the error for app-level branching.
/// - `error` is a stable, module-specific code (for example, BROWSER_OPEN_ERROR).
/// - `message`, `code`, and `status` provide extra diagnostics when available.
public struct GenericError {
  public let type: ErrorType
  public let error: String
  public let message: String?
  public let code: Any?
  public let status: Any?

  public init(
    type: ErrorType,
    error: String,
    message: String? = nil,
    code: Any? = nil,
    status: Any? = nil
  ) {
    self.type = type
    self.error = error
    self.message = message
    self.code = code
    self.status = status
  }

  public func asDictionary() -> NSDictionary {
    let payload = NSMutableDictionary()
    payload["type"] = type.rawValue
    payload["error"] = error
    if let message {
      payload["message"] = message
    }
    if let code {
      payload["code"] = code
    }
    if let status {
      payload["status"] = status
    }
    return payload
  }

  public func asNSError(domain: String = "com.pingidentity", code: Int = 0) -> NSError {
    NSError(domain: domain, code: code, userInfo: asDictionary() as? [String: Any] ?? [:])
  }
}

/// Reject a React Native promise with a shared error payload.
///
/// Use this helper to ensure errors always conform to the shared contract.
public func reject(
  _ error: GenericError,
  rejecter: (String, String, NSError?) -> Void,
  underlyingError: NSError? = nil
) {
  let message = error.message ?? "Unknown error"
  rejecter(error.error, message, underlyingError ?? error.asNSError())
}
