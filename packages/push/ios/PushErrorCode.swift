/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/// Stable error code strings passed to `rejecter(code, message, nil)`.
///
/// These values form the contract with the TypeScript `PushErrorCode` union in
/// `@ping-identity/rn-push`. Keep in sync with `PushErrorMapper` (Android) and
/// the `pushErrorCode(_:)` function in `RNPingPushCommon`.
enum PushErrorCode: String {
  case notInitialized = "not_initialized"
  case initializationFailed = "initialization_failed"
  case invalidUri = "invalid_uri"
  case missingRequiredParameter = "missing_required_parameter"
  case invalidParameterValue = "invalid_parameter_value"
  case invalidPushType = "invalid_push_type"
  case invalidPlatform = "invalid_platform"
  case storageFailure = "storage_failure"
  case deviceTokenNotSet = "device_token_not_set"
  case noHandlerForPlatform = "no_handler_for_platform"
  case messageParsingFailed = "message_parsing_failed"
  case credentialNotFound = "credential_not_found"
  case credentialLocked = "credential_locked"
  case duplicateCredential = "duplicate_credential"
  case notificationNotFound = "notification_not_found"
  case policyViolation = "policy_violation"
  case registrationFailed = "registration_failed"
  case networkFailure = "network_failure"
}
