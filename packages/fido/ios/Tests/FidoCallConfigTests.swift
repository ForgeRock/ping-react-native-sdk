/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import AuthenticationServices
import XCTest
import PingFido
import PingLogger
import RNPingCore
@testable import RNPingFido

/// Unit tests for the per-call FIDO configuration parsing and the
/// per-method failure-code classification:
/// - `preferImmediatelyAvailableCredentials` parses on authentication
///   ceremonies and is reported and dropped on registration ceremonies.
/// - Off-platform (`android`) and mistyped option values are reported and
///   fall back to the native defaults.
/// - Authentication failures that classify as cancellation reject with
///   `FIDO_AUTHENTICATE_CANCELLED`; registration keeps `FIDO_REGISTER_ERROR`
///   for the same failure shapes.
@MainActor
final class FidoCallConfigTests: XCTestCase {

  // MARK: - PIA parsing per ceremony

  func testAuthenticationCeremonyParsesPreferImmediatelyAvailableCredentials() {
    var warnings: [String] = []

    let config = FidoCallConfig.parse(
      ["preferImmediatelyAvailableCredentials": true],
      ceremony: .authentication
    ) { warnings.append($0) }

    XCTAssertEqual(config.preferImmediatelyAvailableCredentials, true)
    XCTAssertTrue(warnings.isEmpty)
  }

  func testAuthenticationCeremonyParsesFalsePreference() {
    var warnings: [String] = []

    let config = FidoCallConfig.parse(
      ["preferImmediatelyAvailableCredentials": false],
      ceremony: .authentication
    ) { warnings.append($0) }

    XCTAssertEqual(config.preferImmediatelyAvailableCredentials, false)
    XCTAssertTrue(warnings.isEmpty)
  }

  func testRegistrationCeremonyWarnsAndDropsPreferImmediatelyAvailableCredentials() {
    var warnings: [String] = []

    let config = FidoCallConfig.parse(
      ["preferImmediatelyAvailableCredentials": true],
      ceremony: .registration
    ) { warnings.append($0) }

    XCTAssertNil(config.preferImmediatelyAvailableCredentials)
    XCTAssertEqual(warnings.count, 1)
    XCTAssertTrue(warnings[0].contains("preferImmediatelyAvailableCredentials"))
  }

  func testAbsentPreferenceParsesToNilWithoutWarnings() {
    var warnings: [String] = []

    let config = FidoCallConfig.parse([:], ceremony: .authentication) { warnings.append($0) }

    XCTAssertNil(config.preferImmediatelyAvailableCredentials)
    XCTAssertTrue(warnings.isEmpty)
  }

  // MARK: - Mistyped values

  func testMistypedPreferenceWarnsWithTypeAndLengthAndFallsBackToNil() {
    var warnings: [String] = []

    let config = FidoCallConfig.parse(
      ["preferImmediatelyAvailableCredentials": "true"],
      ceremony: .authentication
    ) { warnings.append($0) }

    XCTAssertNil(config.preferImmediatelyAvailableCredentials)
    XCTAssertEqual(warnings.count, 1)
    XCTAssertTrue(warnings[0].contains("preferImmediatelyAvailableCredentials"))
    XCTAssertTrue(warnings[0].contains("String"))
    XCTAssertTrue(warnings[0].contains("length 4"))
    // The raw value must never appear in the warning.
    XCTAssertFalse(warnings[0].contains("true"))
  }

  func testNumericPreferenceIsRejectedRatherThanPromoted() {
    var warnings: [String] = []

    let config = FidoCallConfig.parse(
      ["preferImmediatelyAvailableCredentials": 1],
      ceremony: .authentication
    ) { warnings.append($0) }

    XCTAssertNil(config.preferImmediatelyAvailableCredentials)
    XCTAssertEqual(warnings.count, 1)
    XCTAssertTrue(warnings[0].contains("a Number"))
  }

  func testMistypedLoggerIdWarnsAndFallsBackToNil() {
    var warnings: [String] = []

    let config = FidoCallConfig.parse(
      ["loggerId": 42],
      ceremony: .authentication
    ) { warnings.append($0) }

    XCTAssertNil(config.loggerId)
    XCTAssertEqual(warnings.count, 1)
    XCTAssertTrue(warnings[0].contains("loggerId"))
    XCTAssertTrue(warnings[0].contains("a Number"))
  }

  // MARK: - Off-platform keys

  func testAndroidConfigKeyWarnsOnIOSAndIsDropped() {
    var warnings: [String] = []

    let config = FidoCallConfig.parse(
      ["android": ["useFido2ApiClient": true]],
      ceremony: .authentication
    ) { warnings.append($0) }

    XCTAssertEqual(config.preferImmediatelyAvailableCredentials, nil)
    XCTAssertEqual(warnings.count, 1)
    XCTAssertTrue(warnings[0].contains("android"))
    XCTAssertTrue(warnings[0].contains("an Object"))
    XCTAssertFalse(warnings[0].contains("useFido2ApiClient"))
  }

  // MARK: - Unknown keys

  func testUnknownKeyWarnsOnceWithTypeAndIsIgnored() {
    var warnings: [String] = []

    let config = FidoCallConfig.parse(
      ["preferImmediatelyAvailibleCredentials": "yes"],
      ceremony: .authentication
    ) { warnings.append($0) }

    XCTAssertNil(config.preferImmediatelyAvailableCredentials)
    XCTAssertEqual(warnings.count, 1)
    XCTAssertTrue(warnings[0].contains("preferImmediatelyAvailibleCredentials"))
    XCTAssertTrue(warnings[0].contains("a String"))
    XCTAssertTrue(warnings[0].contains("length 3"))
    // The raw value must never appear in the warning.
    XCTAssertFalse(warnings[0].contains("\"yes\""))
  }

