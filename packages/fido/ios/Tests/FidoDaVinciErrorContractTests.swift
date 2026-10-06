/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import AuthenticationServices
import XCTest
import PingFido

/// Drift guards over the native FIDO collectors' client-error contract at the
/// pinned SDK commit: the WebAuthn DOMException name `handleError(error:)`
/// records on `errorCode`, the `ActionKeyProvider` surface (event type, action
/// key, empty payload sentinel), and the state reset on `close()`.
///
/// These tests consume the real native collectors, so any upstream change to
/// the error contract surfaces here first instead of silently changing what
/// JS receives as `clientError`. Mirrors the Android
/// `FidoDaVinciErrorContractTest` for cross-platform parity.
final class FidoDaVinciErrorContractTests: XCTestCase {

  private var registrationCollector: FidoRegistrationCollector!
  private var authenticationCollector: FidoAuthenticationCollector!

  override func setUp() {
    super.setUp()
    // The collectors' default logger falls back to LogManager's NoneLogger
    // when no DaVinci instance is attached, so no mocking is needed.
    registrationCollector = FidoRegistrationCollector(with: makeRegistrationJson())
    authenticationCollector = FidoAuthenticationCollector(with: makeAuthenticationJson())
  }

  // MARK: - handleError -> errorCode mapping (FidoError inputs)

  /// Ensures a timeout maps to TimeoutError.
  func testHandleErrorMapsTimeoutToTimeoutError() {
    let transformed = registrationCollector.handleError(error: FidoError.timeout)

    XCTAssertEqual(FidoError.timeout, transformed)
    XCTAssertEqual("TimeoutError", registrationCollector.errorCode)
  }

  /// Ensures the unsupported-action family maps to NotSupportedError.
  func testHandleErrorMapsUnsupportedFamilyToNotSupportedError() {
    let cases: [(FidoError, String)] = [
      (FidoError.unsupportedAction("no"), "unsupportedAction"),
      (FidoError.invalidAction, "invalidAction"),
      (FidoError.missingParameters("none"), "missingParameters"),
    ]
    for (error, label) in cases {
      let collector = FidoAuthenticationCollector(with: makeAuthenticationJson())

      let transformed = collector.handleError(error: error)

      XCTAssertEqual(error, transformed, label)
      XCTAssertEqual("NotSupportedError", collector.errorCode, label)
    }
  }

  /// Ensures invalid response and challenge map to InvalidStateError.
  func testHandleErrorMapsInvalidResponseAndChallengeToInvalidStateError() {
    let challengeCollector = FidoAuthenticationCollector(with: makeAuthenticationJson())

    _ = registrationCollector.handleError(error: FidoError.invalidResponse)
    _ = challengeCollector.handleError(error: FidoError.invalidChallenge)

    XCTAssertEqual("InvalidStateError", registrationCollector.errorCode)
    XCTAssertEqual("InvalidStateError", challengeCollector.errorCode)
  }

  /// Ensures an invalid window maps to the open-set fallback UnknownError.
  func testHandleErrorMapsInvalidWindowToUnknownError() {
    let transformed = registrationCollector.handleError(error: FidoError.invalidWindow)

    XCTAssertEqual(FidoError.invalidWindow, transformed)
    XCTAssertEqual("UnknownError", registrationCollector.errorCode)
  }

  // MARK: - handleError -> errorCode mapping (ASAuthorizationError inputs)

  /// Ensures OS-reported cancellation and generic failure map to
  /// NotAllowedError. The canceled case returns
  /// `FidoError.unsupportedAction(FidoConstants.ERROR_NOT_ALLOWED_MESSAGE)`,
  /// the exact shape `isRecoverableFidoAuthenticationFailure` matches for the
  /// FIDO_AUTHENTICATE_CANCELLED classification.
  func testHandleErrorMapsCanceledAndFailedToNotAllowedError() throws {
    let canceledCollector = FidoAuthenticationCollector(with: makeAuthenticationJson())
    let failedCollector = FidoAuthenticationCollector(with: makeAuthenticationJson())

    let canceled = canceledCollector.handleError(error: ASAuthorizationError(.canceled))
    _ = failedCollector.handleError(error: ASAuthorizationError(.failed))

    XCTAssertEqual(
      FidoError.unsupportedAction(FidoConstants.ERROR_NOT_ALLOWED_MESSAGE),
      canceled
    )
    XCTAssertEqual("NotAllowedError", canceledCollector.errorCode)
    XCTAssertEqual("NotAllowedError", failedCollector.errorCode)
  }

  /// Ensures an invalid OS response maps to InvalidStateError.
  func testHandleErrorMapsASInvalidResponseToInvalidStateError() {
    let transformed = authenticationCollector.handleError(error: ASAuthorizationError(.invalidResponse))

    XCTAssertEqual(FidoError.invalidResponse, transformed)
    XCTAssertEqual("InvalidStateError", authenticationCollector.errorCode)
  }

