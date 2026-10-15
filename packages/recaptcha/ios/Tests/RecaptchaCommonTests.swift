/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingLogger
import PingReCaptchaEnterprise
import React
import RNPingCore
@testable import RNPingRecaptcha

/// Unit tests for `RNPingRecaptchaCommon` option parsing and error mapping.
final class RecaptchaCommonTests: XCTestCase {

  // MARK: - Option Parsing Defaults

  func testParseVerifyOptionsDefaultsWhenEmpty() {
    let options = RNPingRecaptchaCommon.parseVerifyOptions([:])

    XCTAssertEqual(options.index, 0)
    XCTAssertEqual(options.action, "login")
    XCTAssertEqual(options.timeoutMs, 15000)
    XCTAssertNil(options.payload)
  }

  /// Blank/whitespace action falls back to the upstream default.
  func testParseVerifyOptionsDefaultsWhenActionBlank() {
    let options = RNPingRecaptchaCommon.parseVerifyOptions(["action": "   "])

    XCTAssertEqual(options.action, "login")
  }

  /// Explicit values pass through, including the payload dictionary.
  func testParseVerifyOptionsExplicitValues() {
    let options = RNPingRecaptchaCommon.parseVerifyOptions([
      "index": 2,
      "action": "signup",
      "timeoutMs": 30000,
      "payload": ["risk": "low"],
    ])

    XCTAssertEqual(options.index, 2)
    XCTAssertEqual(options.action, "signup")
    XCTAssertEqual(options.timeoutMs, 30000)
    let payload = try? XCTUnwrap(options.payload as? [String: String])
    XCTAssertEqual(payload?["risk"], "low")
  }

  /// Index accepts the NSNumber and string forms the bridge may deliver.
  func testParseVerifyOptionsIndexStringAndNumberForms() {
    let numeric = RNPingRecaptchaCommon.parseVerifyOptions(["index": NSNumber(value: 3)])
    let string = RNPingRecaptchaCommon.parseVerifyOptions(["index": "1"])

    XCTAssertEqual(numeric.index, 3, "NSNumber form maps to intValue")
    XCTAssertEqual(string.index, 1)
  }

  /// Timeout accepts the string form and falls back to the default when
  /// unparseable.
  func testParseVerifyOptionsTimeoutStringFormAndFallback() {
    let string = RNPingRecaptchaCommon.parseVerifyOptions(["timeoutMs": "25000"])
    let invalid = RNPingRecaptchaCommon.parseVerifyOptions(["timeoutMs": "not-a-number"])

    XCTAssertEqual(string.timeoutMs, 25000)
    XCTAssertEqual(invalid.timeoutMs, 15000)
  }

  // MARK: - Failure Code Mapping

  /// Untyped errors (Google's `RecaptchaEnterprise` types are internal-imported
  /// upstream) map to the shared `UNKNOWN_ERROR` fallback.
  func testFailureCodeFallsBackToUnknownError() {
    let code = RNPingRecaptchaCommon.failureCode(
      NSError(domain: "com.google.recaptcha", code: 7, userInfo: [NSLocalizedDescriptionKey: "network down"])
    )

    XCTAssertEqual(code, "UNKNOWN_ERROR")
  }

  /// The upstream invalid-token sentinel surfaces as a stable code.
  func testFailureCodeSurfacesInvalidTokenSentinel() {
    let code = RNPingRecaptchaCommon.failureCode(
      NSError(
        domain: "test",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "INVALID_CAPTCHA_TOKEN rejected by server"]
      )
    )

