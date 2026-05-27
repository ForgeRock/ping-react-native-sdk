/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingPush
@testable import RNPingPush

@MainActor
final class RNPingPushCommonTests: XCTestCase {

  // MARK: - Pending APNs token

  func testConsumeReturnedTokenAndClearsIt() {
    RNPingPushCommon.setPendingToken("abc123")
    XCTAssertEqual(RNPingPushCommon.consumePendingToken(), "abc123")
    XCTAssertNil(RNPingPushCommon.consumePendingToken(), "second consume must return nil")
  }

  func testConsumeReturnsNilWhenNoTokenSet() {
    RNPingPushCommon.cleanup()
    XCTAssertNil(RNPingPushCommon.consumePendingToken())
  }

  func testCleanupClearsPendingToken() {
    RNPingPushCommon.setPendingToken("should-be-cleared")
    RNPingPushCommon.cleanup()
    XCTAssertNil(RNPingPushCommon.consumePendingToken())
  }

  // MARK: - initialize

  func testInitializeResolvesWithClientHandle() async {
    let result = await invokeInitialize(config: [:])
    XCTAssertTrue(result.resolved, "initialize should resolve with a client handle")
    XCTAssertNil(result.code)
  }

  // MARK: - NOT_INITIALIZED guard (stale / unknown client handle)

