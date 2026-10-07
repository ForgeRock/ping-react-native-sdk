/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingLogger
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
    let (code, message, type) = await invokeVerifyForJourney(
      journeyId: "journey-without-runtime",
      options: [:]
    )

    XCTAssertEqual(code, "RECAPTCHA_CALLBACK_NOT_FOUND")
    XCTAssertTrue(type == "state_error" || type.isEmpty, "type travels in the NSError payload: \(type)")
    XCTAssertTrue(message?.contains("journey-without-runtime") == true)
  }

  // MARK: - Argument Validation

  func testVerifyForJourneyRejectsBlankJourneyIdBeforeNativeWork() async {
    let (code, message, _) = await invokeVerifyForJourney(
      journeyId: "   ",
      options: [:]
    )

    XCTAssertEqual(code, "RECAPTCHA_ERROR")
    XCTAssertTrue(message?.contains("empty") == true)
  }

  // MARK: - Helpers

  /// Invokes the bridge method and captures the rejection triple, resolving
  /// into a sentinel when the promise unexpectedly resolves (no Journey
  /// runtime is registered in these tests, so resolve paths are unreachable).
  private func invokeVerifyForJourney(
    journeyId: String,
    options: NSDictionary
  ) async -> (String?, String?, String) {
    await withCheckedContinuation { continuation in
      RNPingRecaptchaCommon.verifyForJourney(
        journeyId,
        options: options,
        config: [:]
      ) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil, ""))
      } rejecter: { code, message, error in
        let type = (error?.userInfo["type"] as? String) ?? ""
        continuation.resume(returning: (code, message, type))
      }
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
