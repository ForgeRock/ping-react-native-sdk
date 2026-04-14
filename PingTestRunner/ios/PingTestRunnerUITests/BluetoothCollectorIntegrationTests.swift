/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// Integration coverage for the real iOS Bluetooth device-profile collector.
///
/// This runs through the PingTestRunner React Native scenario instead of the
/// pod unit-test target so the bridge can execute the native collector on a
/// simulator/runtime environment. CoreBluetooth can take significantly longer
/// than other collectors to resolve on simulators, so this test uses a longer
/// timeout than the rest of the Tier 1 UI suite.
final class BluetoothCollectorIntegrationTests: BaseTestCase {

    /// Upper bound for simulator Bluetooth state resolution.
    private let bluetoothTimeout: TimeInterval = 70

    override func setUp() {
        super.setUp()
        launchApp(scenario: "device-profile")
    }

    /// Verifies the device-profile scenario launches before Bluetooth collection begins.
    func testAppLaunchesInDeviceProfileScenario() {
        assertAppReady()
    }

    /// Verifies the RN bridge can execute the real native Bluetooth collector.
    func testCollectBluetoothProfileReturnsBluetoothPayload() throws {
        elementWithTestID("device-profile-collect-bluetooth-btn").tapWhenReady(timeout: 10)

        let result = textContentOfElement(
            withTestID: "device-profile-result",
            timeout: bluetoothTimeout
        )

        XCTAssertFalse(
            elementWithTestID("device-profile-error").exists,
            "Expected no device-profile error after Bluetooth collection"
        )

        guard let data = result.data(using: .utf8) else {
            XCTFail("Expected UTF-8 JSON device-profile result")
            return
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let bluetooth = json?["bluetooth"] as? [String: Any]

        XCTAssertNotNil(json, "Expected device-profile JSON object in result payload")
        XCTAssertNotNil(bluetooth, "Expected bluetooth collector payload in device profile")
        XCTAssertNotNil(
            bluetooth?["supported"] as? Bool,
            "Expected bluetooth payload to include boolean 'supported'"
        )
    }
}