  func testAddCredentialFromUriRejectsWhenClientNotFound() async {
    let result = await invokeAddCredentialFromUri(clientId: "unknown-handle", uri: "pushauth://test")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testSaveCredentialRejectsWhenClientNotFound() async {
    let result = await invokeSaveCredential(clientId: "unknown-handle", credential: [:])
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testGetCredentialsRejectsWhenClientNotFound() async {
    let result = await invokeGetCredentials(clientId: "unknown-handle")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testGetCredentialRejectsWhenClientNotFound() async {
    let result = await invokeGetCredential(clientId: "unknown-handle", credentialId: "cred-1")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testDeleteCredentialRejectsWhenClientNotFound() async {
    let result = await invokeDeleteCredential(clientId: "unknown-handle", credentialId: "cred-1")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testSetDeviceTokenRejectsWhenClientNotFound() async {
    let result = await invokeSetDeviceToken(clientId: "unknown-handle", token: "token-abc", credentialId: nil)
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testGetDeviceTokenRejectsWhenClientNotFound() async {
    let result = await invokeGetDeviceToken(clientId: "unknown-handle")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testProcessNotificationRejectsWhenClientNotFound() async {
    let result = await invokeProcessNotification(clientId: "unknown-handle", messageData: [:])
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testProcessNotificationFromMessageRejectsWhenClientNotFound() async {
    let result = await invokeProcessNotificationFromMessage(clientId: "unknown-handle", message: "raw-msg")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testApproveNotificationRejectsWhenClientNotFound() async {
    let result = await invokeApproveNotification(clientId: "unknown-handle", notificationId: "notif-1")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testApproveChallengeNotificationRejectsWhenClientNotFound() async {
    let result = await invokeApproveChallengeNotification(clientId: "unknown-handle", notificationId: "notif-1", challengeResponse: "42")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testApproveBiometricNotificationRejectsWhenClientNotFound() async {
    let result = await invokeApproveBiometricNotification(clientId: "unknown-handle", notificationId: "notif-1", authenticationMethod: "FACE_ID")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testDenyNotificationRejectsWhenClientNotFound() async {
    let result = await invokeDenyNotification(clientId: "unknown-handle", notificationId: "notif-1")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testGetPendingNotificationsRejectsWhenClientNotFound() async {
    let result = await invokeGetPendingNotifications(clientId: "unknown-handle")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testGetAllNotificationsRejectsWhenClientNotFound() async {
    let result = await invokeGetAllNotifications(clientId: "unknown-handle")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testGetNotificationRejectsWhenClientNotFound() async {
    let result = await invokeGetNotification(clientId: "unknown-handle", notificationId: "notif-1")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testCleanupNotificationsRejectsWhenClientNotFound() async {
    let result = await invokeCleanupNotifications(clientId: "unknown-handle", credentialId: nil)
    XCTAssertEqual(result.code, "not_initialized")
  }

  // MARK: - close (no client found → resolves silently)

  func testCloseResolvesWhenClientNotFound() async {
    let result = await invokeClose(clientId: "unknown-handle")
    XCTAssertTrue(result.resolved, "close should resolve even when handle is unknown")
    XCTAssertNil(result.code)
  }

  // MARK: - Error code contracts

  func testErrorCodeNotInitializedIsCorrect() {
    XCTAssertEqual(PushErrorCode.notInitialized.rawValue, "not_initialized")
  }

  func testErrorCodeInitializationFailedIsCorrect() {
    XCTAssertEqual(PushErrorCode.initializationFailed.rawValue, "initialization_failed")
  }

  func testErrorCodeInvalidUriIsCorrect() {
    XCTAssertEqual(PushErrorCode.invalidUri.rawValue, "invalid_uri")
  }

  func testErrorCodeMissingRequiredParameterIsCorrect() {
    XCTAssertEqual(PushErrorCode.missingRequiredParameter.rawValue, "missing_required_parameter")
  }

  func testErrorCodeInvalidParameterValueIsCorrect() {
    XCTAssertEqual(PushErrorCode.invalidParameterValue.rawValue, "invalid_parameter_value")
  }

  func testErrorCodeInvalidPushTypeIsCorrect() {
    XCTAssertEqual(PushErrorCode.invalidPushType.rawValue, "invalid_push_type")
  }

  func testErrorCodeInvalidPlatformIsCorrect() {
    XCTAssertEqual(PushErrorCode.invalidPlatform.rawValue, "invalid_platform")
  }

  func testErrorCodeStorageFailureIsCorrect() {
    XCTAssertEqual(PushErrorCode.storageFailure.rawValue, "storage_failure")
  }

  func testErrorCodeDeviceTokenNotSetIsCorrect() {
    XCTAssertEqual(PushErrorCode.deviceTokenNotSet.rawValue, "device_token_not_set")
  }

  func testErrorCodeNoHandlerForPlatformIsCorrect() {
    XCTAssertEqual(PushErrorCode.noHandlerForPlatform.rawValue, "no_handler_for_platform")
  }

  func testErrorCodeMessageParsingFailedIsCorrect() {
    XCTAssertEqual(PushErrorCode.messageParsingFailed.rawValue, "message_parsing_failed")
  }

  func testErrorCodeCredentialNotFoundIsCorrect() {
    XCTAssertEqual(PushErrorCode.credentialNotFound.rawValue, "credential_not_found")
  }

  func testErrorCodeCredentialLockedIsCorrect() {
    XCTAssertEqual(PushErrorCode.credentialLocked.rawValue, "credential_locked")
  }

  func testErrorCodeDuplicateCredentialIsCorrect() {
    XCTAssertEqual(PushErrorCode.duplicateCredential.rawValue, "duplicate_credential")
  }

  func testErrorCodeNotificationNotFoundIsCorrect() {
    XCTAssertEqual(PushErrorCode.notificationNotFound.rawValue, "notification_not_found")
  }

  func testErrorCodePolicyViolationIsCorrect() {
    XCTAssertEqual(PushErrorCode.policyViolation.rawValue, "policy_violation")
  }

  func testErrorCodeRegistrationFailedIsCorrect() {
    XCTAssertEqual(PushErrorCode.registrationFailed.rawValue, "registration_failed")
  }

  func testErrorCodeNetworkFailureIsCorrect() {
    XCTAssertEqual(PushErrorCode.networkFailure.rawValue, "network_failure")
  }

  // MARK: - pushErrorCode mapping

  func testPushErrorCodeMapsNotInitialized() {
    let code = pushErrorCode(PushError.notInitialized)
    XCTAssertEqual(code, "not_initialized")
  }

  func testPushErrorCodeMapsInitializationFailed() {
    let code = pushErrorCode(PushError.initializationFailed("boot", nil))
    XCTAssertEqual(code, "initialization_failed")
  }

  func testPushErrorCodeMapsInvalidUri() {
    let code = pushErrorCode(PushError.invalidUri("bad"))
    XCTAssertEqual(code, "invalid_uri")
  }

  func testPushErrorCodeMapsStorageFailure() {
    let code = pushErrorCode(PushError.storageFailure("disk", nil))
    XCTAssertEqual(code, "storage_failure")
  }

  func testPushErrorCodeMapsNetworkFailure() {
    let code = pushErrorCode(PushError.networkFailure("timeout", nil))
    XCTAssertEqual(code, "network_failure")
  }

  func testPushErrorCodeMapsMissingRequiredParameter() {
    let code = pushErrorCode(PushError.missingRequiredParameter("field"))
    XCTAssertEqual(code, "missing_required_parameter")
  }

  func testPushErrorCodeMapsInvalidParameterValue() {
    let code = pushErrorCode(PushError.invalidParameterValue("bad value"))
    XCTAssertEqual(code, "invalid_parameter_value")
  }

  func testPushErrorCodeMapsInvalidPushType() {
    let code = pushErrorCode(PushError.invalidPushType("UNKNOWN"))
    XCTAssertEqual(code, "invalid_push_type")
  }

  func testPushErrorCodeMapsInvalidPlatform() {
    let code = pushErrorCode(PushError.invalidPlatform("UNKNOWN"))
    XCTAssertEqual(code, "invalid_platform")
  }

  func testPushErrorCodeMapsDeviceTokenNotSet() {
    let code = pushErrorCode(PushError.deviceTokenNotSet)
    XCTAssertEqual(code, "device_token_not_set")
  }

  func testPushErrorCodeMapsNoHandlerForPlatform() {
    let code = pushErrorCode(PushError.noHandlerForPlatform("ios"))
    XCTAssertEqual(code, "no_handler_for_platform")
  }

  func testPushErrorCodeMapsMessageParsingFailed() {
    let code = pushErrorCode(PushError.messageParsingFailed("bad jwt"))
    XCTAssertEqual(code, "message_parsing_failed")
  }

  func testPushErrorCodeMapsCredentialLocked() {
    let code = pushErrorCode(PushError.credentialLocked("id"))
    XCTAssertEqual(code, "credential_locked")
  }

  func testPushErrorCodeMapsDuplicateCredential() {
    let code = pushErrorCode(PushError.duplicateCredential(issuer: "Example", accountName: "user@example.com"))
    XCTAssertEqual(code, "duplicate_credential")
  }

  func testPushErrorCodeMapsNotificationNotFound() {
    let code = pushErrorCode(PushError.notificationNotFound("id"))
    XCTAssertEqual(code, "notification_not_found")
  }

  func testPushErrorCodeMapsPolicyViolation() {
    let code = pushErrorCode(PushError.policyViolation("reason"))
    XCTAssertEqual(code, "policy_violation")
  }

  func testPushErrorCodeMapsRegistrationFailed() {
    let code = pushErrorCode(PushError.registrationFailed("server"))
    XCTAssertEqual(code, "registration_failed")
  }

  func testPushErrorCodeFallsBackToNetworkFailureForUnknownErrors() {
    let unknown = NSError(domain: "UnknownDomain", code: 999, userInfo: nil)
    let code = pushErrorCode(unknown)
    XCTAssertEqual(code, "network_failure")
  }

  // MARK: - pushErrorType mapping

  func testPushErrorTypeMapsNotInitializedToStateError() {
    let type_ = pushErrorType(PushError.notInitialized)
    XCTAssertEqual(type_, .stateError)
  }

  func testPushErrorTypeMapsInitializationFailedToInternalError() {
    let type_ = pushErrorType(PushError.initializationFailed("reason", nil))
    XCTAssertEqual(type_, .internalError)
  }

  func testPushErrorTypeMapsInvalidUriToArgumentError() {
    let type_ = pushErrorType(PushError.invalidUri("bad"))
    XCTAssertEqual(type_, .argumentError)
  }

  func testPushErrorTypeMapsStorageFailureToInternalError() {
    let type_ = pushErrorType(PushError.storageFailure("disk", nil))
    XCTAssertEqual(type_, .internalError)
  }

  func testPushErrorTypeMapsCredentialNotFoundToStateError() {
    let type_ = pushErrorType(PushError.credentialNotFound("id"))
    XCTAssertEqual(type_, .stateError)
  }

  func testPushErrorTypeMapsMessageParsingFailedToParseError() {
    let type_ = pushErrorType(PushError.messageParsingFailed("bad jwt"))
    XCTAssertEqual(type_, .parseError)
  }

  func testPushErrorTypeMapsNetworkFailureToNetworkError() {
    let type_ = pushErrorType(PushError.networkFailure("timeout", nil))
    XCTAssertEqual(type_, .networkError)
  }

  func testPushErrorTypeMapsDeviceTokenNotSetToStateError() {
    let type_ = pushErrorType(PushError.deviceTokenNotSet)
    XCTAssertEqual(type_, .stateError)
  }

  func testPushErrorTypeMapsCredentialLockedToStateError() {
    let type_ = pushErrorType(PushError.credentialLocked("id"))
    XCTAssertEqual(type_, .stateError)
  }

  func testPushErrorTypeMapsDuplicateCredentialToStateError() {
    let type_ = pushErrorType(PushError.duplicateCredential(issuer: "Example", accountName: "user@example.com"))
    XCTAssertEqual(type_, .stateError)
  }

  func testPushErrorTypeMapsNotificationNotFoundToStateError() {
    let type_ = pushErrorType(PushError.notificationNotFound("id"))
    XCTAssertEqual(type_, .stateError)
  }

  func testPushErrorTypeMapsNoHandlerForPlatformToStateError() {
    let type_ = pushErrorType(PushError.noHandlerForPlatform("ios"))
    XCTAssertEqual(type_, .stateError)
  }

  func testPushErrorTypeMapsPolicyViolationToStateError() {
    let type_ = pushErrorType(PushError.policyViolation("reason"))
    XCTAssertEqual(type_, .stateError)
  }

  func testPushErrorTypeMapsInvalidParameterValueToArgumentError() {
    let type_ = pushErrorType(PushError.invalidParameterValue("bad"))
    XCTAssertEqual(type_, .argumentError)
  }

  func testPushErrorTypeMapsInvalidPushTypeToArgumentError() {
    let type_ = pushErrorType(PushError.invalidPushType("X"))
    XCTAssertEqual(type_, .argumentError)
  }

  func testPushErrorTypeMapsInvalidPlatformToArgumentError() {
    let type_ = pushErrorType(PushError.invalidPlatform("X"))
    XCTAssertEqual(type_, .argumentError)
  }

  func testPushErrorTypeMapsMissingRequiredParameterToArgumentError() {
    let type_ = pushErrorType(PushError.missingRequiredParameter("field"))
    XCTAssertEqual(type_, .argumentError)
  }

  func testPushErrorTypeMapsRegistrationFailedToNetworkError() {
    let type_ = pushErrorType(PushError.registrationFailed("server"))
    XCTAssertEqual(type_, .networkError)
  }

  func testPushErrorTypeFallsBackToNetworkErrorForUnknownErrors() {
    let unknown = NSError(domain: "UnknownDomain", code: 999, userInfo: nil)
    let type_ = pushErrorType(unknown)
    XCTAssertEqual(type_, .networkError)
  }

  // MARK: - serializeCredential

  func testSerializeCredentialIncludesRequiredFields() {
    let cred = PushCredential(
      id: "cred-id",
      issuer: "issuer",
      accountName: "account",
      serverEndpoint: "https://example.com",
      sharedSecret: "test-secret",
      isLocked: false,
      platform: .pingAM
    )
    let dict = serializeCredential(cred)
    XCTAssertEqual(dict["id"] as? String, "cred-id")
    XCTAssertEqual(dict["issuer"] as? String, "issuer")
    XCTAssertEqual(dict["accountName"] as? String, "account")
    XCTAssertEqual(dict["platform"] as? String, "PING_AM")
    XCTAssertEqual(dict["isLocked"] as? Bool, false)
    XCTAssertNil(dict["sharedSecret"], "sharedSecret must not be present in serialized credential")
  }

  func testSerializeCredentialNullableFieldsAreNSNull() {
    let cred = PushCredential(
      id: "cred-id",
      issuer: "issuer",
      accountName: "account",
      serverEndpoint: "https://example.com",
      sharedSecret: "test-secret",
      platform: .pingAM
    )
    let dict = serializeCredential(cred)
    XCTAssertTrue(dict["userId"] is NSNull)
    XCTAssertTrue(dict["imageURL"] is NSNull)
    XCTAssertTrue(dict["policies"] is NSNull)
    XCTAssertTrue(dict["lockingPolicy"] is NSNull)
  }

  func testSerializeCredentialDefaultsDisplayFieldsToIssuerAndAccountName() {
    let cred = PushCredential(
      id: "cred-id",
      issuer: "Example Issuer",
      accountName: "user@example.com",
      serverEndpoint: "https://example.com",
      sharedSecret: "test-secret"
    )
    let dict = serializeCredential(cred)
    XCTAssertEqual(dict["displayIssuer"] as? String, "Example Issuer")
    XCTAssertEqual(dict["displayAccountName"] as? String, "user@example.com")
  }

  func testSerializeCredentialNonNullOptionalFieldsArePresent() {
    let cred = PushCredential(
      id: "cred-id",
      userId: "user-1",
      resourceId: "res-1",
      issuer: "issuer",
      displayIssuer: "Display Issuer",
      accountName: "account",
      displayAccountName: "Display Account",
      serverEndpoint: "https://example.com",
      sharedSecret: "test-secret",
      createdAt: Date(timeIntervalSince1970: 1_700_000_000),
      imageURL: "https://img.example.com/logo.png",
      backgroundColor: "#FF0000",
      policies: "{\"requireBiometric\":true}",
      lockingPolicy: "{\"maxAttempts\":5}",
      isLocked: true,
      platform: .pingAM
    )
    let dict = serializeCredential(cred)
    XCTAssertEqual(dict["userId"] as? String, "user-1")
    XCTAssertEqual(dict["resourceId"] as? String, "res-1")
    XCTAssertEqual(dict["displayIssuer"] as? String, "Display Issuer")
    XCTAssertEqual(dict["displayAccountName"] as? String, "Display Account")
    XCTAssertEqual(dict["serverEndpoint"] as? String, "https://example.com")
    XCTAssertEqual(dict["imageURL"] as? String, "https://img.example.com/logo.png")
    XCTAssertEqual(dict["backgroundColor"] as? String, "#FF0000")
    XCTAssertEqual(dict["isLocked"] as? Bool, true)
  }

  func testSerializeCredentialSharedSecretNotPresent() {
    let cred = PushCredential(
      id: "cred-id",
      issuer: "issuer",
      accountName: "account",
      serverEndpoint: "https://example.com",
      sharedSecret: "sensitive-value",
      platform: .pingAM
    )
    let dict = serializeCredential(cred)
    XCTAssertNil(dict["sharedSecret"], "sharedSecret must never appear in the serialized credential")
  }

  // MARK: - serializeNotification

  func testSerializeNotificationIncludesRequiredFields() {
    let notif = PushNotification(
      id: "notif-1",
      credentialId: "cred-1",
      ttl: 120,
      messageId: "msg-1",
      pushType: .default
    )
    let dict = serializeNotification(notif)
    XCTAssertEqual(dict["id"] as? String, "notif-1")
    XCTAssertEqual(dict["credentialId"] as? String, "cred-1")
    XCTAssertEqual(dict["ttl"] as? Int, 120)
    XCTAssertEqual(dict["messageId"] as? String, "msg-1")
    XCTAssertNotNil(dict["createdAt"])
    XCTAssertEqual(dict["pending"] as? Bool, true)
    XCTAssertEqual(dict["approved"] as? Bool, false)
  }

  func testSerializeNotificationPushTypeDefault() {
    let notif = PushNotification(
      id: "n", credentialId: "c", ttl: 60, messageId: "m", pushType: .default
    )
    XCTAssertEqual(serializeNotification(notif)["pushType"] as? String, "default")
  }

  func testSerializeNotificationPushTypeChallenge() {
    let notif = PushNotification(
      id: "n", credentialId: "c", ttl: 60, messageId: "m", pushType: .challenge
    )
    XCTAssertEqual(serializeNotification(notif)["pushType"] as? String, "challenge")
  }

  func testSerializeNotificationPushTypeBiometric() {
    let notif = PushNotification(
      id: "n", credentialId: "c", ttl: 60, messageId: "m", pushType: .biometric
    )
    XCTAssertEqual(serializeNotification(notif)["pushType"] as? String, "biometric")
  }

  func testSerializeNotificationNullableFieldsAreNSNull() {
    let notif = PushNotification(
      id: "n", credentialId: "c", ttl: 60, messageId: "m",
      messageText: nil, customPayload: nil, challenge: nil,
      numbersChallenge: nil, loadBalancer: nil, contextInfo: nil,
      pushType: .default
    )
    let dict = serializeNotification(notif)
    XCTAssertTrue(dict["messageText"] is NSNull)
    XCTAssertTrue(dict["customPayload"] is NSNull)
    XCTAssertTrue(dict["challenge"] is NSNull)
    XCTAssertTrue(dict["numbersChallenge"] is NSNull)
    XCTAssertTrue(dict["loadBalancer"] is NSNull)
    XCTAssertTrue(dict["contextInfo"] is NSNull)
    XCTAssertTrue(dict["sentAt"] is NSNull)
    XCTAssertTrue(dict["respondedAt"] is NSNull)
  }

  func testSerializeNotificationOptionalFieldsWhenPresent() {
    let sentDate = Date(timeIntervalSince1970: 1_700_000_100)
    let respondedDate = Date(timeIntervalSince1970: 1_700_000_200)
    let notif = PushNotification(
      id: "n", credentialId: "c", ttl: 60, messageId: "m",
      messageText: "Login from Chrome",
      customPayload: "{\"key\":\"val\"}",
      challenge: "abc123",
      numbersChallenge: "12,34,56",
      loadBalancer: "lb-1",
      contextInfo: "{\"ip\":\"1.2.3.4\"}",
      pushType: .challenge,
      sentAt: sentDate,
      respondedAt: respondedDate
    )
    let dict = serializeNotification(notif)
    XCTAssertEqual(dict["messageText"] as? String, "Login from Chrome")
    XCTAssertEqual(dict["customPayload"] as? String, "{\"key\":\"val\"}")
    XCTAssertEqual(dict["challenge"] as? String, "abc123")
    XCTAssertEqual(dict["numbersChallenge"] as? String, "12,34,56")
    XCTAssertEqual(dict["loadBalancer"] as? String, "lb-1")
    XCTAssertEqual(dict["contextInfo"] as? String, "{\"ip\":\"1.2.3.4\"}")
    XCTAssertEqual(dict["sentAt"] as! Double, sentDate.timeIntervalSince1970 * 1000, accuracy: 1)
    XCTAssertEqual(dict["respondedAt"] as! Double, respondedDate.timeIntervalSince1970 * 1000, accuracy: 1)
  }

  func testSerializeNotificationCreatedAtIsMilliseconds() {
    let created = Date(timeIntervalSince1970: 1_700_000_000)
    let notif = PushNotification(
      id: "n", credentialId: "c", ttl: 60, messageId: "m",
      pushType: .default, createdAt: created
    )
    let dict = serializeNotification(notif)
    XCTAssertEqual(dict["createdAt"] as! Double, 1_700_000_000_000.0, accuracy: 1)
  }

  // MARK: - Helpers

  private func invokeInitialize(config: NSDictionary) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.initialize(config: config) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeAddCredentialFromUri(clientId: String, uri: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.addCredentialFromUri(clientId, uri: uri) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeSaveCredential(clientId: String, credential: NSDictionary) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.saveCredential(clientId, credential: credential) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeGetCredentials(clientId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.getCredentials(clientId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeGetCredential(clientId: String, credentialId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.getCredential(clientId, credentialId: credentialId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeDeleteCredential(clientId: String, credentialId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.deleteCredential(clientId, credentialId: credentialId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeSetDeviceToken(clientId: String, token: String, credentialId: String?) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.setDeviceToken(clientId, token: token, credentialId: credentialId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeGetDeviceToken(clientId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.getDeviceToken(clientId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeProcessNotification(clientId: String, messageData: NSDictionary) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.processNotification(clientId, messageData: messageData) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeProcessNotificationFromMessage(clientId: String, message: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.processNotificationFromMessage(clientId, message: message) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeApproveNotification(clientId: String, notificationId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.approveNotification(clientId, notificationId: notificationId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeApproveChallengeNotification(clientId: String, notificationId: String, challengeResponse: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.approveChallengeNotification(clientId, notificationId: notificationId, challengeResponse: challengeResponse) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeApproveBiometricNotification(clientId: String, notificationId: String, authenticationMethod: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.approveBiometricNotification(clientId, notificationId: notificationId, authenticationMethod: authenticationMethod) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeDenyNotification(clientId: String, notificationId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.denyNotification(clientId, notificationId: notificationId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeGetPendingNotifications(clientId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.getPendingNotifications(clientId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeGetAllNotifications(clientId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.getAllNotifications(clientId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeGetNotification(clientId: String, notificationId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.getNotification(clientId, notificationId: notificationId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeCleanupNotifications(clientId: String, credentialId: String?) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.cleanupNotifications(clientId, credentialId: credentialId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeClose(clientId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushCommon.close(clientId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }
}
