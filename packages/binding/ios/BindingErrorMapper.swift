/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import Foundation
import PingBinding

private let kErrSecInvalidKey: Int = -25300

extension RNPingBindingCommon {

  /// Builds the success payload `{ "type": "<type>" }` returned to JS after a successful bind or sign.
  /// - Parameter type: The result type string (e.g. `"success"`).
  static func createJourneyResultPayload(type: String) -> NSDictionary {
    return ["type": type]
  }

  /// Maps a native SDK error to the appropriate JS-facing `BindingErrorCode`.
  ///
  /// Checks `DeviceBindingError` cases first, then falls back to OSStatus inspection and
  /// heuristic cancellation detection.
  ///
  /// - Parameters:
  ///   - error: The error thrown by the native bind or sign operation.
  ///   - defaultCode: The fallback code when no specific mapping applies.
  /// - Returns: The resolved `BindingErrorCode`.
  static func resolveBindingErrorCode(
    _ error: Error,
    defaultCode: BindingErrorCode
  ) -> BindingErrorCode {
    if let bindingError = error as? DeviceBindingError {
      switch bindingError {
      case .deviceNotSupported, .unsupported:
        return .unsupportedDevice
      case .deviceNotRegistered:
        return .notRegistered
      case .userCanceled, .timeout:
        return .cancelled
      case .authenticationFailed, .biometricError:
        return defaultCode == .signError ? .keyInvalidated : .authFailed
      case .invalidClaim:
        return .invalidConfig
      default:
        return defaultCode
      }
    }
    let nsError = error as NSError
    // OSStatus -25300 surfaces when the Secure Enclave key was
    // invalidated by a biometric enrollment change.
    if nsError.domain == NSOSStatusErrorDomain && nsError.code == kErrSecInvalidKey {
      return .keyInvalidated
    }
    if isRecoverableCancellation(nsError) {
      return .cancelled
    }
    return defaultCode
  }

  /// Returns true when [error] represents a user-initiated cancellation that should map to
  /// `BindingErrorCode.cancelled` rather than a generic bind/sign failure.
  static func isRecoverableCancellation(_ error: NSError) -> Bool {
    let text = [
      error.domain,
      error.localizedDescription,
      String(error.code),
      (error.userInfo["message"] as? String) ?? "",
      (error.userInfo["error"] as? String) ?? "",
    ].joined(separator: " ").lowercased()
    return text.contains("cancel") || text.contains("user cancel")
  }

#if DEBUG
  public static func _test_resolveBindingErrorCode(_ error: Error, defaultCode: String) -> String {
    let code = resolveBindingErrorCode(error, defaultCode: BindingErrorCode(rawValue: defaultCode) ?? .bindingError)
    return code.rawValue
  }
#endif
}
