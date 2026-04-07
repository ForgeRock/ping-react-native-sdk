/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest for journey happy path (Tier 2 — server required).
///
/// All tests self-skip via XCTSkipUnless when PING_SERVER_URL / credentials
/// are absent.
final class JourneyHappyPathUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        launchJourneyScenario()
    }

    func testAppLaunchesInJourneyScenario() {
        assertAppReady()
    }

    func testStartRendersLoginForm() throws {
        try skipIfNoJourneyEnv()
        elementWithTestID("journey-start-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-field-NameCallback:0").waitForExistence(timeout: netTimeout),
            "Expected username field after start()"
        )
        XCTAssertTrue(
            elementWithTestID("journey-field-PasswordCallback:0").waitForExistence(timeout: netTimeout),
            "Expected password field after start()"
        )
    }

    func testLoginWithValidCredentials() throws {
        try skipIfNoJourneyEnv()
        elementWithTestID("journey-start-btn").tapWhenReady()
        elementWithTestID("journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("journey-field-PasswordCallback:0").typeTextWhenReady(env.testPassword)
        elementWithTestID("journey-submit-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-success").waitForExistence(timeout: netTimeout),
            "Expected journey-success after valid login"
        )
    }

    func testAccessTokenIsAvailableAfterLogin() throws {
        try skipIfNoJourneyEnv()
        elementWithTestID("journey-start-btn").tapWhenReady()
        elementWithTestID("journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("journey-field-PasswordCallback:0").typeTextWhenReady(env.testPassword)
        elementWithTestID("journey-submit-btn").tapWhenReady()
        waitForElementWithTestID("journey-success", timeout: netTimeout)

        let token = textContentOfElement(withTestID: "journey-token-result", timeout: netTimeout)
        XCTAssertFalse(token.isEmpty, "Expected a non-empty access token after login")
        XCTAssertNotEqual(token, "null", "Token must not be the string 'null'")
        XCTAssertNotEqual(token, "undefined", "Token must not be the string 'undefined'")
    }

    func testUserinfoContainsSub() throws {
        try skipIfNoLiveAuthEnv()
        elementWithTestID("journey-start-btn").tapWhenReady()
        elementWithTestID("journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("journey-field-PasswordCallback:0").typeTextWhenReady(env.testPassword)
        elementWithTestID("journey-submit-btn").tapWhenReady()
        waitForElementWithTestID("journey-success", timeout: netTimeout)

        elementWithTestID("journey-userinfo-btn").tapWhenReady()
        let userinfo = textContentOfElement(withTestID: "journey-userinfo-result", timeout: netTimeout)
        XCTAssertTrue(
            userinfo.contains("\"sub\""),
            "Expected userinfo payload to contain '\"sub\"', got '\(userinfo)'"
        )
    }

    func testRefreshObtainsNewToken() throws {
        try skipIfNoLiveAuthEnv()
        elementWithTestID("journey-start-btn").tapWhenReady()
        elementWithTestID("journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("journey-field-PasswordCallback:0").typeTextWhenReady(env.testPassword)
        elementWithTestID("journey-submit-btn").tapWhenReady()
        waitForElementWithTestID("journey-success", timeout: netTimeout)

        elementWithTestID("journey-refresh-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-refreshed").waitForExistence(timeout: netTimeout),
            "Expected journey-refreshed after refresh()"
        )
    }

    func testRevokeInvalidatesSession() throws {
        try skipIfNoJourneyEnv()
        elementWithTestID("journey-start-btn").tapWhenReady()
        elementWithTestID("journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("journey-field-PasswordCallback:0").typeTextWhenReady(env.testPassword)
        elementWithTestID("journey-submit-btn").tapWhenReady()
        waitForElementWithTestID("journey-success", timeout: netTimeout)

        elementWithTestID("journey-revoke-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-revoked").waitForExistence(timeout: netTimeout),
            "Expected journey-revoked after revoke()"
        )
    }

    func testLogoutClearsSession() throws {
        try skipIfNoJourneyEnv()
        elementWithTestID("journey-start-btn").tapWhenReady()
        elementWithTestID("journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("journey-field-PasswordCallback:0").typeTextWhenReady(env.testPassword)
        elementWithTestID("journey-submit-btn").tapWhenReady()
        waitForElementWithTestID("journey-success", timeout: netTimeout)

        elementWithTestID("journey-logout-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-logged-out").waitForExistence(timeout: netTimeout),
            "Expected journey-logged-out after logoutUser()"
        )
    }
}

/// XCUITest equivalent of the noSession describe block in journey-happy-path.test.ts.
///
/// Android SDK parity:
///   successfulLoginWithNoSession → testLoginWithNoSessionReachesSuccessWithoutStoredToken
final class JourneyNoSessionUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        launchJourneyScenario(noSession: true)
    }

    func testAppLaunchesInJourneyNoSessionScenario() {
        assertAppReady()
    }

    func testLoginWithNoSessionReachesSuccessWithoutStoredToken() throws {
        try skipIfNoJourneyEnv()
        elementWithTestID("journey-start-btn").tapWhenReady()
        elementWithTestID("journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("journey-field-PasswordCallback:0").typeTextWhenReady(env.testPassword)
        elementWithTestID("journey-submit-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-success").waitForExistence(timeout: netTimeout),
            "Expected journey-success with noSession flag"
        )
        // No token should be stored — journey-token-result must not appear.
        // The success element is already visible, so this check is synchronised.
        XCTAssertFalse(
            elementWithTestID("journey-token-result").exists,
            "Expected no token-result element when noSession flag is set"
        )
    }
}
