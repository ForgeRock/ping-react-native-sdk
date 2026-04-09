/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest OIDC tests (Tier 1 — no server required).
///
/// Uses a JS-only mock OidcWebClient, so no native OIDC calls are made.
/// Verifies that useOidc correctly manages hook state transitions:
///   - isAuthenticated set after authorize()
///   - user / tokens / userInfo / refreshed populated after respective actions
///   - isAuthenticated cleared after revoke() / logout()
final class UseOidcUITests: BaseTestCase {

    private let actionTimeout: TimeInterval = 5

    override func setUp() {
        super.setUp()
        launchApp(scenario: "use-oidc")
    }

    func testAppLaunchesInUseOidcScenario() {
        assertAppReady()
    }

    func testAuthorizeSetsIsAuthenticatedAndUser() {
        elementWithTestID("use-oidc-authorize-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-oidc-authenticated").waitForExistence(timeout: actionTimeout),
            "Expected use-oidc-authenticated after authorize()"
        )
        XCTAssertTrue(
            elementWithTestID("use-oidc-user-result").waitForExistence(timeout: actionTimeout),
            "Expected use-oidc-user-result after authorize()"
        )
    }

    func testTokenPopulatesTokensState() {
        elementWithTestID("use-oidc-authorize-btn").tapWhenReady()
        waitForElementWithTestID("use-oidc-authenticated", timeout: actionTimeout)

        elementWithTestID("use-oidc-token-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-oidc-token-result").waitForExistence(timeout: actionTimeout),
            "Expected use-oidc-token-result after token()"
        )
    }

    func testRefreshUpdatesHookTokenState() {
        elementWithTestID("use-oidc-authorize-btn").tapWhenReady()
        waitForElementWithTestID("use-oidc-authenticated", timeout: actionTimeout)
        elementWithTestID("use-oidc-token-btn").tapWhenReady()
        waitForElementWithTestID("use-oidc-token-result", timeout: actionTimeout)

        elementWithTestID("use-oidc-refresh-btn").tapWhenReady()
        waitForElementWithTestID("use-oidc-refreshed", timeout: actionTimeout)
        // Assert the refreshed accessToken value from hook state (state.tokens.accessToken),
        // not just the local flag. This fails if refresh() resolves but the hook does not
        // update state.tokens (e.g. a no-op refresh).
        let token = textContentOfElement(withTestID: "use-oidc-refreshed-token-result", timeout: actionTimeout)
        XCTAssertEqual(
            token, "hook-test-refreshed-token",
            "Expected state.tokens.accessToken to reflect the refreshed value after refresh()"
        )
    }

    func testUserinfoPopulatesUserInfoState() {
        elementWithTestID("use-oidc-authorize-btn").tapWhenReady()
        waitForElementWithTestID("use-oidc-authenticated", timeout: actionTimeout)

        elementWithTestID("use-oidc-userinfo-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-oidc-userinfo-result").waitForExistence(timeout: actionTimeout),
            "Expected use-oidc-userinfo-result after userinfo()"
        )
    }

    func testRevokeClearsIsAuthenticated() {
        elementWithTestID("use-oidc-authorize-btn").tapWhenReady()
        waitForElementWithTestID("use-oidc-authenticated", timeout: actionTimeout)

        elementWithTestID("use-oidc-revoke-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-oidc-logged-out").waitForExistence(timeout: actionTimeout),
            "Expected use-oidc-logged-out after revoke()"
        )
    }

    func testAuthorizeFollowedByLogoutClearsIsAuthenticated() {
        elementWithTestID("use-oidc-authorize-btn").tapWhenReady()
        waitForElementWithTestID("use-oidc-authenticated", timeout: actionTimeout)

        elementWithTestID("use-oidc-logout-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-oidc-logged-out").waitForExistence(timeout: actionTimeout),
            "Expected use-oidc-logged-out after logout()"
        )
    }
}

/// XCUITest equivalent of the 'useOidc — state.error on authorize failure'
/// describe block in use-oidc.test.ts.
final class UseOidcErrorUITests: BaseTestCase {

    private let actionTimeout: TimeInterval = 5

    override func setUp() {
        super.setUp()
        launchApp(scenario: "use-oidc-error")
    }

    func testAppLaunchesInUseOidcErrorScenario() {
        assertAppReady()
    }

    func testAuthorizeFailureSetsStateError() {
        elementWithTestID("use-oidc-authorize-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("use-oidc-error").waitForExistence(timeout: actionTimeout),
            "Expected use-oidc-error after authorize() failure"
        )
    }
}
