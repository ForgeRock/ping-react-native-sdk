/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest

/// Base class for all PingTestRunner XCUITest cases.
///
/// Responsibilities:
/// - Launches the app with the correct launchArguments for each scenario,
///   mirroring Detox's `device.launchApp({ launchArgs: { ... } })` pattern.
///   React Native reads `-KEY VALUE` pairs from ProcessInfo.processInfo.arguments
///   via react-native-launch-arguments and surfaces them as JS process.env.
/// - Provides `el()` / `waitForEl()` helpers that query by accessibilityIdentifier,
///   which React Native sets from the `testID` prop on every component.
/// - Provides skip helpers that mirror hasJourneyEnv / hasCallbackTreesEnabled
///   from e2e/setup.ts so Tier 2 tests self-skip when server secrets are absent.
class BaseTestCase: XCTestCase {

    var app: XCUIApplication!
    let env = TestEnvironment.shared

    /// Timeout for operations that involve a network round-trip to the Ping server.
    let netTimeout: TimeInterval = 30

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
    }

    override func tearDown() {
        app.terminate()
        super.tearDown()
    }

    // MARK: - App Launch

    /// Launches the app configured for the given scenario.
    ///
    /// Passes configuration as `-KEY VALUE` launch arguments.
    /// The RN app reads these at startup to select a scenario screen
    /// and configure the Ping SDK.
    func launchApp(scenario: String, extras: [String: String] = [:]) {
        var args = ["-PING_TEST_SCENARIO", scenario]
        for (key, value) in extras where !value.isEmpty {
            args += ["-\(key)", value]
        }
        app.launchArguments = args
        app.launch()
    }

    /// Launches the app in the `journey` scenario with all required Ping server args.
    /// Pass `tree` to override the default PING_JOURNEY_NAME from TestEnvironment.
    func launchJourneyScenario(tree: String? = nil, noSession: Bool = false) {
        var extras: [String: String] = [
            "PING_SERVER_URL":   env.serverUrl,
            "PING_REALM_PATH":   env.realmPath,
            "PING_JOURNEY_NAME": tree ?? env.journeyName,
            "PING_COOKIE_NAME":  env.cookieName,
        ]
        if noSession                       { extras["PING_NO_SESSION"]           = "true" }
        if !env.clientId.isEmpty           { extras["PING_CLIENT_ID"]            = env.clientId }
        if !env.discoveryEndpoint.isEmpty  { extras["PING_DISCOVERY_ENDPOINT"]   = env.discoveryEndpoint }
        if !env.redirectUri.isEmpty        { extras["PING_REDIRECT_URI"]         = env.redirectUri }
        launchApp(scenario: "journey", extras: extras)
    }

    // MARK: - Root Assertion

    /// Asserts that the app root container is visible, mirroring assertAppReady()
    /// from e2e/setup.ts. Allow extra time on real devices for Hermes startup.
    func assertAppReady(timeout: TimeInterval = 20) {
        let root = elementWithTestID("ping-test-runner-root")
        XCTAssertTrue(
            root.waitForExistence(timeout: timeout),
            "App root 'ping-test-runner-root' did not appear within \(timeout)s"
        )
    }

    // MARK: - Element Helpers

    /// Returns the first element with the given accessibilityIdentifier (= RN testID).
    /// Uses `.any` type so the query works regardless of the underlying view type
    /// (button, text field, static text, other), which can vary across RN versions.
    func elementWithTestID(_ testID: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: testID).firstMatch
    }

    /// Waits for the element with the given testID to exist and fails the test if it doesn't.
    @discardableResult
    func waitForElementWithTestID(
        _ testID: String,
        timeout: TimeInterval? = nil,
        file: StaticString = #file,
        line: UInt = #line
    ) -> XCUIElement {
        let element = elementWithTestID(testID)
        let t = timeout ?? netTimeout
        XCTAssertTrue(
            element.waitForExistence(timeout: t),
            "Element '\(testID)' not found within \(t)s",
            file: file,
            line: line
        )
        return element
    }

    /// Reads the visible text content of the element with the given testID.
    ///
    /// React Native Fabric (New Architecture) sometimes stores the display text in
    /// `element.value` rather than `element.label`. This helper checks both.
    func textContentOfElement(
        withTestID testID: String,
        timeout: TimeInterval? = nil,
        file: StaticString = #file,
        line: UInt = #line
    ) -> String {
        let element = waitForElementWithTestID(testID, timeout: timeout, file: file, line: line)
        return element.label.isEmpty ? (element.value as? String ?? "") : element.label
    }

    // MARK: - Skip Helpers

    /// Skips the test if Journey environment variables are not set.
    /// Mirrors hasJourneyEnv from e2e/setup.ts.
    func skipIfNoJourneyEnv(file: StaticString = #file, line: UInt = #line) throws {
        try XCTSkipUnless(
            env.hasJourneyEnv,
            "Skipping: PING_SERVER_URL, PING_TEST_USERNAME, PING_TEST_PASSWORD not set.",
            file: file,
            line: line
        )
    }

    /// Skips the test if PING_CALLBACK_TREES_ENABLED is false.
    /// Mirrors hasCallbackTreesEnabled from e2e/setup.ts.
    func skipIfNoCallbackTrees(file: StaticString = #file, line: UInt = #line) throws {
        try XCTSkipUnless(
            env.callbackTreesEnabled,
            "Skipping: PING_CALLBACK_TREES_ENABLED=false.",
            file: file,
            line: line
        )
    }

    /// Skips the test if OIDC env vars (discovery endpoint + client ID) are not set.
    /// Mirrors hasLiveAuthEnv() from e2e/setup.ts.
    func skipIfNoLiveAuthEnv(file: StaticString = #file, line: UInt = #line) throws {
        try XCTSkipUnless(
            env.hasLiveAuthEnv,
            "Skipping: PING_DISCOVERY_ENDPOINT and PING_CLIENT_ID not set.",
            file: file,
            line: line
        )
    }
}
