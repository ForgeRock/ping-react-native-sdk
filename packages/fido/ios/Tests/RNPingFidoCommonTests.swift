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
    XCTAssertEqual(map?["trigger"] as? String, "BUTTON")

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
    XCTAssertEqual(map?["trigger"] as? String, "")

    let options = try? XCTUnwrap(map?["publicKeyCredentialRequestOptions"] as? NSDictionary)
    XCTAssertEqual(options?["rpId"] as? String, "example.com")
    // transform() emits standard base64: bytes [1, 2] encode to "AQI=".
    XCTAssertEqual(options?["challenge"] as? String, "AQI=")
  }

  func testDaVinciSerializerPassesThroughNonButtonTrigger() {
    RNPingFidoCommon.registerDaVinciSerializer()

    var json = makeRegistrationJson()
    json["trigger"] = "PAGE_LOAD"
    let payload = CoreRuntime.serializeDaVinciCollector(FidoRegistrationCollector(with: json))

    let map = try? XCTUnwrap(payload)
    XCTAssertEqual(map?["trigger"] as? String, "PAGE_LOAD")
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

  // MARK: - Authentication Cancel Classification Tests

  func testCancelClassificationMatchesRawASAuthorizationCancellation() {
    let error = ASAuthorizationError(.canceled)

    XCTAssertTrue(RNPingFidoCommon.isRecoverableFidoAuthenticationFailure(error))
  }

  /// DaVinci collectors transform `ASAuthorizationError.canceled` into
  /// `FidoError.unsupportedAction(ERROR_NOT_ALLOWED_MESSAGE)` via the SDK's
  /// `handleError`; the classifier must treat that shape as cancellation too.
  func testCancelClassificationMatchesDaVinciTransformedUnsupportedAction() {
    let error = FidoError.unsupportedAction(FidoConstants.ERROR_NOT_ALLOWED_MESSAGE)

    XCTAssertTrue(RNPingFidoCommon.isRecoverableFidoAuthenticationFailure(error))
  }

  func testCancelClassificationRejectsNonCancelUnsupportedAction() {
    let error = FidoError.unsupportedAction("Operation not supported")

    XCTAssertFalse(RNPingFidoCommon.isRecoverableFidoAuthenticationFailure(error))
  }

  func testCancelClassificationRejectsOtherFidoErrors() {
    XCTAssertFalse(RNPingFidoCommon.isRecoverableFidoAuthenticationFailure(FidoError.invalidChallenge))
    XCTAssertFalse(RNPingFidoCommon.isRecoverableFidoAuthenticationFailure(FidoError.timeout))
  }

  func testCancelClassificationRejectsOtherASAuthorizationErrors() {
    XCTAssertFalse(RNPingFidoCommon.isRecoverableFidoAuthenticationFailure(ASAuthorizationError(.unknown)))
  }

  // MARK: - Registration Option Warning Tests

  /// The registration ceremonies have no credential-preference parameter, so a
  /// supplied value must be reported through the fallback logger sink before
  /// the call proceeds; each register scope must surface it.
  func testRegisterWarnsWhenPreferImmediatelyAvailableCredentialsSupplied() async {
    let capture = CaptureLogger()
    let previous = LogManager.logger
    LogManager.logger = capture
    defer { LogManager.logger = previous }

    _ = await invokeRegister(
      options: [:],
      config: ["preferImmediatelyAvailableCredentials": true]
    )

    XCTAssertEqual(capture.warningMessages.count, 1)
    XCTAssertTrue(capture.warningMessages[0].contains("preferImmediatelyAvailableCredentials"))
  }

  func testRegisterForJourneyWarnsWhenPreferImmediatelyAvailableCredentialsSupplied() async {
    let capture = CaptureLogger()
    let previous = LogManager.logger
    LogManager.logger = capture
    defer { LogManager.logger = previous }

    _ = await invokeRegisterForJourney(
      journeyId: "journey-1",
      options: [:],
      config: ["preferImmediatelyAvailableCredentials": true]
    )

    XCTAssertEqual(capture.warningMessages.count, 1)
    XCTAssertTrue(capture.warningMessages[0].contains("preferImmediatelyAvailableCredentials"))
  }

  func testRegisterForDaVinciWarnsWhenPreferImmediatelyAvailableCredentialsSupplied() async {
    let capture = CaptureLogger()
    let previous = LogManager.logger
    LogManager.logger = capture
    defer { LogManager.logger = previous }

    _ = await invokeRegisterForDaVinci(
      davinciId: "davinci-1",
      options: [:],
      config: ["preferImmediatelyAvailableCredentials": true]
    )

    XCTAssertEqual(capture.warningMessages.count, 1)
    XCTAssertTrue(capture.warningMessages[0].contains("preferImmediatelyAvailableCredentials"))
  }

  /// An off-platform `android` block is reported on iOS across scopes; the
  /// authentication path must emit it before the ceremony rejects.
  func testAuthenticateWarnsWhenAndroidConfigSupplied() async {
    let capture = CaptureLogger()
    let previous = LogManager.logger
    LogManager.logger = capture
    defer { LogManager.logger = previous }

    _ = await invokeAuthenticate(
      options: [:],
      config: ["android": ["useFido2ApiClient": true]]
    )

    XCTAssertEqual(capture.warningMessages.count, 1)
    XCTAssertTrue(capture.warningMessages[0].contains("android"))
  }

  // MARK: - PIA Forwarding Tests

  /// Installs a stub window anchor so the window guard is satisfied in the
  /// no-host-app test harness and returns the production resolver it replaced.
  private func installStubWindowAnchor() -> () -> ASPresentationAnchor? {
    let previous = RNPingFidoCommon.windowAnchorResolver
    RNPingFidoCommon.windowAnchorResolver = { ASPresentationAnchor() }
    return previous
  }

  /// Restores the supplied production window resolver on scope exit.
  private func restoreWindowAnchor(_ previous: @escaping () -> ASPresentationAnchor?) {
    RNPingFidoCommon.windowAnchorResolver = previous
  }

  /// Standalone authenticate forwards the parsed credential preference to the
  /// native invoker.
  func testStandaloneAuthenticateForwardsPreferImmediatelyAvailableCredentials() async {
    let previousAnchor = installStubWindowAnchor()
    defer { restoreWindowAnchor(previousAnchor) }
    var receivedFlag: Bool?
    let previousInvoker = RNPingFidoCommon.nativeAuthenticateInvoker
    RNPingFidoCommon.nativeAuthenticateInvoker = { _, _, flag, _, completion in
      receivedFlag = flag
      completion(.failure(ASAuthorizationError(.canceled)))
    }
    defer { RNPingFidoCommon.nativeAuthenticateInvoker = previousInvoker }

    _ = await invokeAuthenticate(
      options: [:],
      config: ["preferImmediatelyAvailableCredentials": true]
    )

    XCTAssertEqual(receivedFlag, true)
  }

  func testStandaloneAuthenticateForwardsFalsePreference() async {
    let previousAnchor = installStubWindowAnchor()
    defer { restoreWindowAnchor(previousAnchor) }
    var receivedFlag: Bool?
    let previous = RNPingFidoCommon.nativeAuthenticateInvoker
    RNPingFidoCommon.nativeAuthenticateInvoker = { _, _, flag, _, completion in
      receivedFlag = flag
      completion(.failure(ASAuthorizationError(.canceled)))
    }
    defer { RNPingFidoCommon.nativeAuthenticateInvoker = previous }

    _ = await invokeAuthenticate(
      options: [:],
      config: ["preferImmediatelyAvailableCredentials": false]
    )

    XCTAssertEqual(receivedFlag, false)
  }

  func testStandaloneAuthenticateDefaultsToFalseWhenPreferenceAbsent() async {
    let previousAnchor = installStubWindowAnchor()
    defer { restoreWindowAnchor(previousAnchor) }
    var receivedFlag: Bool?
    let previous = RNPingFidoCommon.nativeAuthenticateInvoker
    RNPingFidoCommon.nativeAuthenticateInvoker = { _, _, flag, _, completion in
      receivedFlag = flag
      completion(.failure(ASAuthorizationError(.canceled)))
    }
    defer { RNPingFidoCommon.nativeAuthenticateInvoker = previous }

    _ = await invokeAuthenticate(options: [:])

    XCTAssertEqual(receivedFlag, false)
  }

  /// A user cancellation through the real standalone authenticate entry point
  /// rejects with the stable method error code; only Journey and DaVinci
  /// authentication carry a cancellation outcome.
  func testStandaloneAuthenticateRejectsWithAuthenticateErrorWhenUserCancels() async {
    let previousAnchor = installStubWindowAnchor()
    defer { restoreWindowAnchor(previousAnchor) }
    let previous = RNPingFidoCommon.nativeAuthenticateInvoker
    RNPingFidoCommon.nativeAuthenticateInvoker = { _, _, _, _, completion in
      completion(.failure(ASAuthorizationError(.canceled)))
    }
    defer { RNPingFidoCommon.nativeAuthenticateInvoker = previous }

    let (code, _) = await invokeAuthenticate(
      options: [:],
      config: ["preferImmediatelyAvailableCredentials": true]
    )

    XCTAssertEqual(code, "FIDO_AUTHENTICATE_ERROR")
  }

  /// Registration has no cancellation outcome: user cancellation stays
  /// `FIDO_REGISTER_ERROR` through the real standalone register entry point.
  func testStandaloneRegisterRejectsWithRegisterErrorWhenUserCancels() async {
    let previousAnchor = installStubWindowAnchor()
    defer { restoreWindowAnchor(previousAnchor) }
    var invokerCalled = false
    let previous = RNPingFidoCommon.nativeRegisterInvoker
    RNPingFidoCommon.nativeRegisterInvoker = { _, _, _, completion in
      invokerCalled = true
      completion(.failure(ASAuthorizationError(.canceled)))
    }
    defer { RNPingFidoCommon.nativeRegisterInvoker = previous }

    let (code, _) = await invokeRegister(options: [:])

    XCTAssertTrue(invokerCalled)
    XCTAssertEqual(code, "FIDO_REGISTER_ERROR")
    XCTAssertNotEqual(code, "FIDO_AUTHENTICATE_CANCELLED")
  }

  /// Journey authenticate forwards the parsed credential preference to the
  /// native callback through the invoker seam.
  func testJourneyAuthenticateForwardsPreferImmediatelyAvailableCredentials() async {
    let previousAnchor = installStubWindowAnchor()
    defer { restoreWindowAnchor(previousAnchor) }
    CoreRuntime.setJourneyCallbackResolver { _ in [FidoAuthenticationCallback()] }
    defer { CoreRuntime.setJourneyCallbackResolver(nil) }
    var receivedFlag: Bool?
    let previous = RNPingFidoCommon.journeyAuthenticateInvoker
    RNPingFidoCommon.journeyAuthenticateInvoker = { _, _, flag in
      receivedFlag = flag
      return .failure(ASAuthorizationError(.canceled))
    }
    defer { RNPingFidoCommon.journeyAuthenticateInvoker = previous }

    _ = await invokeAuthenticateForJourney(
      journeyId: "journey-1",
      options: [:],
      config: ["preferImmediatelyAvailableCredentials": true]
    )

    XCTAssertEqual(receivedFlag, true)
  }

  /// DaVinci authenticate forwards the parsed credential preference to the
  /// native collector through the invoker seam.
  func testDaVinciAuthenticateForwardsPreferImmediatelyAvailableCredentials() async {
    let previousAnchor = installStubWindowAnchor()
    defer { restoreWindowAnchor(previousAnchor) }
    let collector = FidoAuthenticationCollector(with: makeAuthenticationJson())
    CoreRuntime.setDaVinciCollectorResolver { _ in [collector] }
    defer { CoreRuntime.setDaVinciCollectorResolver(nil) }
    var receivedFlag: Bool?
    let previous = RNPingFidoCommon.davinciAuthenticateInvoker
    RNPingFidoCommon.davinciAuthenticateInvoker = { _, _, flag in
      receivedFlag = flag
      return .failure(ASAuthorizationError(.canceled))
    }
    defer { RNPingFidoCommon.davinciAuthenticateInvoker = previous }

    _ = await invokeAuthenticateForDaVinci(
      davinciId: "davinci-1",
      options: [:],
      config: ["preferImmediatelyAvailableCredentials": true]
    )

    XCTAssertEqual(receivedFlag, true)
  }

  // MARK: - Helpers

  private func invokeRegister(
    options: NSDictionary,
    config: NSDictionary = [:]
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingFidoCommon.register(options, config: config) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  private func invokeAuthenticate(
    options: NSDictionary,
    config: NSDictionary = [:]
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingFidoCommon.authenticate(options, config: config) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  private func invokeRegisterForJourney(
    journeyId: String,
    options: NSDictionary,
    config: NSDictionary = [:]
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingFidoCommon.registerForJourney(journeyId, options: options, config: config) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  private func invokeAuthenticateForJourney(
    journeyId: String,
    options: NSDictionary,
    config: NSDictionary = [:]
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingFidoCommon.authenticateForJourney(journeyId, options: options, config: config) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  private func invokeRegisterForDaVinci(
    davinciId: String,
    options: NSDictionary,
    config: NSDictionary = [:]
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingFidoCommon.registerForDaVinci(davinciId, options: options, config: config) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  private func invokeAuthenticateForDaVinci(
    davinciId: String,
    options: NSDictionary,
    config: NSDictionary = [:]
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      RNPingFidoCommon.authenticateForDaVinci(davinciId, options: options, config: config) { _ in
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
      "trigger": "BUTTON",
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

/// Log sink double capturing warning messages emitted by config parsing.
private final class CaptureLogger: Logger, @unchecked Sendable {
  private let lock = NSLock()
  private var capturedWarnings: [String] = []

  var warningMessages: [String] {
    lock.lock()
    defer { lock.unlock() }
    return capturedWarnings
  }

  func d(_ message: String) {}
  func i(_ message: String) {}
  func w(_ message: String, error: Error?) {
    lock.lock()
    defer { lock.unlock() }
    capturedWarnings.append(message)
  }
  func e(_ message: String, error: Error?) {}
}
