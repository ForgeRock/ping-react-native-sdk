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
      "timeout": 120000,
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
      "oidcStorageId": "oidc-storage-1",
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
    XCTAssertEqual(payload.timeout, 120000)
    XCTAssertEqual(payload.realm, "alpha")
    XCTAssertEqual(payload.cookie, "iPlanetDirectoryPro")
    XCTAssertEqual(payload.oidc?.clientId, "client-id")
    XCTAssertEqual(payload.oidc?.discoveryEndpoint, "https://example.com/am/oauth2/.well-known/openid-configuration")
    XCTAssertEqual(payload.oidc?.redirectUri, "com.example.app://oauth2redirect")
    XCTAssertEqual(payload.oidc?.scopes, ["openid", "profile"])
    XCTAssertEqual(payload.oidc?.acrValues, "urn:example:acr")
    XCTAssertEqual(payload.oidc?.signOutRedirectUri, "com.example.app://logout")
    XCTAssertEqual(payload.oidc?.state, "state")
    XCTAssertEqual(payload.oidc?.nonce, "nonce")
    XCTAssertEqual(payload.oidc?.uiLocales, "en-US")
    XCTAssertEqual(payload.oidc?.refreshThreshold, 60)
    XCTAssertEqual(payload.oidc?.loginHint, "user@example.com")
    XCTAssertEqual(payload.oidc?.display, "page")
    XCTAssertEqual(payload.oidc?.prompt, "login")
    XCTAssertEqual(payload.oidc?.additionalParameters, ["foo": "bar"])
    XCTAssertEqual(payload.sessionStorageId, "session-storage-1")
    XCTAssertEqual(payload.oidc?.storageId, "oidc-storage-1")
    XCTAssertEqual(payload.loggerId, "logger-1")
    XCTAssertEqual(payload.oidc?.clientHandleId, "oidc-client-1")
    XCTAssertEqual(payload.oidc?.openId?.authorizationEndpoint, "https://example.com/oauth2/authorize")
    XCTAssertEqual(payload.oidc?.openId?.tokenEndpoint, "https://example.com/oauth2/token")
    XCTAssertEqual(payload.oidc?.openId?.userinfoEndpoint, "https://example.com/oauth2/userinfo")
    XCTAssertEqual(payload.oidc?.openId?.endSessionEndpoint, "https://example.com/oauth2/logout")
    XCTAssertEqual(payload.oidc?.openId?.pingEndIdpSessionEndpoint, "https://example.com/oauth2/ping/logout")
    XCTAssertEqual(payload.oidc?.openId?.revocationEndpoint, "https://example.com/oauth2/revoke")
  }

  func testParseAllowsOidcClientHandleWithoutDirectOidcFields() throws {
    let config: NSDictionary = [
      "serverUrl": "https://example.com/am",
      "oidcClientId": "oidc-client-1"
    ]

    let payload = try JourneyConfigParser.parse(config)

    XCTAssertEqual(payload.serverUrl, "https://example.com/am")
    XCTAssertNil(payload.timeout)
    XCTAssertEqual(payload.oidc?.clientHandleId, "oidc-client-1")
    XCTAssertNil(payload.oidc?.clientId)
    XCTAssertNil(payload.oidc?.discoveryEndpoint)
    XCTAssertNil(payload.oidc?.redirectUri)
  }

  func testParseRejectsIncompleteDirectOidcConfig() {
    let config: NSDictionary = [
      "serverUrl": "https://example.com/am",
      "clientId": "client-id",
      "redirectUri": "com.example.app://oauth2redirect"
    ]

    XCTAssertThrowsError(try JourneyConfigParser.parse(config))
  }

  func testParseRejectsOidcStorageIdWithoutOidcConfig() {
    let config: NSDictionary = [
      "serverUrl": "https://example.com/am",
      "oidcStorageId": "oidc-storage-1"
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
