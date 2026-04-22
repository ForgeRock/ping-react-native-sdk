/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingDeviceClient

/// Unit tests for the pure-function helpers split out of
/// ``RNPingDeviceClientCommon``.
///
/// Covers ``DeviceClientConfigNormalizer``. Other behavior (native registry,
/// `DeviceClient` interactions) is covered by integration tests or the
/// native iOS SDK's own tests.
final class RNPingDeviceClientCommonTests: XCTestCase {

  // MARK: - normalizeServerUrl

  func testNormalizeServerUrlStripsSingleTrailingSlash() {
    XCTAssertEqual(
      DeviceClientConfigNormalizer.normalizeServerUrl("https://example.com/am/"),
      "https://example.com/am"
    )
  }

  func testNormalizeServerUrlStripsMultipleTrailingSlashes() {
    XCTAssertEqual(
      DeviceClientConfigNormalizer.normalizeServerUrl("https://example.com/am///"),
      "https://example.com/am"
    )
  }

  func testNormalizeServerUrlTrimsLeadingAndTrailingWhitespace() {
    XCTAssertEqual(
      DeviceClientConfigNormalizer.normalizeServerUrl("  https://example.com/am  "),
      "https://example.com/am"
    )
  }

  func testNormalizeServerUrlReturnsAlreadyCleanUrlUnchanged() {
    XCTAssertEqual(
      DeviceClientConfigNormalizer.normalizeServerUrl("https://example.com/am"),
      "https://example.com/am"
    )
  }

  func testNormalizeServerUrlReturnsBlankInputUnchanged() {
    XCTAssertEqual(DeviceClientConfigNormalizer.normalizeServerUrl(""), "")
  }

  // MARK: - normalizeRealm

  func testNormalizeRealmStripsSingleLeadingSlash() {
    XCTAssertEqual(
      DeviceClientConfigNormalizer.normalizeRealm("/alpha"),
      "alpha"
    )
  }

  func testNormalizeRealmStripsMultipleLeadingSlashes() {
    XCTAssertEqual(
      DeviceClientConfigNormalizer.normalizeRealm("///alpha"),
      "alpha"
    )
  }

  func testNormalizeRealmTrimsWhitespace() {
    XCTAssertEqual(
      DeviceClientConfigNormalizer.normalizeRealm("  alpha  "),
      "alpha"
    )
  }

  func testNormalizeRealmReturnsCleanValueUnchanged() {
    XCTAssertEqual(
      DeviceClientConfigNormalizer.normalizeRealm("alpha"),
      "alpha"
    )
  }

  func testNormalizeRealmDefaultsToRootForNilInput() {
    XCTAssertEqual(
      DeviceClientConfigNormalizer.normalizeRealm(nil),
      DeviceClientConfigNormalizer.defaultRealm
    )
  }

  func testNormalizeRealmDefaultsToRootForBlankInput() {
    XCTAssertEqual(
      DeviceClientConfigNormalizer.normalizeRealm(""),
      DeviceClientConfigNormalizer.defaultRealm
    )
    XCTAssertEqual(
      DeviceClientConfigNormalizer.normalizeRealm("   "),
      DeviceClientConfigNormalizer.defaultRealm
    )
  }

  func testNormalizeRealmDefaultsToRootWhenOnlySlashes() {
    XCTAssertEqual(
      DeviceClientConfigNormalizer.normalizeRealm("///"),
      DeviceClientConfigNormalizer.defaultRealm
    )
  }

  // MARK: - defaultRealm

  func testDefaultRealmIsRoot() {
    XCTAssertEqual(DeviceClientConfigNormalizer.defaultRealm, "root")
  }
}
