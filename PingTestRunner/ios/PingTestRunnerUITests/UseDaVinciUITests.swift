/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest equivalent of use-davinci.test.ts (Tier 2 — server required).
///
/// Verifies hook-API state transitions for the useDaVinci + useDaVinciForm
/// scenario: field rendering, next(), and post-login actions
/// (token, userinfo, refresh, revoke, logout).
final class UseDaVinciUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        var extras: [String: String] = [
            "PINGONE_DISCOVERY_ENDPOINT": env.daVinciDiscoveryEndpoint,
            "PINGONE_CLIENT_ID":          env.daVinciClientId,
            "PINGONE_REDIRECT_URI":       env.daVinciRedirectUri,
            // Storage survives app relaunches on the simulator; without this a
            // session from a previous test makes start() return SuccessNode
            // immediately (server sends authorizeResponse), skipping the form.
            "PING_CLEAR_STORAGE":      "true",
        ]
        if !env.daVinciAcrValues.isEmpty {
            extras["PINGONE_ACR_VALUES"] = env.daVinciAcrValues
        }
        launchApp(scenario: "use-davinci", extras: extras)
    }

    // MARK: - Helpers

    private func loginWithValidCredentials() {
        elementWithTestID("use-davinci-start-btn").tapWhenReady()
        waitForElementWithTestID("use-davinci-field-username", timeout: netTimeout)
        elementWithTestID("use-davinci-field-username").typeTextWhenReady(env.daVinciUsername)
        elementWithTestID("use-davinci-field-password").typeTextWhenReady(env.daVinciPassword)
        buttonWithLabel("Sign On").tapWhenReady()
        waitForElementWithTestID("use-davinci-success", timeout: netTimeout)
    }

    // MARK: - Tests

    func testAppLaunchesInUseDaVinciScenario() throws {
        // A valid launch requires live DaVinci configuration; without it the
        // scenario renders its error panel rather than the flow UI.
        try skipIfNoDaVinciEnv()
        assertAppReady()
    }

    /// Verifies form rendering (useDaVinciForm fields), successful login via next(),
    /// and that the token is available after SuccessNode — one login round-trip.
    func testFormRendersAndLoginSucceeds() throws {
        try skipIfNoDaVinciEnv()
        elementWithTestID("use-davinci-start-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-davinci-field-username").waitForExistence(timeout: netTimeout),
            "Expected username field via useDaVinciForm"
        )
        XCTAssertTrue(
            elementWithTestID("use-davinci-field-password").waitForExistence(timeout: netTimeout),
            "Expected password field via useDaVinciForm"
        )
        elementWithTestID("use-davinci-field-username").typeTextWhenReady(env.daVinciUsername)
        elementWithTestID("use-davinci-field-password").typeTextWhenReady(env.daVinciPassword)
        buttonWithLabel("Sign On").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-davinci-success").waitForExistence(timeout: netTimeout),
            "Expected use-davinci-success after valid credentials"
        )
        XCTAssertTrue(
            elementWithTestID("use-davinci-token-result").waitForExistence(timeout: netTimeout),
            "Expected use-davinci-token-result after success"
        )
    }

    /// Verifies userinfo(), refresh(), and revoke() hook actions — one login round-trip.
    func testUserinfoRefreshAndRevoke() throws {
        try skipIfNoDaVinciEnv()
        loginWithValidCredentials()

        elementWithTestID("use-davinci-userinfo-btn").tapWhenReady()
        let userinfo = textContentOfElement(withTestID: "use-davinci-userinfo-result", timeout: netTimeout)
        XCTAssertTrue(userinfo.contains("\"sub\""), "Expected userinfo payload to contain 'sub'")

        elementWithTestID("use-davinci-refresh-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-davinci-refreshed").waitForExistence(timeout: netTimeout),
            "Expected use-davinci-refreshed after refresh()"
        )

        elementWithTestID("use-davinci-revoke-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-davinci-revoked").waitForExistence(timeout: netTimeout),
            "Expected use-davinci-revoked after revoke()"
        )
    }

    func testLogoutCompletesViaHookActions() throws {
        try skipIfNoDaVinciEnv()
        loginWithValidCredentials()
        elementWithTestID("use-davinci-logout-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-davinci-logged-out").waitForExistence(timeout: netTimeout),
            "Expected use-davinci-logged-out after logoutUser()"
        )
    }
}

/// XCUITest equivalent of the 'useDaVinci — ErrorNode on wrong credentials'
/// describe block in use-davinci.test.ts.
final class UseDaVinciErrorUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        var extras: [String: String] = [
            "PINGONE_DISCOVERY_ENDPOINT": env.daVinciDiscoveryEndpoint,
            "PINGONE_CLIENT_ID":          env.daVinciClientId,
            "PINGONE_REDIRECT_URI":       env.daVinciRedirectUri,
            // Same fresh-session requirement as UseDaVinciUITests.setUp.
            "PING_CLEAR_STORAGE":      "true",
        ]
        if !env.daVinciAcrValues.isEmpty {
            extras["PINGONE_ACR_VALUES"] = env.daVinciAcrValues
        }
        launchApp(scenario: "use-davinci", extras: extras)
    }

    func testAppLaunchesInUseDaVinciScenario() throws {
        // A valid launch requires live DaVinci configuration; without it the
        // scenario renders its error panel rather than the flow UI.
        try skipIfNoDaVinciEnv()
        assertAppReady()
    }

    func testNextWithWrongPasswordReachesErrorNode() throws {
        try skipIfNoDaVinciEnv()
        elementWithTestID("use-davinci-start-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-davinci-field-username").waitForExistence(timeout: netTimeout),
            "Expected username field after start()"
        )
        elementWithTestID("use-davinci-field-username").typeTextWhenReady(env.daVinciUsername)
        elementWithTestID("use-davinci-field-password").typeTextWhenReady("wrong_password")
        buttonWithLabel("Sign On").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-davinci-error-node").waitForExistence(timeout: netTimeout),
            "Expected use-davinci-error-node after wrong password"
        )
    }
}
