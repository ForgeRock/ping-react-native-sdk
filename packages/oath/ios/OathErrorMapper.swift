/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingOath
import RNPingCore

/// Maps native SDK errors into bridge-friendly ``GenericError`` instances.
///
/// Keeps classification logic out of ``RNPingOathCommon`` so the
/// bridge entry points stay focused on dispatch.
internal enum OathErrorMapper {

  /// Maps an arbitrary `Error` into a bridge-friendly `GenericError`.
  ///
  /// Exhaustively covers all `OathError` and `OathStorageError` cases from
  /// the `PingOath` SDK. All other errors fall through to the generic
  /// `.unknown` code.
  ///
  /// - Parameter error: Any error caught during bridge execution.
  /// - Returns: A `GenericError` ready for rejection through the React Native promise.
  internal static func mapError(_ error: Error) -> GenericError {
    if let oathError = error as? OathError {
      return mapOathError(oathError)
    }
    if let storageError = error as? OathStorageError {
      return mapStorageError(storageError)
    }
    return GenericError(
      type: .unknownError,
      error: OathErrorCodes.unknown.rawValue,
      message: error.localizedDescription
    )
  }

  // MARK: - Private helpers

  /// Maps an `OathError` from the native SDK into a bridge-friendly `GenericError`.
  ///
  /// - Parameter error: The `OathError` thrown by the native `PingOath` SDK.
  /// - Returns: A `GenericError` ready for rejection through the React Native promise.
  private static func mapOathError(_ error: OathError) -> GenericError {
    switch error {
    case .credentialNotFound(let message):
      return GenericError(
        type: .stateError,
        error: OathErrorCodes.credentialNotFound.rawValue,
        message: message
      )
    case .credentialLocked(let message):
      return GenericError(
        type: .stateError,
        error: OathErrorCodes.credentialLocked.rawValue,
        message: message
      )
    case .duplicateCredential(issuer: _, accountName: _):
      return GenericError(
        type: .stateError,
        error: OathErrorCodes.duplicateCredential.rawValue,
        message: error.localizedDescription
      )
    case .invalidUri(let message):
      return GenericError(
        type: .argumentError,
        error: OathErrorCodes.invalidUri.rawValue,
        message: message
      )
    case .missingRequiredParameter(let message):
      return GenericError(
        type: .argumentError,
        error: OathErrorCodes.missingParameter.rawValue,
        message: message
      )
    case .invalidParameterValue(let message):
      return GenericError(
        type: .argumentError,
        error: OathErrorCodes.invalidParameter.rawValue,
        message: message
      )
    case .invalidSecret(let message):
      return GenericError(
        type: .argumentError,
        error: OathErrorCodes.invalidParameter.rawValue,
        message: message
      )
    case .invalidOathType(let message):
      return GenericError(
        type: .argumentError,
        error: OathErrorCodes.invalidParameter.rawValue,
        message: message
      )
    case .invalidAlgorithm(let message):
      return GenericError(
        type: .argumentError,
        error: OathErrorCodes.invalidParameter.rawValue,
        message: message
      )
    case .uriFormatting(let message):
      return GenericError(
        type: .argumentError,
        error: OathErrorCodes.uriFormatting.rawValue,
        message: message
      )
    case .codeGenerationFailed(let message, _):
      return GenericError(
        type: .internalError,
        error: OathErrorCodes.codeGenerationFailed.rawValue,
        message: message
      )
    case .policyViolation(let message, _):
      return GenericError(
        type: .stateError,
        error: OathErrorCodes.policyViolation.rawValue,
        message: message
      )
    case .initializationFailed(let message, _):
      return GenericError(
        type: .internalError,
        error: OathErrorCodes.initializationFailed.rawValue,
        message: message
      )
    case .cleanupFailed(let message, _):
      return GenericError(
        type: .internalError,
        error: OathErrorCodes.cleanupFailed.rawValue,
        message: message
      )
    @unknown default:
      return GenericError(
        type: .unknownError,
        error: OathErrorCodes.unknown.rawValue,
        message: error.localizedDescription
      )
    }
  }

  /// Maps an `OathStorageError` from the native SDK into a bridge-friendly `GenericError`.
  ///
  /// - Parameter error: The `OathStorageError` thrown by the native `PingOath` SDK.
  /// - Returns: A `GenericError` ready for rejection through the React Native promise.
  private static func mapStorageError(_ error: OathStorageError) -> GenericError {
    switch error {
    case .storageFailure(let message, _):
      return GenericError(
        type: .internalError,
        error: OathErrorCodes.storageFailed.rawValue,
        message: message
      )
    case .duplicateCredential(let message):
      return GenericError(
        type: .stateError,
        error: OathErrorCodes.duplicateCredential.rawValue,
        message: message
      )
    case .storageCorrupted(let message):
      return GenericError(
        type: .internalError,
        error: OathErrorCodes.storageCorrupted.rawValue,
        message: message
      )
    case .accessDenied(let message):
      return GenericError(
        type: .internalError,
        error: OathErrorCodes.storageAccessDenied.rawValue,
        message: message
      )
    @unknown default:
      return GenericError(
        type: .unknownError,
        error: OathErrorCodes.unknown.rawValue,
        message: error.localizedDescription
      )
    }
  }
}
