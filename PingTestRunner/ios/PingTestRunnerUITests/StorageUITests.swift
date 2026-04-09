/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest for storage scenarios (Tier 1 — no server required).
///
/// Flow:
///   createsStorageWithValidConfig → session + OIDC handle creation succeeds
///   invalid config path           → throws OR falls back to native defaults
final class StorageUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        launchApp(scenario: "storage")
    }

    func testAppLaunchesInStorageScenario() {
        assertAppReady()
    }

    func testConfigureSessionStorageReturnsSessionHandle() {
        elementWithTestID("storage-session-btn").tapWhenReady()
        let result = textContentOfElement(withTestID: "storage-session-result", timeout: 10)
        XCTAssertTrue(
            result.hasPrefix("session:"),
            "Expected session handle to start with 'session:', got '\(result)'"
        )
    }

    func testConfigureOidcStorageReturnsOidcHandle() {
        elementWithTestID("storage-oidc-btn").tapWhenReady()
        let result = textContentOfElement(withTestID: "storage-oidc-result", timeout: 10)
        XCTAssertTrue(
            result.hasPrefix("oidc:"),
            "Expected OIDC handle to start with 'oidc:', got '\(result)'"
        )
    }

    func testConfigureSessionStorageWithEmptyConfigThrowsOrFallsBackToDefaults() {
        elementWithTestID("storage-invalid-btn").tapWhenReady()
        let status = textContentOfElement(withTestID: "storage-invalid-status", timeout: 10)
        if status == "error" {
            // Native bridge threw — error UI must be shown
            XCTAssertTrue(
                elementWithTestID("storage-error").waitForExistence(timeout: 5),
                "Expected 'storage-error' element when status is 'error'"
            )
            return
        }

        // Reject any unexpected intermediate state (e.g. "pending", "") so the test
        // does not silently pass on an unrecognised status value.
        XCTAssertEqual(
            status, "success",
            "Unexpected status '\(status)': expected 'error' (bridge threw) or 'success' (native defaults)"
        )

        // Fell back to defaults — result should still be a session handle
        let result = textContentOfElement(withTestID: "storage-invalid-result", timeout: 5)
        XCTAssertTrue(
            result.hasPrefix("session:"),
            "Expected fallback session handle to start with 'session:', got '\(result)'"
        )
    }
}