  func testMultipleUnknownKeysWarnOnceEach() {
    var warnings: [String] = []

    let config = FidoCallConfig.parse(
      ["unknownOne": 1, "unknownTwo": [1, 2]],
      ceremony: .authentication
    ) { warnings.append($0) }

    XCTAssertEqual(warnings.count, 2)
    XCTAssertTrue(warnings.contains { $0.contains("unknownOne") })
    XCTAssertTrue(warnings.contains { $0.contains("unknownTwo") })
    XCTAssertNil(config.preferImmediatelyAvailableCredentials)
  }

  func testKnownKeysProduceNoUnknownKeyWarnings() {
    var warnings: [String] = []

    let config = FidoCallConfig.parse(
      [
        "loggerId": "handle-1",
        "preferImmediatelyAvailableCredentials": true,
        "android": ["useFido2ApiClient": true],
      ],
      ceremony: .authentication
    ) { warnings.append($0) }

    XCTAssertEqual(config.loggerId, "handle-1")
    XCTAssertEqual(config.preferImmediatelyAvailableCredentials, true)
    // The `android` key is recognized, so no unknown-key warning fires; the
    // single warning is the off-platform report for that same key.
    XCTAssertEqual(warnings.count, 1)
    XCTAssertTrue(warnings[0].contains("android"))
  }

  func testUnknownKeyOnRegistrationCeremonyAlsoWarns() {
    var warnings: [String] = []

    _ = FidoCallConfig.parse(
      ["mystery": true],
      ceremony: .registration
    ) { warnings.append($0) }

    XCTAssertEqual(warnings.count, 1)
    XCTAssertTrue(warnings[0].contains("mystery"))
    XCTAssertTrue(warnings[0].contains("a Boolean"))
  }

  // MARK: - Logger id

  func testLoggerIdParsesTrimmedAndDropsBlank() {
    var warnings: [String] = []

    let trimmed = FidoCallConfig.parse(
      ["loggerId": "  handle-1  "],
      ceremony: .authentication
    ) { warnings.append($0) }
    let blank = FidoCallConfig.parse(
      ["loggerId": "   "],
      ceremony: .authentication
    ) { warnings.append($0) }

    XCTAssertEqual(trimmed.loggerId, "handle-1")
    XCTAssertNil(blank.loggerId)
    XCTAssertTrue(warnings.isEmpty)
  }

  // MARK: - Failure-code classification per method

  func testAuthenticateFailureWithCancellationMapsToCancelled() {
    let code = RNPingFidoCommon.failureCode(
      error: ASAuthorizationError(.canceled),
      methodErrorCode: .authenticateError,
      cancellationCode: .authenticateCancelled
    )

    XCTAssertEqual(code, .authenticateCancelled)
  }

  func testAuthenticateFailureWithDaVinciTransformedCancellationMapsToCancelled() {
    let code = RNPingFidoCommon.failureCode(
      error: FidoError.unsupportedAction(FidoConstants.ERROR_NOT_ALLOWED_MESSAGE),
      methodErrorCode: .authenticateError,
      cancellationCode: .authenticateCancelled
    )

    XCTAssertEqual(code, .authenticateCancelled)
  }

  func testAuthenticateNonRecoverableFailureStaysAuthenticateError() {
    let code = RNPingFidoCommon.failureCode(
      error: ASAuthorizationError(.unknown),
      methodErrorCode: .authenticateError,
      cancellationCode: .authenticateCancelled
    )

    XCTAssertEqual(code, .authenticateError)
  }

  func testAuthenticateFailureWithOtherUnsupportedActionStaysAuthenticateError() {
    let code = RNPingFidoCommon.failureCode(
      error: FidoError.unsupportedAction("Operation not supported"),
      methodErrorCode: .authenticateError,
      cancellationCode: .authenticateCancelled
    )

    XCTAssertEqual(code, .authenticateError)
  }

  func testRegisterFailureWithCancellationStaysRegisterError() {
    let code = RNPingFidoCommon.failureCode(
      error: ASAuthorizationError(.canceled),
      methodErrorCode: .registerError,
      cancellationCode: nil
    )

    XCTAssertEqual(code, .registerError)
  }

  // MARK: - Warning sink resolution

  func testWarningSinkFallsBackToLogManagerWhenLoggerIdUnknown() async {
    let sink = await FidoCallConfig.warningSink(loggerId: "unknown-handle")

    XCTAssertTrue((sink as AnyObject) === (LogManager.logger as AnyObject))
  }

  func testWarningSinkUsesRegistryLoggerForKnownHandle() async {
    let handleLogger = LogManager.none
    let loggerId = await CoreRuntime.loggerRegistry.register(
      ConfigTestLoggerHandle(logger: handleLogger)
    )

    let sink = await FidoCallConfig.warningSink(loggerId: loggerId)

    XCTAssertTrue((sink as AnyObject) === (handleLogger as AnyObject))
  }

  func testWarningSinkFallsBackForPaddedKnownHandle() async {
    // A padded id fails the exact-match registry lookup; the sink falls back
    // to the same default as the ceremony logger would for the same input.
    let sink = await FidoCallConfig.warningSink(loggerId: "  unknown-handle  ")

    XCTAssertTrue((sink as AnyObject) === (LogManager.logger as AnyObject))
  }
}

/// Logger handle double resolving to a supplied Ping logger instance,
/// mirroring the `TestLoggerHandle` pattern in `RNPingFidoCommonTests`.
private final class ConfigTestLoggerHandle: LoggerHandleContract, @unchecked Sendable {
  let loggerLevel: String
  let nativeLogger: Any?

  init(logger: Logger) {
    self.loggerLevel = "STANDARD"
    self.nativeLogger = logger
  }
}
