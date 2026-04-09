/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// XCUITest for logger scenarios (Tier 1 — no server required).
///
/// Flow:
///   testConsoleLogger → create debug logger, call all 4 levels
///   testWarnLogger    → changeLevel('warn') does not throw
///   testNoneLogger    → level 'none' logger creates without throwing
final class LoggerUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        launchApp(scenario: "logger")
    }

    func testAppLaunchesInLoggerScenario() {
        assertAppReady()
    }

    func testDebugLoggerCreatesWithoutThrowing() {
        elementWithTestID("logger-create-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("logger-ready").waitForExistence(timeout: 10),
            "Expected 'logger-ready' after creating a debug logger"
        )
    }

    func testAllLogLevelsCallableWithoutThrowing() {
        elementWithTestID("logger-create-btn").tapWhenReady()
        waitForElementWithTestID("logger-ready")

        elementWithTestID("logger-log-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("logger-logged").waitForExistence(timeout: 10),
            "Expected 'logger-logged' after calling debug/info/warn/error"
        )
    }

    func testChangeLevelToWarnCompletesWithoutThrowing() {
        elementWithTestID("logger-create-btn").tapWhenReady()
        waitForElementWithTestID("logger-ready")

        elementWithTestID("logger-change-level-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("logger-level-changed").waitForExistence(timeout: 10),
            "Expected 'logger-level-changed' after calling changeLevel('warn')"
        )
    }

    func testNoneLevelLoggerCreatesWithoutThrowing() {
        elementWithTestID("logger-none-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("logger-none-ready").waitForExistence(timeout: 10),
            "Expected 'logger-none-ready' after creating a 'none' level logger"
        )
    }

    func testNoErrorIsShown() {
        // Wait for the screen to finish rendering before asserting absence of an error,
        // so a late React Native / bridge error cannot slip past an instantaneous check.
        _ = elementWithTestID("logger-create-btn").waitForExistence(timeout: 10)
        XCTAssertFalse(
            elementWithTestID("logger-error").exists,
            "Expected no error element to be present"
        )
    }
}