  /// Ensures a not-handled OS outcome maps to NotSupportedError, including
  /// the transformed unsupported-action shape with the SDK's message.
  func testHandleErrorMapsASNotHandledToNotSupportedError() {
    let transformed = authenticationCollector.handleError(error: ASAuthorizationError(.notHandled))

    XCTAssertEqual(FidoError.unsupportedAction("Operation not supported"), transformed)
    XCTAssertEqual("NotSupportedError", authenticationCollector.errorCode)
  }

  /// Ensures an unknown OS outcome and a foreign-domain error both fall
  /// through to UnknownError.
  func testHandleErrorMapsUnknownAndForeignDomainToUnknownError() {
    let unknownCollector = FidoAuthenticationCollector(with: makeAuthenticationJson())
    let foreignCollector = FidoAuthenticationCollector(with: makeAuthenticationJson())

    _ = unknownCollector.handleError(error: ASAuthorizationError(.unknown))
    _ = foreignCollector.handleError(error: NSError(domain: "SomeOtherDomain", code: -1))

    XCTAssertEqual("UnknownError", unknownCollector.errorCode)
    XCTAssertEqual("UnknownError", foreignCollector.errorCode)
  }

  // MARK: - ActionKeyProvider surface while errorCode is set

  /// Ensures a recorded error code flips the collector's event type to
  /// "action", exposes the code as the action key, and switches payload() to
  /// the non-nil empty-dictionary sentinel that makes the collector win
  /// `Collectors.eventType()`.
  func testErroredCollectorExposesActionKeySurface() throws {
    _ = authenticationCollector.handleError(error: ASAuthorizationError(.canceled))

    XCTAssertEqual("action", authenticationCollector.eventType())
    XCTAssertEqual("NotAllowedError", authenticationCollector.actionKey)
    XCTAssertEqual(authenticationCollector.actionKey, authenticationCollector.errorCode)
    let payload = try XCTUnwrap(authenticationCollector.payload())
    XCTAssertTrue(payload.isEmpty)
  }

  /// Ensures the event type matches the SDK's own constant, so a constant
  /// rename surfaces as a drift failure rather than a silent contract change.
  func testErroredCollectorEventTypeMatchesConstant() {
    _ = authenticationCollector.handleError(error: ASAuthorizationError(.canceled))

    XCTAssertEqual(FidoConstants.EVENT_TYPE_ACTION, authenticationCollector.eventType())
  }

  /// Ensures the empty-dictionary sentinel is payload-visible on the
  /// registration collector too, where a successful ceremony would otherwise
  /// return the attestation envelope.
  func testErroredRegistrationCollectorPayloadIsEmptySentinel() throws {
    _ = registrationCollector.handleError(error: FidoError.timeout)

    let payload = try XCTUnwrap(registrationCollector.payload())
    XCTAssertTrue(payload.isEmpty)
    XCTAssertEqual("action", registrationCollector.eventType())
  }

  // MARK: - State reset

  /// Ensures close() clears the recorded error code on each collector type:
  /// the next submit reports the plain submit surface with no action key and
  /// a nil payload, so a consumed error cannot leak into a later event.
  func testCloseResetsErrorStateOnBothCollectors() {
    _ = registrationCollector.handleError(error: FidoError.timeout)
    _ = authenticationCollector.handleError(error: ASAuthorizationError(.canceled))

    registrationCollector.close()
    authenticationCollector.close()

    XCTAssertNil(registrationCollector.errorCode)
    XCTAssertNil(authenticationCollector.errorCode)
    XCTAssertEqual("submit", registrationCollector.eventType())
    XCTAssertEqual("submit", authenticationCollector.eventType())
    XCTAssertNil(registrationCollector.actionKey)
    XCTAssertNil(authenticationCollector.actionKey)
    XCTAssertNil(registrationCollector.payload())
    XCTAssertNil(authenticationCollector.payload())
  }

  // MARK: - Fixtures

  /// Server-style registration collector JSON matching the serializer test
  /// fixture: int-array binary fields that the native `transform()` converts
  /// to standard base64.
  private func makeRegistrationJson() -> [String: Any] {
    return [
      "type": "FIDO2",
      "action": "REGISTER",
      "key": "fido-register-key",
      "label": "Set up passkeys",
      "required": true,
      "publicKeyCredentialCreationOptions": [
        "rp": ["id": "example.com", "name": "Example"],
        "challenge": [72, 101],
      ],
    ]
  }

  /// Server-style authentication collector JSON in the same shape.
  private func makeAuthenticationJson() -> [String: Any] {
    return [
      "type": "FIDO2",
      "action": "AUTHENTICATE",
      "key": "fido-auth-key",
      "label": "Sign in with passkey",
      "required": false,
      "publicKeyCredentialRequestOptions": [
        "rpId": "example.com",
        "challenge": [1, 2],
      ],
    ]
  }
}
