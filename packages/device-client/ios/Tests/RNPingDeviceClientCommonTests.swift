/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import React
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

  func testNormalizeServerUrlReturnsEmptyInputUnchanged() {
    XCTAssertEqual(DeviceClientConfigNormalizer.normalizeServerUrl(""), "")
  }

  func testNormalizeServerUrlNormalizesWhitespaceOnlyInputToEmptyString() {
    XCTAssertEqual(DeviceClientConfigNormalizer.normalizeServerUrl("   "), "")
  }

  func testNormalizeServerUrlNormalizesSlashOnlyInputToEmptyString() {
    XCTAssertEqual(DeviceClientConfigNormalizer.normalizeServerUrl(" / "), "")
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

  // MARK: - invalid device type rejection

  func testGetRejectsInvalidDeviceType() {
    let handleId = createClientHandle()
    let rejected = expectation(description: "get rejects invalid device type")
    RNPingDeviceClientCommon.get(
      handleId,
      deviceType: "fingerprint",
      resolver: { _ in
        XCTFail("Expected rejection for unsupported device type")
      },
      rejecter: { _, _, _ in
        rejected.fulfill()
      }
    )
    wait(for: [rejected], timeout: 2.0)
    disposeClientHandle(handleId)
  }

  func testUpdateRejectsInvalidDeviceType() {
    let handleId = createClientHandle()
    let rejected = expectation(description: "update rejects invalid device type")
    let device: NSDictionary = ["id": "id-1", "deviceName": "name-1"]
    RNPingDeviceClientCommon.update(
      handleId,
      deviceType: "fingerprint",
      device: device,
      resolver: { _ in
        XCTFail("Expected rejection for unsupported device type")
      },
      rejecter: { _, _, _ in
        rejected.fulfill()
      }
    )
    wait(for: [rejected], timeout: 2.0)
    disposeClientHandle(handleId)
  }

  func testDeleteRejectsInvalidDeviceType() {
    let handleId = createClientHandle()
    let rejected = expectation(description: "delete rejects invalid device type")
    let device: NSDictionary = ["id": "id-1", "deviceName": "name-1"]
    RNPingDeviceClientCommon.deleteDevice(
      handleId,
      deviceType: "fingerprint",
      device: device,
      resolver: { _ in
        XCTFail("Expected rejection for unsupported device type")
      },
      rejecter: { _, _, _ in
        rejected.fulfill()
      }
    )
    wait(for: [rejected], timeout: 2.0)
    disposeClientHandle(handleId)
  }

  // MARK: - helpers

  private func createClientHandle() -> String {
    let resolved = expectation(description: "create resolves handle")
    var handleId: String?
    let config: NSDictionary = [
      "serverUrl": "https://example.com/am",
      "realm": "root",
      "ssoToken": "token",
      "cookieName": "cookie",
    ]
    RNPingDeviceClientCommon.create(
      config,
      resolver: { value in
        handleId = value as? String
        resolved.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("create should resolve with valid config")
        resolved.fulfill()
      }
    )
    wait(for: [resolved], timeout: 2.0)
    XCTAssertNotNil(handleId)
    return handleId ?? ""
  }

  private func disposeClientHandle(_ handleId: String) {
    let disposed = expectation(description: "dispose resolves")
    RNPingDeviceClientCommon.dispose(
      handleId,
      resolver: { _ in disposed.fulfill() },
      rejecter: { _, _, _ in
        XCTFail("dispose should not reject")
        disposed.fulfill()
      }
    )
    wait(for: [disposed], timeout: 2.0)
  }
}
