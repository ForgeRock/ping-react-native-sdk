/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// XCUITest environment variables for CI. 
/// 
/// Values are read from the test-runner process environment. When running on
/// BrowserStack the `environmentVariables` key in the build API payload populates
/// ProcessInfo.processInfo.environment for the XCUITest runner process.

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

    private init() {
        let e = ProcessInfo.processInfo.environment
        serverUrl         = e["PING_SERVER_URL"]          ?? ""
        realmPath         = e["PING_REALM_PATH"]          ?? "alpha"
        cookieName        = e["PING_COOKIE_NAME"]         ?? "iPlanetDirectoryPro"
        journeyName       = e["PING_JOURNEY_NAME"]        ?? "Login"
        testUsername      = e["PING_TEST_USERNAME"]       ?? ""
        testPassword      = e["PING_TEST_PASSWORD"]       ?? ""
        discoveryEndpoint = e["PING_DISCOVERY_ENDPOINT"]  ?? ""
        clientId          = e["PING_CLIENT_ID"]           ?? ""
        redirectUri       = e["PING_REDIRECT_URI"]        ?? "org.forgerock.demo://oauth2redirect"
        callbackTreesEnabled = e["PING_CALLBACK_TREES_ENABLED"] != "false"

        daVinciDiscoveryEndpoint = e["PINGONE_DISCOVERY_ENDPOINT"] ?? ""
        daVinciClientId          = e["PINGONE_CLIENT_ID"]          ?? ""
        daVinciRedirectUri       = e["PINGONE_REDIRECT_URI"]       ?? "org.forgerock.demo://oauth2redirect"
        daVinciUsername          = e["PINGONE_USERNAME"]           ?? ""
        daVinciPassword          = e["PINGONE_PASSWORD"]           ?? ""
        daVinciAcrValues         = e["PINGONE_ACR_VALUES"]         ?? ""
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
