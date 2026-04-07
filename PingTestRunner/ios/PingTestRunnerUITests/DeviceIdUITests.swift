/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest for device-id scenarios (Tier 1 — no server required).
///
/// Android SDK parity:
///   testIdNotNull     → getDeviceId() returns non-empty string
///   testIdFormat      → 64-char hex string (SHA-256)
///   testIdConsistency → same value on second call
final class DeviceIdUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        launchApp(scenario: "device-id")
    }

    func testAppLaunchesInDeviceIdScenario() {
        assertAppReady()
    }

    func testGetDeviceIdReturnsNonEmptyString() {
        elementWithTestID("device-id-get-btn").tapWhenReady()
        let deviceId = textContentOfElement(withTestID: "device-id-result", timeout: 10)
        XCTAssertFalse(
            deviceId.isEmpty,
            "Expected device ID to be a non-empty string, got an empty string"
        )
    }

    func testDeviceIdIsSHA256Format() {
        elementWithTestID("device-id-get-btn").tapWhenReady()
        let deviceId = textContentOfElement(withTestID: "device-id-result", timeout: 10)
        let sha256Pattern = try! NSRegularExpression(pattern: "^[0-9a-f]{64}$", options: .caseInsensitive)
        let range = NSRange(deviceId.startIndex..., in: deviceId)
        XCTAssertNotNil(
            sha256Pattern.firstMatch(in: deviceId, range: range),
            "Device ID '\(deviceId)' is not a 64-char hex string (SHA-256 format)"
        )
    }

    func testDeviceIdIsConsistentAcrossCalls() {
        elementWithTestID("device-id-get-btn").tapWhenReady()
        let firstId = textContentOfElement(withTestID: "device-id-result", timeout: 10)

        elementWithTestID("device-id-get-again-btn").tapWhenReady()
        let secondId = textContentOfElement(withTestID: "device-id-result-2", timeout: 10)

        XCTAssertEqual(firstId, secondId, "Device ID must be consistent across calls")
    }

    func testNoErrorIsShown() {
        // Wait for the screen to finish rendering before asserting absence of an error,
        // so a late React Native / bridge error cannot slip past an instantaneous check.
        _ = elementWithTestID("device-id-get-btn").waitForExistence(timeout: 10)
        XCTAssertFalse(
            elementWithTestID("device-id-error").exists,
            "Expected no error element to be present"
        )
    }
}
