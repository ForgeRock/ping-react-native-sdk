/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest of journey-callback-name-password.test.ts (Tier 2 — server required).
///
/// Journey — NamePasswordCallback
/// Server journey tree: NamePasswordCallbackTest
///
/// Flow:
///   1. Start                 → NameCallback:0
///   2. Submit username       → PasswordCallback:0
///   3. Submit password       → SuccessNode
final class JourneyCallbackNamePasswordUITests: BaseTestCase {

    private let tree = "NamePasswordCallbackTest"

    override func setUp() {
        super.setUp()
        launchJourneyScenario(tree: tree, noSession: true)
    }

    func testAppLaunchesInJourneyCallbackNamePasswordScenario() {
        assertAppReady()
    }

    /// Start() surfaces NameCallback
    func testStartSurfacesNameCallback() throws {
        try skipIfNoCallbackTrees()
        try skipIfNoJourneyEnv()
        elementWithTestID("journey-start-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-field-NameCallback:0").waitForExistence(timeout: netTimeout),
            "Expected NameCallback:0 field after start()"
        )
    }

    /// Submit username → surfaces PasswordCallback
    func testSubmitUsernameSurfacesPasswordCallback() throws {
        try skipIfNoCallbackTrees()
        try skipIfNoJourneyEnv()
        elementWithTestID("journey-start-btn").tapWhenReady()
        elementWithTestID("journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("journey-submit-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-field-PasswordCallback:0").waitForExistence(timeout: netTimeout),
            "Expected PasswordCallback:0 field after submitting username"
        )
    }

    /// Submit password → reaches SuccessNode (live)
    func testSubmitPasswordReachesSuccessNode() throws {
        try skipIfNoCallbackTrees()
        try skipIfNoJourneyEnv()
        elementWithTestID("journey-start-btn").tapWhenReady()
        elementWithTestID("journey-field-NameCallback:0").typeTextWhenReady(env.testUsername)
        elementWithTestID("journey-submit-btn").tapWhenReady()
        elementWithTestID("journey-field-PasswordCallback:0").typeTextWhenReady(env.testPassword)
        elementWithTestID("journey-submit-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("journey-success").waitForExistence(timeout: netTimeout),
            "Expected journey-success after submitting valid username and password"
        )
    }
}
