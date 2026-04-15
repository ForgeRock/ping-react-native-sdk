/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest OIDC failure path (Tier 1 — no server required).
///
/// Runs OIDC in deterministic failure mode to validate that an authorize
/// failure surfaces the in-app error UI without relying on external
/// browser automation. No live server is required.
final class OidcFailurePathUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        launchApp(scenario: "oidc", extras: ["PING_OIDC_TEST_MODE": "true"])
    }

    func testAppLaunchesInOidcScenario() {
        assertAppReady()
    }

    func testShowsErrorUIWhenFailureIsForcedInTestMode() {
        elementWithTestID("oidc-force-failure-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("oidc-error-message").waitForExistence(timeout: 10),
            "Expected oidc-error-message after forced failure in test mode"
        )
    }
}
