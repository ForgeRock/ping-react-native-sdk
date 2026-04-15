/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest


/// Verifies that PingTestRunner launches successfully, the root view renders,
/// and the expected header/body structure is visible. No scenario arg is passed —
/// the app renders its shell UI by default.
final class AppLaunchUITests: BaseTestCase {

    override func setUp() {
        super.setUp()
        app.launch()
    }

    func testRendersRootContainer() {
        assertAppReady()
    }

    func testDisplaysTitle() {
        XCTAssertTrue(
            elementWithTestID("ping-test-runner-title").waitForExistence(timeout: 10),
            "Expected 'ping-test-runner-title' to be visible"
        )
    }

    func testDisplaysHeader() {
        XCTAssertTrue(
            elementWithTestID("ping-test-runner-header").waitForExistence(timeout: 10),
            "Expected 'ping-test-runner-header' to be visible"
        )
    }

    func testDisplaysBody() {
        XCTAssertTrue(
            elementWithTestID("ping-test-runner-body").waitForExistence(timeout: 10),
            "Expected 'ping-test-runner-body' to be visible"
        )
    }
}