    XCTAssertEqual(code, "INVALID_CAPTCHA_TOKEN")
  }

  // MARK: - Result Payload Shapes (cross-platform JS contract)

  /// The success payload carries exactly `type` and `token`.
  func testCreateResultPayloadSuccessShape() {
    let payload = RNPingRecaptchaCommon.createResultPayload(type: "success", token: "the-token")

    XCTAssertEqual(payload.count, 2)
    XCTAssertEqual(payload["type"] as? String, "success")
    XCTAssertEqual(payload["token"] as? String, "the-token")
  }

  /// The failure payload carries `type`, `code`, and `message` — and never a
  /// token (the token is a credential-equivalent).
  func testCreateFailureResultPayloadShape() {
    let payload = RNPingRecaptchaCommon.createFailureResultPayload(
      error: NSError(
        domain: "test",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "network down"]
      )
    )

    XCTAssertEqual(payload.count, 3)
    XCTAssertEqual(payload["type"] as? String, "failure")
    XCTAssertEqual(payload["code"] as? String, "UNKNOWN_ERROR")
    XCTAssertEqual(payload["message"] as? String, "network down")
    XCTAssertNil(payload["token"])
  }

  /// An empty native error description falls back to the fixed message,
  /// mirroring Android's `failureMessage` fallback so payloads stay identical.
  func testCreateFailureResultPayloadEmptyMessageFallback() {
    let payload = RNPingRecaptchaCommon.createFailureResultPayload(
      error: EmptyLocalizedError()
    )

    XCTAssertEqual(
      payload["message"] as? String,
      "reCAPTCHA Enterprise verification failed."
    )
  }

  // MARK: - Config Forwarding

  /// Bridge options land on the upstream config verbatim; a nil logger leaves
  /// upstream's default (`LogManager.logger`) untouched.
  func testApplyOptionsForwardsActionTimeoutPayloadAndLogger() {
    let options = RNPingRecaptchaCommon.parseVerifyOptions([
      "action": "signup",
      "timeoutMs": 30000,
      "payload": ["risk": "low"],
    ])
    let config = ReCaptchaEnterpriseConfig()

    RNPingRecaptchaCommon.applyOptions(options, logger: nil, to: config)

    XCTAssertEqual(config.action, "signup")
    XCTAssertEqual(config.timeout, 30000)
    XCTAssertEqual((config.payload as? [String: String])?["risk"], "low")
  }

  /// A resolved logger handle is attached to the config.
  func testApplyOptionsAttachesResolvedLogger() async {
    let options = RNPingRecaptchaCommon.parseVerifyOptions([:])
    let loggerId = await CoreRuntime.loggerRegistry.register(TestLoggerHandle())
    let logger = await RNPingRecaptchaCommon.resolveLoggerFromCore(loggerId)
    let config = ReCaptchaEnterpriseConfig()

    RNPingRecaptchaCommon.applyOptions(options, logger: logger, to: config)

    XCTAssertNotNil(config.logger)
  }

  // MARK: - Logger Forwarding

  func testResolveLoggerFromCoreReturnsLoggerForRegisteredHandle() async {
    let loggerId = await CoreRuntime.loggerRegistry.register(TestLoggerHandle())

    let resolved = await RNPingRecaptchaCommon.resolveLoggerFromCore(loggerId)

    XCTAssertNotNil(resolved)
  }

  func testResolveLoggerFromCoreReturnsNilForUnknownHandle() async {
    let resolved = await RNPingRecaptchaCommon.resolveLoggerFromCore("unknown-logger-handle")

    XCTAssertNil(resolved)
  }

  func testResolveLoggerFromCoreReturnsNilForBlankOrMissingId() async {
    let blankResult = await RNPingRecaptchaCommon.resolveLoggerFromCore("   ")
    let nilResult = await RNPingRecaptchaCommon.resolveLoggerFromCore(nil)

    XCTAssertNil(blankResult)
    XCTAssertNil(nilResult)
  }

  // MARK: - Journey Callback Resolution (deterministic rejection paths)

  /// With no Journey runtime registered in Core, any journey id resolves no
  /// callback, so the bridge must reject with the state-error contract.
  func testVerifyForJourneyRejectsCallbackNotFoundWhenNoRuntimeRegistered() async {
    let rejection = await invokeVerifyForJourney(
      journeyId: "journey-without-runtime",
      options: [:]
    )

    XCTAssertEqual(rejection.code, "RECAPTCHA_CALLBACK_NOT_FOUND")
    XCTAssertTrue(
      rejection.type == "state_error" || rejection.type.isEmpty,
      "type travels in the NSError payload: \(rejection.type)"
    )
    XCTAssertTrue(rejection.message?.contains("journey-without-runtime") == true)
  }

  // MARK: - Argument Validation

  func testVerifyForJourneyRejectsBlankJourneyIdBeforeNativeWork() async {
    let rejection = await invokeVerifyForJourney(
      journeyId: "   ",
      options: [:]
    )

    XCTAssertEqual(rejection.code, "RECAPTCHA_ERROR")
    XCTAssertTrue(rejection.message?.contains("empty") == true)
  }

  // MARK: - Helpers

  /// Rejection triple captured from the bridge method. A struct rather than a
  /// tuple keeps the `withCheckedContinuation` inference surface small — the
  /// tuple form made CI's Swift compiler fail with "Failed to produce
  /// diagnostic for expression".
  private struct VerifyRejection {
    let code: String?
    let message: String?
    let type: String
  }

  /// Invokes the bridge method and captures the rejection, resolving into a
  /// sentinel when the promise unexpectedly resolves (no Journey runtime is
  /// registered in these tests, so resolve paths are unreachable).
  ///
  /// - Note: The rejection capture is split into a non-async helper taking an
  ///   explicit completion so the `withCheckedContinuation` closure stays a
  ///   single trivial call — the inline double-trailing-closure form tripped
  ///   the compiler's "Failed to produce diagnostic for expression" bug.
  private func invokeVerifyForJourney(
    journeyId: String,
    options: NSDictionary
  ) async -> VerifyRejection {
    func perform(callback: @escaping (VerifyRejection) -> Void) {
      func onResolve(_ result: Any?) {
        callback(VerifyRejection(code: "UNEXPECTED_RESOLVE", message: nil, type: ""))
      }
      func onReject(_ code: String?, _ message: String?, _ error: Error?) {
        var type = ""
        if let nsError = error as NSError? {
          type = (nsError.userInfo["type"] as? String) ?? ""
        }
        callback(VerifyRejection(code: code, message: message, type: type))
      }
      RNPingRecaptchaCommon.verifyForJourney(
        journeyId,
        options: options,
        config: [:],
        resolver: onResolve,
        rejecter: onReject
      )
    }

    return await withCheckedContinuation { continuation in
      perform { continuation.resume(returning: $0) }
    }
  }
}

/// Logger handle double resolving to the Ping logger no-op instance, mirroring
/// the `TestLoggerHandle` pattern used by the FIDO test suite.
private final class TestLoggerHandle: LoggerHandleContract, @unchecked Sendable {
  let loggerLevel: String
  let nativeLogger: Any?

  init() {
    self.loggerLevel = "STANDARD"
    self.nativeLogger = LogManager.none
  }
}

/// Error whose `localizedDescription` is the empty string, exercising the
/// failure-message fallback (NSError's default description is never empty).
private struct EmptyLocalizedError: Error, LocalizedError {
  var errorDescription: String? { "" }
}
