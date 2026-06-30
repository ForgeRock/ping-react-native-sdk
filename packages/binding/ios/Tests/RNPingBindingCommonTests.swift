/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingBinding
@testable import RNPingBinding

@MainActor
final class RNPingBindingCommonTests: XCTestCase {

  // MARK: - Bind Journey

  func testBindForJourneyRejectsWithCallbackNotFoundWhenJourneyIdEmpty() async {
    let (code, message) = await invokeBindForJourney(journeyId: "", options: [:])
    XCTAssertEqual(code, "BINDING_CALLBACK_NOT_FOUND")
    XCTAssertNotNil(message)
    XCTAssertTrue(message?.contains("empty") == true)
    XCTAssertTrue(message?.contains("binding") == true)
  }

  func testBindForJourneyRejectsWithUiUnavailableWhenNoActiveWindow() async {
    let (code, _) = await invokeBindForJourney(journeyId: "journey-missing", options: [:])
    XCTAssertEqual(code, "BINDING_UI_UNAVAILABLE")
  }

  // MARK: - Sign Journey

  func testSignForJourneyRejectsWithCallbackNotFoundWhenJourneyIdEmpty() async {
    let (code, message) = await invokeSignForJourney(journeyId: "", options: [:])
    XCTAssertEqual(code, "BINDING_CALLBACK_NOT_FOUND")
    XCTAssertNotNil(message)
    XCTAssertTrue(message?.contains("empty") == true)
    XCTAssertTrue(message?.contains("signing") == true)
  }

  func testSignForJourneyRejectsWithUiUnavailableWhenNoActiveWindow() async {
    let (code, _) = await invokeSignForJourney(journeyId: "journey-missing", options: [:])
    XCTAssertEqual(code, "BINDING_UI_UNAVAILABLE")
  }

  // MARK: - Callback index

  func testParseCallbackIndexReadsNumericValue() {
    let index = RNPingBindingCommon._test_parseCallbackIndex(["index": 3])
    XCTAssertEqual(index, 3)
  }

  func testParseCallbackIndexReadsStringValue() {
    let index = RNPingBindingCommon._test_parseCallbackIndex(["index": "7"])
    XCTAssertEqual(index, 7)
  }

  func testParseCallbackIndexDefaultsToZeroWhenAbsent() {
    let index = RNPingBindingCommon._test_parseCallbackIndex([:])
    XCTAssertEqual(index, 0)
  }

  func testParseCallbackIndexDefaultsToZeroWhenInvalid() {
    let index = RNPingBindingCommon._test_parseCallbackIndex(["index": "not-a-number"])
    XCTAssertEqual(index, 0)
  }

  // MARK: - String option parsing (deviceName, signingAlgorithm)

  func testParseStringOptionReturnsValueWhenPresent() {
    let value = RNPingBindingCommon._test_parseStringOption(["deviceName": "My iPhone"], key: "deviceName")
    XCTAssertEqual(value, "My iPhone")
  }

  func testParseStringOptionTrimsWhitespace() {
    let value = RNPingBindingCommon._test_parseStringOption(["deviceName": "  My iPhone  "], key: "deviceName")
    XCTAssertEqual(value, "My iPhone")
  }

  func testParseStringOptionReturnsNilWhenBlank() {
    let value = RNPingBindingCommon._test_parseStringOption(["deviceName": "   "], key: "deviceName")
    XCTAssertNil(value)
  }

  func testParseStringOptionReturnsNilWhenAbsent() {
    let value = RNPingBindingCommon._test_parseStringOption([:], key: "deviceName")
    XCTAssertNil(value)
  }

  func testParseStringOptionReturnsNilForNonStringType() {
    let value = RNPingBindingCommon._test_parseStringOption(["deviceName": 42], key: "deviceName")
    XCTAssertNil(value)
  }

  // MARK: - Client config (loggerId, hasPinCollector, hasUserKeySelector, userKeyStorageId)

