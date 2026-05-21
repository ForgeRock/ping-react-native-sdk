/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import PingPush
import RNPingCore

/// Maps a thrown `Error` to the appropriate `PushErrorCode` raw string.
///
/// Non-`PushError` throwables map to `PushErrorCode.networkFailure`.
func pushErrorCode(_ error: Error) -> String {
  guard let pushError = error as? PushError else {
    return PushErrorCode.networkFailure.rawValue
  }
  switch pushError {
  case .notInitialized:           return PushErrorCode.notInitialized.rawValue
  case .initializationFailed:     return PushErrorCode.initializationFailed.rawValue
  case .invalidUri:               return PushErrorCode.invalidUri.rawValue
  case .missingRequiredParameter: return PushErrorCode.missingRequiredParameter.rawValue
  case .invalidParameterValue:    return PushErrorCode.invalidParameterValue.rawValue
  case .uriFormatting:            return PushErrorCode.invalidUri.rawValue
  case .invalidPushType:          return PushErrorCode.invalidPushType.rawValue
  case .invalidPlatform:          return PushErrorCode.invalidPlatform.rawValue
  case .storageFailure:           return PushErrorCode.storageFailure.rawValue
  case .deviceTokenNotSet:        return PushErrorCode.deviceTokenNotSet.rawValue
  case .noHandlerForPlatform:     return PushErrorCode.noHandlerForPlatform.rawValue
  case .messageParsingFailed:     return PushErrorCode.messageParsingFailed.rawValue
  case .credentialNotFound:       return PushErrorCode.credentialNotFound.rawValue
  case .credentialLocked:         return PushErrorCode.credentialLocked.rawValue
  case .duplicateCredential:      return PushErrorCode.duplicateCredential.rawValue
  case .notificationNotFound:     return PushErrorCode.notificationNotFound.rawValue
  case .policyViolation:          return PushErrorCode.policyViolation.rawValue
  case .registrationFailed:       return PushErrorCode.registrationFailed.rawValue
  case .networkFailure:           return PushErrorCode.networkFailure.rawValue
  }
}

/// Maps a thrown `Error` to the shared `ErrorType` category.
///
/// Non-`PushError` throwables map to `.networkError`.
func pushErrorType(_ error: Error) -> ErrorType {
  guard let pushError = error as? PushError else { return .networkError }
  switch pushError {
  case .notInitialized:         return .stateError
  case .initializationFailed:   return .internalError
  case .invalidUri,
       .missingRequiredParameter,
       .invalidParameterValue,
       .uriFormatting,
       .invalidPushType,
       .invalidPlatform:        return .argumentError
  case .storageFailure:         return .internalError
  case .deviceTokenNotSet,
       .credentialNotFound,
       .credentialLocked,
       .duplicateCredential,
       .notificationNotFound,
       .noHandlerForPlatform,
       .policyViolation:        return .stateError
  case .messageParsingFailed:   return .parseError
  case .registrationFailed,
       .networkFailure:         return .networkError
  }
}

/// Builds a `GenericError` from a thrown `Error` using push-specific code and type mappings.
func pushGenericError(_ error: Error) -> GenericError {
  GenericError(
    type: pushErrorType(error),
    error: pushErrorCode(error),
    message: error.localizedDescription
  )
}
