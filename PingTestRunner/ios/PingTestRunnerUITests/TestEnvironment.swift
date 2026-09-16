/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// XCUITest environment variables for CI and local runs.
///
/// Values are read from the test-runner process environment. When running on
/// BrowserStack the `environmentVariables` key in the build API payload populates
/// ProcessInfo.processInfo.environment for the XCUITest runner process. For local
/// runs the runner reads the PingTestRunner `.env` file directly (see `DotEnv`);
/// process environment values take precedence over `.env` entries.

struct TestEnvironment {
    static let shared = TestEnvironment()

    let serverUrl:            String
    let realmPath:            String
    let cookieName:           String
    let journeyName:          String
    let testUsername:         String
    let testPassword:         String
    let discoveryEndpoint:    String
    let clientId:             String
    let redirectUri:          String
    let callbackTreesEnabled: Bool

    // DaVinci — mirrors DAVINCI_ENV in e2e/setup.ts (PINGONE_* env vars).
    let daVinciDiscoveryEndpoint: String
    let daVinciClientId:          String
    let daVinciRedirectUri:       String
    let daVinciUsername:          String
    let daVinciPassword:          String
    let daVinciAcrValues:         String

    private static let fileValues: [String: String] = DotEnv.load()

    private init() {
        serverUrl         = Self.readValue("PING_SERVER_URL")          ?? ""
        realmPath         = Self.readValue("PING_REALM_PATH")          ?? "alpha"
        cookieName        = Self.readValue("PING_COOKIE_NAME")         ?? "iPlanetDirectoryPro"
        journeyName       = Self.readValue("PING_JOURNEY_NAME")        ?? "Login"
        testUsername      = Self.readValue("PING_TEST_USERNAME")       ?? ""
        testPassword      = Self.readValue("PING_TEST_PASSWORD")       ?? ""
        discoveryEndpoint = Self.readValue("PING_DISCOVERY_ENDPOINT")  ?? ""
        clientId          = Self.readValue("PING_CLIENT_ID")           ?? ""
        redirectUri       = Self.readValue("PING_REDIRECT_URI")        ?? "org.forgerock.demo://oauth2redirect"
        callbackTreesEnabled = Self.readValue("PING_CALLBACK_TREES_ENABLED") != "false"

        daVinciDiscoveryEndpoint = Self.readValue("PINGONE_DISCOVERY_ENDPOINT") ?? ""
        daVinciClientId          = Self.readValue("PINGONE_CLIENT_ID")          ?? ""
        daVinciRedirectUri       = Self.readValue("PINGONE_REDIRECT_URI")       ?? "org.forgerock.demo://oauth2redirect"
        daVinciUsername          = Self.readValue("PINGONE_USERNAME")           ?? ""
        daVinciPassword          = Self.readValue("PINGONE_PASSWORD")           ?? ""
        daVinciAcrValues         = Self.readValue("PINGONE_ACR_VALUES")         ?? ""
    }

    /// Reads a variable from the process environment, falling back to the
    /// parsed `.env` file. Static so the initializer can use it before
    /// stored properties are fully initialized.
    private static func readValue(_ key: String) -> String? {
        let processValue = ProcessInfo.processInfo.environment[key]
        return processValue ?? fileValues[key]
    }

    /// True when all vars required for Journey Tier 2 tests are set.
    var hasJourneyEnv: Bool {
        !serverUrl.isEmpty && !testUsername.isEmpty && !testPassword.isEmpty
    }

    /// True when OIDC vars are also set (full live-auth flow).
    var hasLiveAuthEnv: Bool {
        hasJourneyEnv && !discoveryEndpoint.isEmpty && !clientId.isEmpty
    }

    /// True when all vars required for the DaVinci live E2E flow are set.
    /// Mirrors hasDaVinciEnv() in e2e/davinci.test.ts.
    var hasDaVinciEnv: Bool {
        !daVinciDiscoveryEndpoint.isEmpty && !daVinciClientId.isEmpty
            && !daVinciUsername.isEmpty && !daVinciPassword.isEmpty
    }
}
