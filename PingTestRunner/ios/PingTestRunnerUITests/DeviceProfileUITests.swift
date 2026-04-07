/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest for device-profile scenarios (Tier 1 — no server required).
///
/// Android SDK parity:
///   testDeviceProfileCallbackWithDefaultCollectors → empty collectors returns object
///   testDeviceProfileCallbackWithCustomCollectors  → named collectors returns object
///   with 'platform' and 'hardware' keys
final class DeviceProfileUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        launchApp(scenario: "device-profile")
    }

    func testAppLaunchesInDeviceProfileScenario() {
        assertAppReady()
    }

    func testCollectWithEmptyCollectorsReturnsNonNullObject() {
        elementWithTestID("device-profile-collect-empty-btn").tapWhenReady()
        waitForElementWithTestID("device-profile-result", timeout: 5)

        XCTAssertFalse(
            elementWithTestID("device-profile-error").exists,
            "Expected no error when collecting with empty collectors"
        )

        let profileJson = textContentOfElement(withTestID: "device-profile-result", timeout: 5)
        let data = profileJson.data(using: .utf8)!
        guard let _ = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            XCTFail("Expected a JSON object from device profile, got '\(profileJson)'")
            return
        }
    }

    func testCollectWithNamedCollectorsReturnsPlatformAndHardwareKeys() {
        elementWithTestID("device-profile-collect-named-btn").tapWhenReady()
        waitForElementWithTestID("device-profile-result", timeout: 5)

        XCTAssertFalse(
            elementWithTestID("device-profile-error").exists,
            "Expected no error when collecting with named collectors"
        )

        let profileJson = textContentOfElement(withTestID: "device-profile-result", timeout: 5)
        let data = profileJson.data(using: .utf8)!
        guard let profile = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            XCTFail("Expected JSON object from device profile, got '\(profileJson)'")
            return
        }
        XCTAssertNotNil(profile["platform"], "Expected 'platform' key in device profile")
        XCTAssertNotNil(profile["hardware"], "Expected 'hardware' key in device profile")
    }
}
