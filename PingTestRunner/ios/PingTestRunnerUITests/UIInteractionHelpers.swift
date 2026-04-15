/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

extension XCUIElement {

    /// Polls until the element is hittable (on-screen, not covered, interactable)
    /// or the timeout expires. Returns `true` if hittable within the window.
    @discardableResult
    func waitForHittability(timeout: TimeInterval) -> Bool {
        let predicate = NSPredicate(format: "isHittable == true")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: self)
        return XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed
    }

    /// Asserts the element exists and is hittable within `timeout` seconds, then taps it.
    ///
    /// Waiting for hittability (not just existence) prevents races against React Native
    /// rendering where an element may be in the tree but still off-screen or covered.
    func tapWhenReady(
        timeout: TimeInterval = 10,
        file: StaticString = #file,
        line: UInt = #line
    ) {
        XCTAssertTrue(
            waitForExistence(timeout: timeout),
            "Expected element to exist before tap: \(self)",
            file: file,
            line: line
        )
        XCTAssertTrue(
            waitForHittability(timeout: timeout),
            "Expected element to be hittable before tap: \(self)",
            file: file,
            line: line
        )
        tap()
    }

    /// Asserts the element exists and is hittable within `timeout` seconds, taps it, then types `text`.
    func typeTextWhenReady(
        _ text: String,
        timeout: TimeInterval = 10,
        file: StaticString = #file,
        line: UInt = #line
    ) {
        XCTAssertTrue(
            waitForExistence(timeout: timeout),
            "Expected element to exist before typeText: \(self)",
            file: file,
            line: line
        )
        XCTAssertTrue(
            waitForHittability(timeout: timeout),
            "Expected element to be hittable before typeText: \(self)",
            file: file,
            line: line
        )
        tap()
        typeText(text)
    }
}
