/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest for journey failure path (Tier 2 — server required).
///
/// Android SDK parity:
///   handleError → testInvalidCredentialsShowsFailureNode
final class JourneyFailurePathUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        launchApp(scenario: "journey-failure", extras: [
            "PING_SERVER_URL":   env.serverUrl,
            "PING_REALM_PATH":   env.realmPath,
            "PING_JOURNEY_NAME": env.journeyName,
            "PING_COOKIE_NAME":  env.cookieName,
        ])
    }

    func testAppLaunchesInJourneyFailureScenario() {
        assertAppReady()
    }

    func testInvalidCredentialsShowsFailureNode() throws {
        try skipIfNoJourneyEnv()
        elementWithTestID("journey-start-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-field-NameCallback:0").waitForExistence(timeout: netTimeout),
            "Expected username field after start()"
        )
        elementWithTestID("journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("journey-field-PasswordCallback:0").typeTextWhenReady("wrong_password")
        elementWithTestID("journey-submit-btn").tapWhenReady()

        XCTAssertTrue(
            elementWithTestID("journey-failure").waitForExistence(timeout: netTimeout),
            "Expected journey-failure element after invalid credentials"
        )
        // Accept any failure-message variant the server returns.
        let hasMessage =
            elementWithTestID("journey-failure-message").exists ||
            app.staticTexts["Login Failure"].exists ||
            app.staticTexts["Login failure"].exists
        XCTAssertTrue(hasMessage, "Expected a failure message element for invalid credentials")
    }
}

/// Verifies that after a revoke the login form re-appears and a second
/// login succeeds, mirroring the 'revoke() and re-login' test in Detox.
///
/// Kept in a separate test case so the app launches directly into the standard
/// journey scenario during `setUp()`, instead of changing launch arguments
/// after the app is already running.
final class JourneyRevokeReLoginUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        launchJourneyScenario()
    }

    func testAppLaunchesInJourneyScenario() {
        assertAppReady()
    }

    func testRevokeAndReLoginSucceeds() throws {
        try skipIfNoJourneyEnv()
        elementWithTestID("journey-start-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-field-NameCallback:0").waitForExistence(timeout: netTimeout),
            "Expected username field"
        )
        elementWithTestID("journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("journey-field-PasswordCallback:0").typeTextWhenReady(env.testPassword)
        elementWithTestID("journey-submit-btn").tapWhenReady()
        waitForElementWithTestID("journey-success", timeout: netTimeout)

        elementWithTestID("journey-revoke-btn").tapWhenReady()
        waitForElementWithTestID("journey-revoked", timeout: netTimeout)

        // Second login after revoke must succeed.
        elementWithTestID("journey-start-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-field-NameCallback:0").waitForExistence(timeout: netTimeout),
            "Expected login form again after revoke"
        )
        elementWithTestID("journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("journey-field-PasswordCallback:0").typeTextWhenReady(env.testPassword)
        elementWithTestID("journey-submit-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-success").waitForExistence(timeout: netTimeout),
            "Expected journey-success after re-login"
        )
    }
}
