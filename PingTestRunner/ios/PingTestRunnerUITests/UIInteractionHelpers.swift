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

    /// Pacing between tapping a text field and typing into it. Without it the first
    /// keystroke can race the field's focus registration and be silently swallowed
    /// (observed as "rn-cicd-user" landing as "r-cicd-user"), which the server then
    /// rejects with "Invalid username and/or password".
    private static let typePacing: TimeInterval = 1.0

    /// Asserts the element exists and is hittable within `timeout` seconds, taps it,
    /// pauses briefly to let focus settle, then types `text`.
    ///
    /// For non-secure fields the landed value is verified and typing is retried up to
    /// 3 times if the first keystroke was swallowed. Secure text fields skip
    /// verification: XCUITest reports a SecureTextField's `value` as '' (masked), so
    /// verification cannot distinguish a dropped keystroke from a complete value.
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
        guard elementType != .secureTextField else {
            tap()
            Thread.sleep(forTimeInterval: Self.typePacing)
            typeText(text)
            return
        }
        var landedText = ""
        for _ in 1...3 {
            tap()
            Thread.sleep(forTimeInterval: Self.typePacing)
            typeText(text)
            landedText = value as? String ?? ""
            if landedText == text {
                return
            }
            // First keystroke was swallowed: clear the field and retry.
            let backspaces = String(repeating: XCUIKeyboardKey.delete.rawValue, count: landedText.count)
            typeText(backspaces)
        }
        // Report the value as it landed on the final attempt, not the field's
        // current state: the retry above has already backspaced the field clear.
        XCTFail(
            "Failed to type text into element after 3 attempts: value was '\(landedText)', expected '\(text)'",
            file: file,
            line: line
        )
    }
}
