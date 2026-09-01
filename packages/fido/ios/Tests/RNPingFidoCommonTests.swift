/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingFido
import PingLogger
import RNPingCore
@testable import RNPingFido

@MainActor
final class RNPingFidoCommonTests: XCTestCase {

  // MARK: - DaVinci Serializer Tests

  func testDaVinciSerializerReturnsRegistrationPayload() {
    RNPingFidoCommon.registerDaVinciSerializer()

    let payload = CoreRuntime.serializeDaVinciCollector(
      FidoRegistrationCollector(with: makeRegistrationJson())
    )

    let map = try? XCTUnwrap(payload)
    XCTAssertEqual(map?["key"] as? String, "fido-register-key")
    XCTAssertEqual(map?["type"] as? String, "FIDO2")
    XCTAssertEqual(map?["action"] as? String, "REGISTER")
    XCTAssertEqual(map?["label"] as? String, "Set up passkeys")
    XCTAssertEqual(map?["required"] as? Bool, true)
    // P1 parity: `trigger` exists only on Android's base collector; iOS omits it.
    XCTAssertNil(map?["trigger"])

    let options = try? XCTUnwrap(map?["publicKeyCredentialCreationOptions"] as? NSDictionary)
    XCTAssertEqual((options?["rp"] as? NSDictionary)?["id"] as? String, "example.com")
    // transform() emits standard base64: bytes [72, 101] encode to "SGU=".
    XCTAssertEqual(options?["challenge"] as? String, "SGU=")
  }

  func testDaVinciSerializerReturnsAuthenticationPayload() {
    RNPingFidoCommon.registerDaVinciSerializer()

    let payload = CoreRuntime.serializeDaVinciCollector(
      FidoAuthenticationCollector(with: makeAuthenticationJson())
    )

    let map = try? XCTUnwrap(payload)
    XCTAssertEqual(map?["key"] as? String, "fido-auth-key")
    XCTAssertEqual(map?["type"] as? String, "FIDO2")
    XCTAssertEqual(map?["action"] as? String, "AUTHENTICATE")
    XCTAssertEqual(map?["label"] as? String, "Sign in with passkey")
    XCTAssertEqual(map?["required"] as? Bool, false)
    XCTAssertNil(map?["trigger"])

    let options = try? XCTUnwrap(map?["publicKeyCredentialRequestOptions"] as? NSDictionary)
    XCTAssertEqual(options?["rpId"] as? String, "example.com")
    // transform() emits standard base64: bytes [1, 2] encode to "AQI=".
    XCTAssertEqual(options?["challenge"] as? String, "AQI=")
  }

  func testDaVinciSerializerOmitsTriggerOnIos() {
    RNPingFidoCommon.registerDaVinciSerializer()

    let payload = CoreRuntime.serializeDaVinciCollector(
      FidoRegistrationCollector(with: makeRegistrationJson())
    )

    let map = try? XCTUnwrap(payload)
    XCTAssertFalse(map?.keys.contains("trigger") ?? false)
  }

  func testDaVinciSerializerReturnsNilForNonFidoCollector() {
    RNPingFidoCommon.registerDaVinciSerializer()

    XCTAssertNil(
      CoreRuntime.serializeDaVinciCollector("not a collector")
    )
  }

  // MARK: - Register Tests

  func testRegisterRejectsWithWindowUnavailableWhenNoActiveWindow() async {
    let (code, message) = await invokeRegister(options: [:])
    XCTAssertEqual(code, "FIDO_WINDOW_UNAVAILABLE")
    XCTAssertNotNil(message)
    XCTAssertTrue(message?.contains("window") == true)
    XCTAssertTrue(message?.contains("registration") == true)
  }

  func testRegisterRejectsWithWindowUnavailableForNonEmptyOptions() async {
    let options: NSDictionary = [
      "challenge": "dGVzdC1jaGFsbGVuZ2U=",
      "rp": ["id": "example.com", "name": "Example"],
      "user": ["id": "user-id", "name": "user@example.com", "displayName": "User"],
    ]
    let (code, _) = await invokeRegister(options: options)
    XCTAssertEqual(code, "FIDO_WINDOW_UNAVAILABLE")
  }

  // MARK: - Authenticate Tests

  func testAuthenticateRejectsWithWindowUnavailableWhenNoActiveWindow() async {
    let (code, message) = await invokeAuthenticate(options: [:])
    XCTAssertEqual(code, "FIDO_WINDOW_UNAVAILABLE")
    XCTAssertNotNil(message)
    XCTAssertTrue(message?.contains("window") == true)
    XCTAssertTrue(message?.contains("authentication") == true)
  }

  func testAuthenticateRejectsWithWindowUnavailableForNonEmptyOptions() async {
    let options: NSDictionary = [
      "challenge": "dGVzdC1jaGFsbGVuZ2U=",
      "rpId": "example.com",
      "allowCredentials": [],
    ]
    let (code, _) = await invokeAuthenticate(options: options)
    XCTAssertEqual(code, "FIDO_WINDOW_UNAVAILABLE")
  }

  // MARK: - Journey Callback Tests

