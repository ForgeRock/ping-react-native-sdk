/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import AuthenticationServices
import XCTest
@testable import RNPingFido

/// Unit tests for the rejection extras built from a DaVinci FIDO collector's
/// recorded client error code, and for the underlying-error merge that
/// carries the extras to JS through `PromiseBridge.reject`.
final class FidoClientErrorMapperTests: XCTestCase {

  // MARK: - Extras

  /// Ensures each canonical WebAuthn DOMException name is forwarded as the
  /// clientError extra without triggering the warning path.
  func testExtrasForEachKnownName() {
    for name in [
      "NotAllowedError", "TimeoutError", "NotSupportedError", "InvalidStateError", "UnknownError",
    ] {
      var warnings: [String] = []

      let extras = FidoClientErrorMapper.extras(errorCode: name) { warnings.append($0) }

      XCTAssertEqual(extras, [FidoClientErrorMapper.extraKey: name])
      XCTAssertTrue(warnings.isEmpty)
    }
  }

  /// Ensures unrecognized DOMException names pass through unchanged: the
  /// mapper is a verbatim pass-through, so names the SDK starts emitting in
  /// the future are not dropped at the bridge.
  func testExtrasPassesThroughUnknownName() {
    var warnings: [String] = []

    let extras = FidoClientErrorMapper.extras(errorCode: "SecurityError") { warnings.append($0) }

    XCTAssertEqual(extras, [FidoClientErrorMapper.extraKey: "SecurityError"])
    XCTAssertTrue(warnings.isEmpty)
  }

  /// Ensures a nil, empty, or whitespace-only error code produces no extras
  /// and emits exactly one warning naming the dropped extra.
  func testExtrasWarnsAndReturnsNilWhenErrorCodeNilOrBlank() {
    for errorCode in [nil as String?, "", "   "] {
      var warnings: [String] = []

      let extras = FidoClientErrorMapper.extras(errorCode: errorCode) { warnings.append($0) }

      XCTAssertNil(extras)
      XCTAssertEqual(warnings.count, 1)
    }
  }

  // MARK: - Underlying error merge

  /// Ensures the merge preserves the original domain, code, and userInfo
  /// while adding the clientError extra.
  func testUnderlyingMergesExtrasAndPreservesDomainCodeAndUserInfo() {
    let original = NSError(domain: "TestDomain", code: 42, userInfo: ["existing": "value"])

    let merged = FidoClientErrorMapper.underlying(
      original,
      extras: [FidoClientErrorMapper.extraKey: "TimeoutError"]
    )

    XCTAssertEqual(merged.domain, "TestDomain")
    XCTAssertEqual(merged.code, 42)
    XCTAssertEqual(merged.userInfo["existing"] as? String, "value")
    XCTAssertEqual(merged.userInfo[FidoClientErrorMapper.extraKey] as? String, "TimeoutError")
  }

  /// Ensures nil or empty extras leave the error unchanged instead of
  /// rebuilding it with an empty userInfo merge.
  func testUnderlyingWithoutExtrasLeavesErrorUnchanged() {
    let original = NSError(domain: "TestDomain", code: 42, userInfo: ["existing": "value"])

    for merged in [
      FidoClientErrorMapper.underlying(original, extras: nil),
      FidoClientErrorMapper.underlying(original, extras: [:]),
    ] {
      XCTAssertEqual(merged.domain, "TestDomain")
      XCTAssertEqual(merged.code, 42)
      XCTAssertEqual(merged.userInfo["existing"] as? String, "value")
      XCTAssertNil(merged.userInfo[FidoClientErrorMapper.extraKey])
    }
  }

  /// Ensures the production input shape keeps its authorization identity:
  /// DaVinci rejections carry the bridged ASAuthorization error's domain and
  /// code, with the extras riding inside its userInfo.
  func testUnderlyingPreservesAuthorizationErrorIdentity() {
    let canceled = ASAuthorizationError(.canceled)

    let merged = FidoClientErrorMapper.underlying(
      canceled,
      extras: [FidoClientErrorMapper.extraKey: "NotAllowedError"]
    )

    XCTAssertEqual(merged.domain, ASAuthorizationError.errorDomain)
    XCTAssertEqual(merged.code, ASAuthorizationError.canceled.rawValue)
    XCTAssertEqual(merged.userInfo[FidoClientErrorMapper.extraKey] as? String, "NotAllowedError")
  }
}