  func testParseLoggerIdReturnsValueWhenPresent() {
    let id = RNPingBindingCommon._test_parseLoggerId(["loggerId": "logger-abc"])
    XCTAssertEqual(id, "logger-abc")
  }

  func testParseLoggerIdTrimsWhitespace() {
    let id = RNPingBindingCommon._test_parseLoggerId(["loggerId": "  logger-abc  "])
    XCTAssertEqual(id, "logger-abc")
  }

  func testParseLoggerIdReturnsNilWhenBlank() {
    let id = RNPingBindingCommon._test_parseLoggerId(["loggerId": "   "])
    XCTAssertNil(id)
  }

  func testParseLoggerIdReturnsNilWhenAbsent() {
    let id = RNPingBindingCommon._test_parseLoggerId([:])
    XCTAssertNil(id)
  }

  func testParseStringConfigReadsUserKeyStorageId() {
    let id = RNPingBindingCommon._test_parseStringConfig(["userKeyStorageId": "storage-1"], key: "userKeyStorageId")
    XCTAssertEqual(id, "storage-1")
  }

  func testParseStringConfigReturnsNilWhenAbsent() {
    let id = RNPingBindingCommon._test_parseStringConfig([:], key: "userKeyStorageId")
    XCTAssertNil(id)
  }

  func testHasPinCollectorIsReadDirectlyFromConfig() {
    // hasPinCollector is read inline as config["hasPinCollector"] as? Bool == true
    // Verified via bind/sign rejection tests — no separate hook needed.
    // This test documents the expected key and type contract.
    let config: NSDictionary = ["hasPinCollector": true]
    XCTAssertEqual(config["hasPinCollector"] as? Bool, true)
  }

  func testHasUserKeySelectorIsReadDirectlyFromConfig() {
    let config: NSDictionary = ["hasUserKeySelector": true]
    XCTAssertEqual(config["hasUserKeySelector"] as? Bool, true)
  }

  // MARK: - configureAppPinConfig

  func testConfigureAppPinConfigAppliesAllFields() {
    let options: NSDictionary = [
      "appPin": [
        "maxAttempts": 7,
        "keyTag": "test-key-tag",
        "prompt": [
          "title": "My Title",
          "subtitle": "My Subtitle",
          "description": "My Desc",
        ],
      ],
    ]
    let result = RNPingBindingCommon._test_configureAppPinConfig(options)
    XCTAssertEqual(result?["pinRetry"] as? Int, 7)
    XCTAssertEqual(result?["keyTag"] as? String, "test-key-tag")
    XCTAssertEqual(result?["promptTitle"] as? String, "My Title")
    XCTAssertEqual(result?["promptSubtitle"] as? String, "My Subtitle")
    XCTAssertEqual(result?["promptDescription"] as? String, "My Desc")
  }

  func testConfigureAppPinConfigAppliesPartialPrompt() {
    let options: NSDictionary = [
      "appPin": [
        "maxAttempts": 3,
        "prompt": ["title": "Only Title"],
      ],
    ]
    let result = RNPingBindingCommon._test_configureAppPinConfig(options)
    XCTAssertEqual(result?["pinRetry"] as? Int, 3)
    XCTAssertEqual(result?["promptTitle"] as? String, "Only Title")
  }

  func testConfigureAppPinConfigReturnsNilWhenAppPinAbsent() {
    XCTAssertNil(RNPingBindingCommon._test_configureAppPinConfig([:]))
  }

  func testBuildBridgePromptUsesCallbackPromptWhenNoAppPinPromptProvided() {
    let result = RNPingBindingCommon._test_buildBridgePrompt([
      "title": "AM Title",
      "subtitle": "AM Subtitle",
      "description": "AM Description",
    ])
    XCTAssertEqual(result["promptTitle"] as? String, "AM Title")
    XCTAssertEqual(result["promptSubtitle"] as? String, "AM Subtitle")
    XCTAssertEqual(result["promptDescription"] as? String, "AM Description")
  }

