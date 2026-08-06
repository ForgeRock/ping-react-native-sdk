/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest equivalent of e2e/davinci.test.ts (Tier 2 — DaVinci server required).
///
/// Mirrors the Detox happy-path suite step-for-step against the same live-env
/// gate (PINGONE_DISCOVERY_ENDPOINT, PINGONE_CLIENT_ID, PINGONE_USERNAME,
/// PINGONE_PASSWORD) and the same testIDs (`davinci-field-{key}` scheme).
final class DaVinciUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        var extras: [String: String] = [:]
        if !env.daVinciDiscoveryEndpoint.isEmpty {
            extras["PING_DISCOVERY_ENDPOINT"] = env.daVinciDiscoveryEndpoint
        }
        if !env.daVinciClientId.isEmpty {
            extras["PING_CLIENT_ID"] = env.daVinciClientId
        }
        if !env.daVinciRedirectUri.isEmpty {
            extras["PING_REDIRECT_URI"] = env.daVinciRedirectUri
        }
        if !env.daVinciAcrValues.isEmpty {
            extras["PING_ACR_VALUES"] = env.daVinciAcrValues
        }
        launchApp(scenario: "davinci", extras: extras)
    }

    func testAppLaunchesAndRootIsVisible() {
        assertAppReady()
    }

    func testStartButtonIsRendered() {
        XCTAssertTrue(
            elementWithTestID("davinci-start-btn").waitForExistence(timeout: netTimeout),
            "Expected davinci-start-btn to be visible"
        )
    }

    func testStartRendersLoginForm() throws {
        try skipIfNoDaVinciEnv()
        elementWithTestID("davinci-start-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("davinci-field-username").waitForExistence(timeout: netTimeout),
            "Expected davinci-field-username after start()"
        )
        XCTAssertTrue(
            elementWithTestID("davinci-field-password").waitForExistence(timeout: netTimeout),
            "Expected davinci-field-password after start()"
        )
    }

    func testNextWithValidCredentialsReturnsSuccessNode() throws {
        try skipIfNoDaVinciEnv()
        elementWithTestID("davinci-start-btn").tapWhenReady()
        waitForElementWithTestID("davinci-field-username", timeout: netTimeout)
        elementWithTestID("davinci-field-username").typeTextWhenReady(env.daVinciUsername)
        elementWithTestID("davinci-field-password").typeTextWhenReady(env.daVinciPassword)
        elementWithTestID("davinci-submit-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("davinci-success").waitForExistence(timeout: netTimeout),
            "Expected davinci-success after valid credentials"
        )
    }

    func testAccessTokenIsAvailable() throws {
        try skipIfNoDaVinciEnv()
        loginWithValidCredentials()
        let token = textContentOfElement(withTestID: "davinci-token-result", timeout: netTimeout)
        XCTAssertFalse(token.isEmpty, "Expected a non-empty access token after login")
        XCTAssertNotEqual(token, "null", "Access token must not be the string 'null'")
        XCTAssertNotEqual(token, "undefined", "Access token must not be the string 'undefined'")
    }

    func testUserinfoReturnsPayloadContainingSub() throws {
        try skipIfNoDaVinciEnv()
        loginWithValidCredentials()
        elementWithTestID("davinci-userinfo-btn").tapWhenReady()
        let userinfo = textContentOfElement(withTestID: "davinci-userinfo-result", timeout: netTimeout)
        XCTAssertTrue(userinfo.contains("\"sub\""), "Expected userinfo payload to contain 'sub', got '\(userinfo)'")
    }

    func testRefreshObtainsNewToken() throws {
        try skipIfNoDaVinciEnv()
        loginWithValidCredentials()
        elementWithTestID("davinci-refresh-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("davinci-refreshed").waitForExistence(timeout: netTimeout),
            "Expected davinci-refreshed after refresh()"
        )
    }

    func testRevokeInvalidatesSession() throws {
        try skipIfNoDaVinciEnv()
        loginWithValidCredentials()
        elementWithTestID("davinci-revoke-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("davinci-revoked").waitForExistence(timeout: netTimeout),
            "Expected davinci-revoked after revoke()"
        )
    }

    func testLogoutClearsSession() throws {
        try skipIfNoDaVinciEnv()
        loginWithValidCredentials()
        elementWithTestID("davinci-logout-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("davinci-logged-out").waitForExistence(timeout: netTimeout),
            "Expected davinci-logged-out after logoutUser()"
        )
    }

    // MARK: - Helpers

    private func loginWithValidCredentials() {
        elementWithTestID("davinci-start-btn").tapWhenReady()
        waitForElementWithTestID("davinci-field-username", timeout: netTimeout)
        elementWithTestID("davinci-field-username").typeTextWhenReady(env.daVinciUsername)
        elementWithTestID("davinci-field-password").typeTextWhenReady(env.daVinciPassword)
        elementWithTestID("davinci-submit-btn").tapWhenReady()
        waitForElementWithTestID("davinci-success", timeout: netTimeout)
    }
}
