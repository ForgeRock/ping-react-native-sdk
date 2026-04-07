/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest for OIDC happy path (Tier 1 — no server required).
///
/// Uses PING_OIDC_TEST_MODE so the app handles the OAuth redirect internally
/// without opening an external browser. No live server is required;
/// all tests run unconditionally.
///
/// Flow under test:
///   1. authorize() → oidc-browser-open marker + oidc-token-result visible
///   2. userinfo()  → oidc-userinfo-result visible
///   3. logout()    → oidc-logged-out marker visible
final class OidcHappyPathUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        launchApp(scenario: "oidc", extras: ["PING_OIDC_TEST_MODE": "true"])
    }

    func testAppLaunchesInOidcScenario() {
        assertAppReady()
    }

    func testAuthorizeShowsBrowserOpenMarkerAndTokenResult() {
        elementWithTestID("oidc-authorize-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("oidc-browser-open").waitForExistence(timeout: 10),
            "Expected oidc-browser-open after authorize()"
        )
        XCTAssertTrue(
            elementWithTestID("oidc-token-result").waitForExistence(timeout: 10),
            "Expected oidc-token-result after authorize()"
        )
    }

    func testUserinfoReturnsDeterministicProfile() {
        elementWithTestID("oidc-authorize-btn").tapWhenReady()
        waitForElementWithTestID("oidc-token-result")

        elementWithTestID("oidc-userinfo-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("oidc-userinfo-result").waitForExistence(timeout: 10),
            "Expected oidc-userinfo-result after userinfo()"
        )
    }

    func testLogoutClearsSession() {
        elementWithTestID("oidc-authorize-btn").tapWhenReady()
        waitForElementWithTestID("oidc-token-result")

        elementWithTestID("oidc-logout-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("oidc-logged-out").waitForExistence(timeout: 10),
            "Expected oidc-logged-out after logout()"
        )
    }
}
