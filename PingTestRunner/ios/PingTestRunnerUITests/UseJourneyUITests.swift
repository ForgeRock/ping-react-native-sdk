/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest equivalent of use-journey.test.ts (Tier 2 — server required).
///
/// Verifies hook-API state transitions for the useJourney + useJourneyForm
/// scenario: field rendering, next(), and post-login actions
/// (token, userinfo, refresh, revoke, logout).
final class UseJourneyUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        launchApp(scenario: "use-journey", extras: [
            "PING_SERVER_URL":         env.serverUrl,
            "PING_REALM_PATH":         env.realmPath,
            "PING_JOURNEY_NAME":       env.journeyName,
            "PING_COOKIE_NAME":        env.cookieName,
            "PING_CLIENT_ID":          env.clientId,
            "PING_DISCOVERY_ENDPOINT": env.discoveryEndpoint,
            "PING_REDIRECT_URI":       env.redirectUri,
        ])
    }

    // MARK: - Helpers

    private func loginWithValidCredentials() {
        elementWithTestID("use-journey-start-btn").tapWhenReady()
        waitForElementWithTestID("use-journey-field-NameCallback:0", timeout: netTimeout)
        elementWithTestID("use-journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("use-journey-field-PasswordCallback:0").typeTextWhenReady(env.testPassword)
        elementWithTestID("use-journey-submit-btn").tapWhenReady()
        waitForElementWithTestID("use-journey-success", timeout: netTimeout)
    }

    // MARK: - Tests

    func testAppLaunchesInUseJourneyScenario() {
        assertAppReady()
    }

    func testStartSurfacesLoginFormViaUseJourneyFormFields() throws {
        try skipIfNoJourneyEnv()
        elementWithTestID("use-journey-start-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-journey-field-NameCallback:0").waitForExistence(timeout: netTimeout),
            "Expected NameCallback field via useJourneyForm"
        )
        XCTAssertTrue(
            elementWithTestID("use-journey-field-PasswordCallback:0").waitForExistence(timeout: netTimeout),
            "Expected PasswordCallback field via useJourneyForm"
        )
    }

    func testNextWithValidCredentialsReachesSuccessNode() throws {
        try skipIfNoJourneyEnv()
        elementWithTestID("use-journey-start-btn").tapWhenReady()
        waitForElementWithTestID("use-journey-field-NameCallback:0", timeout: netTimeout)
        elementWithTestID("use-journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("use-journey-field-PasswordCallback:0").typeTextWhenReady(env.testPassword)
        elementWithTestID("use-journey-submit-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-journey-success").waitForExistence(timeout: netTimeout),
            "Expected use-journey-success after valid credentials"
        )
    }

    func testTokenIsAvailableAfterSuccess() throws {
        try skipIfNoJourneyEnv()
        loginWithValidCredentials()
        XCTAssertTrue(
            elementWithTestID("use-journey-token-result").waitForExistence(timeout: netTimeout),
            "Expected use-journey-token-result after success"
        )
    }

    func testUserinfoReturnsPayloadViaHookActions() throws {
        try skipIfNoLiveAuthEnv()
        loginWithValidCredentials()
        elementWithTestID("use-journey-userinfo-btn").tapWhenReady()
        let userinfo = textContentOfElement(withTestID: "use-journey-userinfo-result", timeout: netTimeout)
        // Parse the JSON and assert that "sub" is a non-empty string.
        // A substring check like contains("\"sub\"") would pass for {"sub": null}
        // or any echoed JSON that incidentally contains the key.
        guard
            let data = userinfo.data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let sub = json["sub"] as? String,
            !sub.isEmpty
        else {
            XCTFail("Expected userinfo payload with a non-empty string 'sub', got '\(userinfo)'")
            return
        }
        _ = sub // assertion is the guard above
    }

    func testRefreshUpdatesTokenViaHookActions() throws {
        try skipIfNoLiveAuthEnv()
        loginWithValidCredentials()
        elementWithTestID("use-journey-refresh-btn").tapWhenReady()
        waitForElementWithTestID("use-journey-refreshed", timeout: netTimeout)
        let token = textContentOfElement(withTestID: "use-journey-refreshed-token-result", timeout: netTimeout)
        XCTAssertFalse(token.isEmpty, "Expected a non-empty access token from refresh()")
        XCTAssertNotEqual(token, "null", "Refreshed token must not be the string 'null'")
        XCTAssertNotEqual(token, "undefined", "Refreshed token must not be the string 'undefined'")
    }

    func testRevokeCompletesViaHookActions() throws {
        try skipIfNoJourneyEnv()
        loginWithValidCredentials()
        elementWithTestID("use-journey-revoke-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-journey-revoked").waitForExistence(timeout: netTimeout),
            "Expected use-journey-revoked after revoke()"
        )
    }

    func testLogoutCompletesViaHookActions() throws {
        try skipIfNoJourneyEnv()
        loginWithValidCredentials()
        elementWithTestID("use-journey-logout-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-journey-logged-out").waitForExistence(timeout: netTimeout),
            "Expected use-journey-logged-out after logoutUser()"
        )
    }
}

/// XCUITest equivalent of the 'useJourney — FailureNode on wrong credentials'
/// describe block in use-journey.test.ts.
final class UseJourneyFailureUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        // No OIDC config — avoids discovery requests that can interfere with
        // failure-path timing, mirroring JOURNEY_NO_OIDC_ARGS in use-journey.test.ts.
        launchApp(scenario: "use-journey", extras: [
            "PING_SERVER_URL":   env.serverUrl,
            "PING_REALM_PATH":   env.realmPath,
            "PING_JOURNEY_NAME": env.journeyName,
            "PING_COOKIE_NAME":  env.cookieName,
        ])
    }

    func testAppLaunchesInUseJourneyScenario() {
        assertAppReady()
    }

    func testNextWithWrongPasswordReachesFailureNode() throws {
        try skipIfNoJourneyEnv()
        elementWithTestID("use-journey-start-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-journey-field-NameCallback:0").waitForExistence(timeout: netTimeout),
            "Expected username field after start()"
        )
        elementWithTestID("use-journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("use-journey-field-PasswordCallback:0").typeTextWhenReady("wrong_password")
        elementWithTestID("use-journey-submit-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-journey-failure").waitForExistence(timeout: netTimeout),
            "Expected use-journey-failure after wrong password"
        )
    }
}
