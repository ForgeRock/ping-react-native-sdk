/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// Integration coverage for the real iOS location device-profile collector.
///
/// This runs through the PingTestRunner React Native scenario so the bridge
/// executes the native collector with runtime permission behavior. The test
/// accepts either a location payload or an error because simulator permission
/// state varies across CI environments, but it still fails if the `location`
/// collector is silently ignored.
final class LocationCollectorIntegrationTests: BaseTestCase {

    /// Upper bound for simulator location permission and collector resolution.
    private let locationTimeout: TimeInterval = 30

    override func setUp() {
        super.setUp()
        launchApp(scenario: "device-profile")
    }

    /// Verifies the RN bridge executes the real native location collector.
    func testCollectLocationProfileReturnsLocationPayloadOrError() throws {
        addLocationPermissionInterruptionMonitor()

        elementWithTestID("device-profile-collect-location-btn").tapWhenReady(timeout: 10)

        // Triggers any pending permission interruption monitor after the button tap.
        app.tap()

        let resultElement = elementWithTestID("device-profile-result")
        let errorElement = elementWithTestID("device-profile-error")

        let waiter = XCTWaiter()
        let resultExpectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == true"),
            object: resultElement
        )
        let errorExpectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == true"),
            object: errorElement
        )

        let waitResult = waiter.wait(
            for: [resultExpectation, errorExpectation],
            timeout: locationTimeout
        )

        XCTAssertNotEqual(
            waitResult,
            .timedOut,
            "Expected either a location result or location error within \(locationTimeout)s"
        )

        if errorElement.exists {
            let errorMessage = textContentOfElement(
                withTestID: "device-profile-error",
                timeout: 1
            )
            XCTAssertFalse(
                errorMessage.isEmpty,
                "Expected location collection failure to surface a non-empty error"
            )
            return
        }

        let result = textContentOfElement(
            withTestID: "device-profile-result",
            timeout: 1
        )

        guard let data = result.data(using: .utf8) else {
            XCTFail("Expected UTF-8 JSON device-profile result")
            return
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let location = json?["location"] as? [String: Any]

        XCTAssertNotNil(json, "Expected device-profile JSON object in result payload")
        XCTAssertEqual(json?.count, 1, "Expected only the requested location collector in the payload")
        XCTAssertNotNil(location, "Expected location collector payload in device profile")
    }

    /// Dismisses the first matching system location prompt when iOS asks for permission.
    private func addLocationPermissionInterruptionMonitor() {
        addUIInterruptionMonitor(withDescription: "Location Permission") { alert in
            let preferredButtons = [
                "Allow Once",
                "Allow While Using App",
                "OK",
            ]

            for title in preferredButtons {
                let button = alert.buttons[title]
                if button.exists {
                    button.tap()
                    return true
                }
            }

            return false
        }
    }
}
