/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingDeviceClient
import RNPingCore

/// Maps native SDK errors into bridge-friendly ``GenericError`` instances.
///
/// Keeps classification logic out of ``RNPingDeviceClientCommon`` so the
/// bridge entry points stay focused on dispatch.
internal enum DeviceErrorMapper {

  /// Maps a `DeviceError` from the native SDK into a bridge-friendly `GenericError`.
  ///
  /// Assigns a stable ``DeviceClientErrorCode`` and descriptive message for each
  /// `DeviceError` case. HTTP status codes receive special treatment: `401`
  /// maps to `.invalidToken`, `404` maps to `.notFound`, all others map to
  /// `.requestFailed`.
  ///
  /// - Parameter error: The `DeviceError` thrown by the native `PingDeviceClient` SDK.
  /// - Returns: A `GenericError` ready for rejection through the React Native promise.
  internal static func mapDeviceError(_ error: DeviceError) -> GenericError {
    switch error {
    case .networkError(let err):
      return GenericError(
        type: .networkError,
        error: DeviceClientErrorCode.network.rawValue,
        message: err.localizedDescription
      )
    case .requestFailed(let statusCode, let message):
      let code: DeviceClientErrorCode =
        statusCode == 401 ? .invalidToken
        : (statusCode == 404 ? .notFound : .requestFailed)
      let displayMessage = message.isEmpty
        ? "Request failed with status \(statusCode)"
        : "Request failed with status \(statusCode): \(message)"
      return GenericError(
        type: .networkError,
        error: code.rawValue,
        message: displayMessage,
        status: statusCode
      )
    case .invalidUrl(let url):
      return GenericError(
        type: .argumentError,
        error: DeviceClientErrorCode.missingConfig.rawValue,
        message: "Invalid URL: \(url)"
      )
    case .decodingFailed(let err):
      return GenericError(
        type: .parseError,
        error: DeviceClientErrorCode.decodingFailed.rawValue,
        message: err.localizedDescription
      )
    case .encodingFailed(let message):
      return GenericError(
        type: .parseError,
        error: DeviceClientErrorCode.decodingFailed.rawValue,
        message: message
      )
    case .invalidResponse(let message):
      return GenericError(
        type: .parseError,
        error: DeviceClientErrorCode.decodingFailed.rawValue,
        message: message
      )
    case .invalidToken(let message):
      return GenericError(
        type: .authError,
        error: DeviceClientErrorCode.invalidToken.rawValue,
        message: message
      )
    case .missingConfiguration(let message):
      return GenericError(
        type: .argumentError,
        error: DeviceClientErrorCode.missingConfig.rawValue,
        message: message
      )
    @unknown default:
      return GenericError(
        type: .unknownError,
        error: DeviceClientErrorCode.unknown.rawValue,
        message: error.localizedDescription
      )
    }
  }

  /// Maps an arbitrary `Error` into a bridge-friendly `GenericError`.
  ///
  /// Delegates to ``mapDeviceError(_:)`` when the error is a `DeviceError`.
  /// `DecodingError` instances are wrapped with the `.decodingFailed` code.
  /// All other errors fall through to the generic `.unknown` code.
  ///
  /// - Parameter error: Any error caught during bridge execution.
  /// - Returns: A `GenericError` ready for rejection through the React Native promise.
  internal static func mapError(_ error: Error) -> GenericError {
    if let device = error as? DeviceError {
      return mapDeviceError(device)
    }
    if error is DecodingError {
      return GenericError(
        type: .parseError,
        error: DeviceClientErrorCode.decodingFailed.rawValue,
        message: error.localizedDescription
      )
    }
    return GenericError(
      type: .unknownError,
      error: DeviceClientErrorCode.unknown.rawValue,
      message: error.localizedDescription
    )
  }

  /// Creates the standard "handle not found" error.
  ///
  /// Returned when a JS call references a handle that does not exist in the
  /// registry — typically because the client was already disposed.
  ///
  /// - Returns: A `GenericError` with the `.handleNotFound` error code.
  internal static func handleNotFoundError() -> GenericError {
    GenericError(
      type: .stateError,
      error: DeviceClientErrorCode.handleNotFound.rawValue,
      message: "Device Client handle not found. The client may have been disposed."
    )
  }

  /// Creates the standard "unsupported device type" error.
  ///
  /// - Parameter value: The unrecognized device type string from JS.
  /// - Returns: A `GenericError` with the generic `.unknown` error code.
  internal static func invalidDeviceType(_ value: String) -> GenericError {
    GenericError(
      type: .argumentError,
      error: DeviceClientErrorCode.unknown.rawValue,
      message: "Unsupported device type: \(value)"
    )
  }
}