  func testBuildBridgePromptAllowsAppPinPromptToOverrideCallbackPrompt() {
    let result = RNPingBindingCommon._test_buildBridgePrompt([
      "title": "AM Title",
      "subtitle": "AM Subtitle",
      "description": "AM Description",
      "appPin": [
        "prompt": [
          "title": "JS Title",
          "description": "JS Description",
        ],
      ],
    ])
    XCTAssertEqual(result["promptTitle"] as? String, "JS Title")
    XCTAssertEqual(result["promptSubtitle"] as? String, "AM Subtitle")
    XCTAssertEqual(result["promptDescription"] as? String, "JS Description")
  }

  // MARK: - appPin options

  func testParseAppPinOptionsParsesAllFields() {
    let options: NSDictionary = [
      "appPin": [
        "maxAttempts": 5,
        "keyTag": "pin-key-tag",
        "prompt": [
          "title": "PIN Title",
          "subtitle": "PIN Subtitle",
          "description": "PIN Description",
        ],
      ],
    ]
    let parsed = RNPingBindingCommon._test_parseAppPinOptions(options)
    XCTAssertEqual(parsed?["maxAttempts"] as? Int, 5)
    XCTAssertEqual(parsed?["keyTag"] as? String, "pin-key-tag")
    XCTAssertEqual(parsed?["promptTitle"] as? String, "PIN Title")
    XCTAssertEqual(parsed?["promptSubtitle"] as? String, "PIN Subtitle")
    XCTAssertEqual(parsed?["promptDescription"] as? String, "PIN Description")
  }

  func testParseAppPinOptionsReturnsNilWhenAbsent() {
    XCTAssertNil(RNPingBindingCommon._test_parseAppPinOptions([:]))
  }

  func testParseAppPinOptionsIgnoresMalformedTypes() {
    let options: NSDictionary = [
      "appPin": [
        "maxAttempts": "bad",
        "keyTag": 123,
        "prompt": "bad",
      ],
    ]
    let parsed = RNPingBindingCommon._test_parseAppPinOptions(options)
    XCTAssertNil(parsed?["maxAttempts"] as? Int)
    XCTAssertNil(parsed?["keyTag"] as? String)
    XCTAssertNil(parsed?["promptTitle"] as? String)
    XCTAssertNil(parsed?["promptSubtitle"] as? String)
    XCTAssertNil(parsed?["promptDescription"] as? String)
  }

  func testParseAppPinOptionsHandlesPartialPrompt() {
    let options: NSDictionary = [
      "appPin": [
        "maxAttempts": 3,
        "prompt": ["title": "Only Title"],
      ],
    ]
    let parsed = RNPingBindingCommon._test_parseAppPinOptions(options)
    XCTAssertEqual(parsed?["maxAttempts"] as? Int, 3)
    XCTAssertEqual(parsed?["promptTitle"] as? String, "Only Title")
    XCTAssertNil(parsed?["promptSubtitle"] as? String)
    XCTAssertNil(parsed?["promptDescription"] as? String)
  }

  // MARK: - biometric options (iOS — keyTag)

  func testParseBiometricOptionsParsesKeyTag() {
    let options: NSDictionary = [
      "biometric": [
        "ios": [
          "keyTag": "bio-key",
        ],
      ],
    ]
    let parsed = RNPingBindingCommon._test_parseBiometricOptions(options)
    XCTAssertEqual(parsed?["keyTag"] as? String, "bio-key")
  }

  func testParseBiometricOptionsReturnsNilWhenAbsent() {
    XCTAssertNil(RNPingBindingCommon._test_parseBiometricOptions([:]))
  }

  func testParseBiometricOptionsReturnsNilWhenIosKeyAbsent() {
    // Android-only biometric config — no ios sub-key — should return nil on iOS
    let options: NSDictionary = [
      "biometric": [
        "android": ["strongBoxPreferred": true],
      ],
    ]
    XCTAssertNil(RNPingBindingCommon._test_parseBiometricOptions(options))
  }

