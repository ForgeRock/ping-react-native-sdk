/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingJourney

final class JourneyConfigParserTests: XCTestCase {

  func testParseMapsRequiredAndOptionalFields() throws {
    let config: NSDictionary = [
      "serverUrl": "https://example.com/am",
      "realm": "alpha",
      "cookie": "iPlanetDirectoryPro",
      "clientId": "client-id",
      "discoveryEndpoint": "https://example.com/am/oauth2/.well-known/openid-configuration",
      "redirectUri": "com.example.app://oauth2redirect",
      "scopes": ["openid", "profile"],
      "acrValues": "urn:example:acr",
      "signOutRedirectUri": "com.example.app://logout",
      "state": "state",
      "nonce": "nonce",
      "uiLocales": "en-US",
      "refreshThreshold": 60,
      "loginHint": "user@example.com",
      "display": "page",
      "prompt": "login",
      "additionalParameters": [
        "foo": "bar"
      ],
      "sessionStorageId": "session-storage-1",
      "loggerId": "logger-1",
      "oidcClientId": "oidc-client-1",
      "openId": [
        "authorizationEndpoint": "https://example.com/oauth2/authorize",
        "tokenEndpoint": "https://example.com/oauth2/token",
        "userinfoEndpoint": "https://example.com/oauth2/userinfo",
        "endSessionEndpoint": "https://example.com/oauth2/logout",
        "pingEndIdpSessionEndpoint": "https://example.com/oauth2/ping/logout",
        "revocationEndpoint": "https://example.com/oauth2/revoke"
      ]
    ]

    let payload = try JourneyConfigParser.parse(config)

    XCTAssertEqual(payload.serverUrl, "https://example.com/am")
    XCTAssertEqual(payload.realm, "alpha")
    XCTAssertEqual(payload.cookie, "iPlanetDirectoryPro")
    XCTAssertEqual(payload.clientId, "client-id")
    XCTAssertEqual(payload.discoveryEndpoint, "https://example.com/am/oauth2/.well-known/openid-configuration")
    XCTAssertEqual(payload.redirectUri, "com.example.app://oauth2redirect")
    XCTAssertEqual(payload.scopes, ["openid", "profile"])
    XCTAssertEqual(payload.acrValues, "urn:example:acr")
    XCTAssertEqual(payload.signOutRedirectUri, "com.example.app://logout")
    XCTAssertEqual(payload.state, "state")
    XCTAssertEqual(payload.nonce, "nonce")
    XCTAssertEqual(payload.uiLocales, "en-US")
    XCTAssertEqual(payload.refreshThreshold, 60)
    XCTAssertEqual(payload.loginHint, "user@example.com")
    XCTAssertEqual(payload.display, "page")
    XCTAssertEqual(payload.prompt, "login")
    XCTAssertEqual(payload.additionalParameters, ["foo": "bar"])
    XCTAssertEqual(payload.sessionStorageId, "session-storage-1")
    XCTAssertEqual(payload.loggerId, "logger-1")
    XCTAssertEqual(payload.oidcClientId, "oidc-client-1")
    XCTAssertEqual(payload.openId?.authorizationEndpoint, "https://example.com/oauth2/authorize")
    XCTAssertEqual(payload.openId?.tokenEndpoint, "https://example.com/oauth2/token")
    XCTAssertEqual(payload.openId?.userinfoEndpoint, "https://example.com/oauth2/userinfo")
    XCTAssertEqual(payload.openId?.endSessionEndpoint, "https://example.com/oauth2/logout")
    XCTAssertEqual(payload.openId?.pingEndIdpSessionEndpoint, "https://example.com/oauth2/ping/logout")
    XCTAssertEqual(payload.openId?.revocationEndpoint, "https://example.com/oauth2/revoke")
  }

  func testParseAllowsOidcClientHandleWithoutDirectOidcFields() throws {
    let config: NSDictionary = [
      "serverUrl": "https://example.com/am",
      "oidcClientId": "oidc-client-1"
    ]

    let payload = try JourneyConfigParser.parse(config)

    XCTAssertEqual(payload.serverUrl, "https://example.com/am")
    XCTAssertEqual(payload.oidcClientId, "oidc-client-1")
    XCTAssertNil(payload.clientId)
    XCTAssertNil(payload.discoveryEndpoint)
    XCTAssertNil(payload.redirectUri)
  }

  func testParseRejectsIncompleteDirectOidcConfig() {
    let config: NSDictionary = [
      "serverUrl": "https://example.com/am",
      "clientId": "client-id",
      "redirectUri": "com.example.app://oauth2redirect"
    ]

    XCTAssertThrowsError(try JourneyConfigParser.parse(config))
  }

  func testParseRejectsOpenIdWithoutRequiredEndpoints() {
    let config: NSDictionary = [
      "serverUrl": "https://example.com/am",
      "clientId": "client-id",
      "redirectUri": "com.example.app://oauth2redirect",
      "openId": [
        "authorizationEndpoint": "https://example.com/oauth2/authorize",
        "tokenEndpoint": "https://example.com/oauth2/token"
      ]
    ]

    XCTAssertThrowsError(try JourneyConfigParser.parse(config))
  }
}

