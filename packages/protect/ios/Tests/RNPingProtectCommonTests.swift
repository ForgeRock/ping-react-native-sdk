/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import RNPingCore
@testable import RNPingProtect

final class RNPingProtectCommonTests: XCTestCase {

  // MARK: - parseCallConfig

  func testParseCallConfigTrimsLoggerId() {
    let config = RNPingProtectCommon.parseCallConfig(
      ["loggerId": "  logger-123  "]
    )
    XCTAssertEqual(config.loggerId, "logger-123")
  }

  func testParseCallConfigDefaultsMissingLoggerIdToNil() {
    let config = RNPingProtectCommon.parseCallConfig([:])
    XCTAssertNil(config.loggerId)
  }

  func testParseCallConfigReturnsNilLoggerIdWhenBlank() {
    let config = RNPingProtectCommon.parseCallConfig(
      ["loggerId": "   "]
    )
    XCTAssertNil(config.loggerId)
  }

  // MARK: - parseCollectorIndex

  func testParseCollectorIndexFromNSNumber() {
    let result = RNPingProtectCommon.parseCollectorIndex(["index": NSNumber(value: 2)])
    XCTAssertEqual(result, 2)
  }

  func testParseCollectorIndexFromNumericString() {
    let result = RNPingProtectCommon.parseCollectorIndex(["index": "3"])
    XCTAssertEqual(result, 3)
  }

  func testParseCollectorIndexDefaultsToZeroWhenAbsent() {
    let result = RNPingProtectCommon.parseCollectorIndex([:])
    XCTAssertEqual(result, 0)
  }

  func testParseCollectorIndexDefaultsToZeroForInvalidString() {
    let result = RNPingProtectCommon.parseCollectorIndex(["index": "notanumber"])
    XCTAssertEqual(result, 0)
  }

  // MARK: - parseProtectInitConfig

  func testParseProtectInitConfigExtractsEnvId() {
    let config = RNPingProtectCommon.parseProtectInitConfig(["envId": "my-env-id"])
    XCTAssertEqual(config.envId, "my-env-id")
  }

  func testParseProtectInitConfigDefaultsBehavioralDataCollectionToTrue() {
    let config = RNPingProtectCommon.parseProtectInitConfig([:])
    XCTAssertTrue(config.isBehavioralDataCollection)
  }

  func testParseProtectInitConfigDefaultsLazyMetadataToFalse() {
    let config = RNPingProtectCommon.parseProtectInitConfig([:])
    XCTAssertFalse(config.isLazyMetadata)
  }

  func testParseProtectInitConfigExtractsDeviceAttributesToIgnore() {
    let config = RNPingProtectCommon.parseProtectInitConfig(
      ["deviceAttributesToIgnore": ["deviceId", "screen"]]
    )
    XCTAssertEqual(config.deviceAttributesToIgnore, ["deviceId", "screen"])
  }

  func testParseProtectInitConfigReturnsNilEnvIdWhenEmpty() {
    let config = RNPingProtectCommon.parseProtectInitConfig(["envId": ""])
    XCTAssertNil(config.envId)
  }

  // MARK: - pauseBehavioralData / resumeBehavioralData rejection when SDK not initialized

  @MainActor func testPauseBehavioralDataRejectsWhenSDKNotInitialized() {
    let expectation = XCTestExpectation(description: "pauseBehavioralData rejects")
    var rejectedCode: String?

    RNPingProtectCommon.pauseBehavioralData([:], resolver: { _ in
      XCTFail("Expected rejection")
    }, rejecter: { code, _, _ in
      rejectedCode = code
      expectation.fulfill()
    })

    wait(for: [expectation], timeout: 5)
    XCTAssertEqual(rejectedCode, "PROTECT_INITIALIZE_ERROR")
  }

  @MainActor func testResumeBehavioralDataRejectsWhenSDKNotInitialized() {
    let expectation = XCTestExpectation(description: "resumeBehavioralData rejects")
    var rejectedCode: String?

    RNPingProtectCommon.resumeBehavioralData([:], resolver: { _ in
      XCTFail("Expected rejection")
    }, rejecter: { code, _, _ in
      rejectedCode = code
      expectation.fulfill()
    })

    wait(for: [expectation], timeout: 5)
    XCTAssertEqual(rejectedCode, "PROTECT_INITIALIZE_ERROR")
  }
}