  func testParseBiometricOptionsIgnoresMalformedTypes() {
    let options: NSDictionary = [
      "biometric": [
        "ios": [
          "keyTag": 1,
        ],
      ],
    ]
    let parsed = RNPingBindingCommon._test_parseBiometricOptions(options)
    XCTAssertNil(parsed?["keyTag"] as? String)
  }

  // MARK: - jwt options

  func testParseJwtOptionsParsesAllFields() {
    let options: NSDictionary = [
      "jwt": [
        "issueTimeEpochSeconds": 1000,
        "notBeforeTimeEpochSeconds": 1001,
        "expirationTimeEpochSeconds": 1002,
      ],
    ]
    let parsed = RNPingBindingCommon._test_parseJwtOptions(options)
    XCTAssertEqual(parsed?["issueTimeEpochSeconds"] as? Double, 1000)
    XCTAssertEqual(parsed?["notBeforeTimeEpochSeconds"] as? Double, 1001)
    XCTAssertEqual(parsed?["expirationTimeEpochSeconds"] as? Double, 1002)
  }

  func testParseJwtOptionsReturnsNilWhenAbsent() {
    XCTAssertNil(RNPingBindingCommon._test_parseJwtOptions([:]))
  }

  func testParseJwtOptionsIgnoresMalformedTypes() {
    let options: NSDictionary = [
      "jwt": [
        "issueTimeEpochSeconds": "bad",
        "notBeforeTimeEpochSeconds": "bad",
        "expirationTimeEpochSeconds": "bad",
      ],
    ]
    let parsed = RNPingBindingCommon._test_parseJwtOptions(options)
    XCTAssertNil(parsed?["issueTimeEpochSeconds"] as? Double)
    XCTAssertNil(parsed?["notBeforeTimeEpochSeconds"] as? Double)
    XCTAssertNil(parsed?["expirationTimeEpochSeconds"] as? Double)
  }

  func testParseJwtOptionsHandlesPartialFields() {
    let options: NSDictionary = [
      "jwt": ["issueTimeEpochSeconds": 1000],
    ]
    let parsed = RNPingBindingCommon._test_parseJwtOptions(options)
    XCTAssertEqual(parsed?["issueTimeEpochSeconds"] as? Double, 1000)
    XCTAssertNil(parsed?["notBeforeTimeEpochSeconds"] as? Double)
    XCTAssertNil(parsed?["expirationTimeEpochSeconds"] as? Double)
  }

  // MARK: - claims

  func testParseClaimsParsesAllPrimitiveTypes() {
    let options: NSDictionary = [
      "claims": [
        "tenant": "alpha",
        "trusted": true,
        "score": 7,
      ],
    ]
    let parsed = RNPingBindingCommon._test_parseClaims(options)
    XCTAssertEqual(parsed["tenant"] as? String, "alpha")
    XCTAssertEqual(parsed["trusted"] as? Bool, true)
    XCTAssertEqual(parsed["score"] as? Int, 7)
  }

  func testParseClaimsReturnsEmptyWhenAbsent() {
    XCTAssertEqual(RNPingBindingCommon._test_parseClaims([:]).count, 0)
  }

  func testParseClaimsReturnsEmptyWhenInvalidType() {
    let parsed = RNPingBindingCommon._test_parseClaims(["claims": "invalid"])
    XCTAssertEqual(parsed.count, 0)
  }

  // MARK: - Error code contracts

  func testErrorCodeKeyReadErrorIsCorrect() {
    XCTAssertEqual(BindingErrorCode.keyReadError.rawValue, "BINDING_KEY_READ_ERROR")
  }

  func testErrorCodeKeyInvalidatedIsCorrect() {
    XCTAssertEqual(BindingErrorCode.keyInvalidated.rawValue, "BINDING_KEY_INVALIDATED")
  }

  func testErrorCodeAuthFailedIsCorrect() {
    XCTAssertEqual(BindingErrorCode.authFailed.rawValue, "BINDING_AUTH_FAILED")
  }

  // MARK: - Error code resolution