  func testRegisterForJourneyRejectsWithWindowUnavailableWhenNoActiveWindow() async {
    let (code, _) = await invokeRegisterForJourney(
      journeyId: "journey-missing",
      options: [:]
    )
    XCTAssertEqual(code, "FIDO_WINDOW_UNAVAILABLE")
  }

  func testAuthenticateForJourneyRejectsWithWindowUnavailableWhenNoActiveWindow() async {
    let (code, _) = await invokeAuthenticateForJourney(
      journeyId: "journey-missing",
      options: [:]
    )
    XCTAssertEqual(code, "FIDO_WINDOW_UNAVAILABLE")
  }

  // MARK: - DaVinci Ceremony Tests

  func testRegisterForDaVinciRejectsWithoutWindow() async {
    let (code, message) = await invokeRegisterForDaVinci(
      davinciId: "davinci-missing",
      options: [:]
    )
    XCTAssertEqual(code, "FIDO_WINDOW_UNAVAILABLE")
    XCTAssertTrue(message?.contains("registration") == true)
  }

  func testAuthenticateForDaVinciRejectsWithoutWindow() async {
    let (code, message) = await invokeAuthenticateForDaVinci(
      davinciId: "davinci-missing",
      options: [:]
    )
    XCTAssertEqual(code, "FIDO_WINDOW_UNAVAILABLE")
    XCTAssertTrue(message?.contains("authentication") == true)
  }

  func testRegisterForDaVinciRejectsWithBlankDaVinciId() async {
    let (code, message) = await invokeRegisterForDaVinci(
      davinciId: "  ",
      options: [:]
    )
    XCTAssertEqual(code, "FIDO_COLLECTOR_NOT_FOUND")
    XCTAssertTrue(message?.contains("empty") == true)
  }

  func testAuthenticateForDaVinciRejectsWithBlankDaVinciId() async {
    let (code, message) = await invokeAuthenticateForDaVinci(
      davinciId: "",
      options: [:]
    )
    XCTAssertEqual(code, "FIDO_COLLECTOR_NOT_FOUND")
    XCTAssertTrue(message?.contains("empty") == true)
  }

  // MARK: - Logger Forwarding Tests

  func testResolveLoggerFromCoreReturnsLoggerForRegisteredHandle() async {
    let loggerId = await CoreRuntime.loggerRegistry.register(
      TestLoggerHandle()
    )

    let resolved = await RNPingFidoCommon.resolveLoggerFromCore(loggerId)

    XCTAssertNotNil(resolved)
  }

  func testResolveLoggerFromCoreReturnsNilForUnknownHandle() async {
    let resolved = await RNPingFidoCommon.resolveLoggerFromCore("unknown-logger-handle")

    XCTAssertNil(resolved)
  }

  func testResolveLoggerFromCoreReturnsNilForBlankOrMissingId() async {
    let blankResult = await RNPingFidoCommon.resolveLoggerFromCore("   ")
    let nilResult = await RNPingFidoCommon.resolveLoggerFromCore(nil)

    XCTAssertNil(blankResult)
    XCTAssertNil(nilResult)
  }

  // MARK: - Helpers

  private func invokeRegister(options: NSDictionary) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingFidoCommon.register(options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  private func invokeAuthenticate(options: NSDictionary) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingFidoCommon.authenticate(options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  private func invokeRegisterForJourney(
    journeyId: String,
    options: NSDictionary
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingFidoCommon.registerForJourney(journeyId, options: options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  private func invokeAuthenticateForJourney(
    journeyId: String,
    options: NSDictionary
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingFidoCommon.authenticateForJourney(journeyId, options: options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  private func invokeRegisterForDaVinci(
    davinciId: String,
    options: NSDictionary
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingFidoCommon.registerForDaVinci(davinciId, options: options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  private func invokeAuthenticateForDaVinci(
    davinciId: String,
    options: NSDictionary
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingFidoCommon.authenticateForDaVinci(davinciId, options: options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  // MARK: - Serializer Fixtures

  /// Server-style registration collector JSON with int-array binary fields that
  /// the native `transform()` converts to standard base64.
  private func makeRegistrationJson() -> [String: Any] {
    return [
      "type": "FIDO2",
      "action": "REGISTER",
      "key": "fido-register-key",
      "label": "Set up passkeys",
      "required": true,
      "publicKeyCredentialCreationOptions": [
        "rp": ["id": "example.com", "name": "Example"],
        "challenge": [72, 101]
      ]
    ]
  }

  /// Server-style authentication collector JSON with int-array binary fields that
  /// the native `transform()` converts to standard base64.
  private func makeAuthenticationJson() -> [String: Any] {
    return [
      "type": "FIDO2",
      "action": "AUTHENTICATE",
      "key": "fido-auth-key",
      "label": "Sign in with passkey",
      "required": false,
      "publicKeyCredentialRequestOptions": [
        "rpId": "example.com",
        "challenge": [1, 2]
      ]
    ]
  }
}

/// Logger handle double resolving to the Ping logger no-op instance, mirroring the
/// `TestLoggerHandle` pattern used by the Journey and DaVinci test suites.
private final class TestLoggerHandle: LoggerHandleContract, @unchecked Sendable {
  let loggerLevel: String
  let nativeLogger: Any?

  init() {
    self.loggerLevel = "STANDARD"
    self.nativeLogger = LogManager.none
  }
}
