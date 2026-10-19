/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest equivalent of journey-callback-protect.test.ts (Tier 2 — server required,
/// Protect-enabled tenant).
///
/// Server journey tree: TEST_PING_ONE_PROTECT_EVALUATE
///
/// Flow:
///   1. Start     → ChoiceCallback:0 (select the "evaluate-default" variant)
///   2. Next node → PingOneProtectInitializeCallback
///                  (auto-handled by JourneyScenario via initializeProtectForJourney)
///   3. Next node → NameCallback:0 (username only, no PasswordCallback)
///   4. Next node → PingOneProtectEvaluationCallback
///                  (auto-handled by JourneyScenario via collectProtectForJourney)
///   5. Next node → TextOutputCallback:0 ("Success")
///   6. SuccessNode
final class JourneyProtectUITests: BaseTestCase {

    private static let tree = "TEST_PING_ONE_PROTECT_EVALUATE"
    private static let variant = "evaluate-default"
    private let protectNetTimeout: TimeInterval = 45

    /// Launches the journey scenario. Called from each test after its skip checks so a
    /// skipped test never pays for an app launch. No OIDC config is passed, mirroring
    /// the Detox suite, so no browser session starts after SuccessNode.
    private func launchProtectJourney() {
        launchApp(scenario: "journey", extras: [
            "PING_SERVER_URL":   env.serverUrl,
            "PING_REALM_PATH":   env.realmPath,
            "PING_JOURNEY_NAME": Self.tree,
            "PING_COOKIE_NAME":  env.cookieName,
        ])
    }

    func testAppLaunchesInJourneyScenario() {
        launchProtectJourney()
        assertAppReady()
    }

    func testStartInitializesProtectEvaluatesAndReachesSuccessNode() throws {
        try skipIfNoCallbackTrees()
        try skipIfNoJourneyUsernameEnv()
        launchProtectJourney()
        elementWithTestID("journey-start-btn").tapWhenReady()
        waitForElementWithTestID("journey-field-ChoiceCallback:0", timeout: protectNetTimeout)
        app.staticTexts[Self.variant].firstMatch.tapWhenReady()
        elementWithTestID("journey-submit-btn").tapWhenReady()
        // Reaching the NameCallback proves the Initialize callback was auto-handled.
        waitForElementWithTestID("journey-field-NameCallback:0", timeout: protectNetTimeout)
        elementWithTestID("journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("journey-submit-btn").tapWhenReady()
        // Reaching the TextOutputCallback proves the Evaluation callback was auto-handled.
        waitForElementWithTestID(
            "journey-field-output-TextOutputCallback:0",
            timeout: protectNetTimeout
        )
        elementWithTestID("journey-submit-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-success").waitForExistence(timeout: protectNetTimeout),
            "Expected journey-success after Protect initialize, username, and evaluate"
        )
    }
}