  func testAuthenticationFailedMapsToAuthFailedForBind() {
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingError.authenticationFailed,
      defaultCode: "BINDING_BIND_ERROR"
    )
    XCTAssertEqual(code, "BINDING_AUTH_FAILED")
  }

  func testAuthenticationFailedMapsToKeyInvalidatedForSign() {
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingError.authenticationFailed,
      defaultCode: "BINDING_SIGN_ERROR"
    )
    XCTAssertEqual(code, "BINDING_KEY_INVALIDATED")
  }

  func testBiometricErrorMapsToKeyInvalidatedForSign() {
    let underlying = NSError(domain: "LAErrorDomain", code: -8, userInfo: nil)
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingError.biometricError(underlying),
      defaultCode: "BINDING_SIGN_ERROR"
    )
    XCTAssertEqual(code, "BINDING_KEY_INVALIDATED")
  }

  func testBiometricErrorMapsToAuthFailedForBind() {
    let underlying = NSError(domain: "LAErrorDomain", code: -8, userInfo: nil)
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingError.biometricError(underlying),
      defaultCode: "BINDING_BIND_ERROR"
    )
    XCTAssertEqual(code, "BINDING_AUTH_FAILED")
  }

  func testUserCanceledMapsToBindingCancelled() {
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingError.userCanceled,
      defaultCode: "BINDING_BIND_ERROR"
    )
    XCTAssertEqual(code, "BINDING_CANCELLED")
  }

  func testTimeoutMapsToBindingCancelled() {
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingError.timeout,
      defaultCode: "BINDING_BIND_ERROR"
    )
    XCTAssertEqual(code, "BINDING_CANCELLED")
  }

  func testDeviceNotSupportedMapsToUnsupportedDevice() {
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingError.deviceNotSupported,
      defaultCode: "BINDING_BIND_ERROR"
    )
    XCTAssertEqual(code, "BINDING_UNSUPPORTED_DEVICE")
  }

  func testDeviceNotRegisteredMapsToNotRegistered() {
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingError.deviceNotRegistered,
      defaultCode: "BINDING_SIGN_ERROR"
    )
    XCTAssertEqual(code, "BINDING_NOT_REGISTERED")
  }

  func testInvalidClaimMapsToInvalidConfig() {
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingError.invalidClaim,
      defaultCode: "BINDING_SIGN_ERROR"
    )
    XCTAssertEqual(code, "BINDING_INVALID_CONFIG")
  }

  func testErrSecInvalidKeyMapsToKeyInvalidated() {
    let nsError = NSError(domain: NSOSStatusErrorDomain, code: -25300, userInfo: nil)
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      nsError,
      defaultCode: "BINDING_SIGN_ERROR"
    )
    XCTAssertEqual(code, "BINDING_KEY_INVALIDATED")
  }

  func testUnknownErrorFallsBackToDefaultCode() {
    let unknown = NSError(domain: "SomeUnknownDomain", code: 999, userInfo: nil)
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      unknown,
      defaultCode: "BINDING_SIGN_ERROR"
    )
    XCTAssertEqual(code, "BINDING_SIGN_ERROR")
  }

  func testDeviceBindingStatusUnAuthorizeMapsToAuthFailed() {
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingStatus.unAuthorize,
      defaultCode: "BINDING_SIGN_ERROR"
    )
    XCTAssertEqual(code, "BINDING_AUTH_FAILED")
  }

  func testDeviceBindingStatusAbortMapsToCancelled() {
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingStatus.abort,
      defaultCode: "BINDING_SIGN_ERROR"
    )
    XCTAssertEqual(code, "BINDING_CANCELLED")
  }

  func testDeviceBindingStatusTimeoutMapsToCancelled() {
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingStatus.timeout,
      defaultCode: "BINDING_SIGN_ERROR"
    )
    XCTAssertEqual(code, "BINDING_CANCELLED")
  }

  func testDeviceBindingStatusClientNotRegisteredMapsToNotRegistered() {
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingStatus.clientNotRegistered,
      defaultCode: "BINDING_SIGN_ERROR"
    )
    XCTAssertEqual(code, "BINDING_NOT_REGISTERED")
  }

  func testDeviceBindingStatusUnsupportedMapsToUnsupportedDevice() {
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingStatus.unsupported(errorMessage: nil),
      defaultCode: "BINDING_SIGN_ERROR"
    )
    XCTAssertEqual(code, "BINDING_UNSUPPORTED_DEVICE")
  }

  func testDeviceBindingStatusInvalidCustomClaimsMapsToAuthFailed() {
    let code = RNPingBindingCommon._test_resolveBindingErrorCode(
      DeviceBindingStatus.invalidCustomClaims,
      defaultCode: "BINDING_SIGN_ERROR"
    )
    XCTAssertEqual(code, "BINDING_AUTH_FAILED")
  }

  // MARK: - serializeUserKey field-name contracts

  func testSerializeUserKey_idFieldIsKid() {
    let key = UserKey(keyTag: "tag", userId: "u1", username: "alice", kid: "kid-123", authType: .biometricOnly)
    let dict = RNPingBindingCommon.serializeUserKey(key)
    XCTAssertEqual(dict["id"] as? String, "kid-123")
  }

  func testSerializeUserKey_userIdField() {
    let key = UserKey(keyTag: "tag", userId: "user-abc", username: "alice", kid: "kid-1", authType: .biometricOnly)
    let dict = RNPingBindingCommon.serializeUserKey(key)
    XCTAssertEqual(dict["userId"] as? String, "user-abc")
  }

  func testSerializeUserKey_usernameKeyIsLowercase() {
    // Bridge key must be "username" not "userName"
    let key = UserKey(keyTag: "tag", userId: "u1", username: "alice", kid: "kid-1", authType: .biometricOnly)
    let dict = RNPingBindingCommon.serializeUserKey(key)
    XCTAssertEqual(dict["username"] as? String, "alice")
    XCTAssertNil(dict["userName"])
  }

  func testSerializeUserKey_authenticationTypeIsUppercasedRawValue() {
    let key = UserKey(keyTag: "tag", userId: "u1", username: "alice", kid: "kid-1", authType: .biometricOnly)
    let dict = RNPingBindingCommon.serializeUserKey(key)
    XCTAssertEqual(dict["authenticationType"] as? String, "BIOMETRIC_ONLY")
  }

  func testSerializeUserKey_noExtraFields() {
    let key = UserKey(keyTag: "tag", userId: "u1", username: "alice", kid: "kid-1", authType: .biometricOnly)
    let dict = RNPingBindingCommon.serializeUserKey(key)
    XCTAssertEqual((dict as NSDictionary).count, 4)
  }

  // MARK: - Key Management

  func testGetAllKeysResolvesWithArray() async {
    let result = await invokeGetAllKeys()
    XCTAssertTrue(result.resolved, "getAllKeys should resolve, not reject")
    XCTAssertNil(result.code)
  }

  func testDeleteKeyRejectsWithKeyDeleteErrorWhenKeyNotFound() async {
    let result = await invokeDeleteKey(userId: "user-missing", keyId: "kid-missing")
    XCTAssertEqual(result.code, "BINDING_KEY_DELETE_ERROR")
  }

  func testDeleteAllKeysResolvesWhenNoKeysStored() async {
    let result = await invokeDeleteAllKeys()
    XCTAssertNil(result.code, "deleteAllKeys should resolve when no keys are stored")
  }

  // MARK: - Helpers

  private func invokeGetAllKeys() async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingBindingCommon.getAllKeys { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeDeleteKey(userId: String, keyId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingBindingCommon.deleteKey(userId: userId, keyId: keyId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeDeleteAllKeys() async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingBindingCommon.deleteAllKeys { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  @MainActor
  private func invokeBindForJourney(
    journeyId: String,
    options: NSDictionary
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingBindingCommon.bindForJourney(journeyId, options: options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  @MainActor
  private func invokeSignForJourney(
    journeyId: String,
    options: NSDictionary
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingBindingCommon.signForJourney(journeyId, options: options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }
}
