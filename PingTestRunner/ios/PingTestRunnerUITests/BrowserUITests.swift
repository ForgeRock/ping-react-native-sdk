/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest


/// Verifies the native browser bridge module loads correctly and that the
/// two configuration APIs do not throw on iOS:
///   configureBrowser({}) — no-op on iOS, applies config on Android
///   resetBrowser()       — cancels the active browser session on iOS
final class BrowserUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        launchApp(scenario: "browser")
    }

    func testAppLaunchesInBrowserScenario() {
        assertAppReady()
    }

    func testConfigureBrowserCompletesWithoutThrowing() {
        elementWithTestID("browser-configure-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("browser-configure-result").waitForExistence(timeout: 5),
            "Expected 'browser-configure-result' to appear after configureBrowser({})"
        )
    }

    func testResetBrowserCompletesWithoutThrowing() {
        elementWithTestID("browser-reset-btn").tapWhenReady()
        XCTAssertTrue(
            elementWithTestID("browser-reset-result").waitForExistence(timeout: 5),
            "Expected 'browser-reset-result' to appear after resetBrowser()"
        )
    }

    func testNoErrorIsShown() {
        // Wait for the screen to finish rendering before asserting absence of an error,
        // so a late React Native / bridge error cannot slip past an instantaneous check.
        _ = elementWithTestID("browser-configure-btn").waitForExistence(timeout: 10)
        XCTAssertFalse(
            elementWithTestID("browser-error").exists,
            "Expected no error element to be present"
        )
    }
}
