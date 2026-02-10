/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingOidc

final class OidcConfigParserTests: XCTestCase {

  func testParseClientConfigMapsRequiredAndOptionalFields() throws {
    let config: NSDictionary = [
      "clientId": "client-id",
      "discoveryEndpoint": "https://example.com/.well-known/openid-configuration",
      "redirectUri": "com.example.app://callback",
      "scopes": ["openid", "profile"],
      "storageId": "storage-1",
      "loggerId": "logger-1",
      "acrValues": "urn:acr:form",
      "signOutRedirectUri": "com.example.app://logout",
      "state": "state",
      "nonce": "nonce",
      "uiLocales": "en-US",
      "refreshThreshold": 60,
      "loginHint": "user@example.com",
      "display": "page",
      "prompt": "login",
      "additionalParameters": ["foo": "bar"],
      "openId": [
        "authorizationEndpoint": "https://example.com/oauth2/authorize",
        "tokenEndpoint": "https://example.com/oauth2/token",
        "userinfoEndpoint": "https://example.com/oauth2/userinfo",
        "endSessionEndpoint": "https://example.com/oauth2/logout"
      ],
      "ios": [
        "browserType": "authSession",
        "browserMode": "login"
      ]
    ]

    let payload = try OidcConfigParser.parseClientConfig(config)

    XCTAssertEqual(payload.clientId, "client-id")
    XCTAssertEqual(payload.discoveryEndpoint, "https://example.com/.well-known/openid-configuration")
    XCTAssertEqual(payload.redirectUri, "com.example.app://callback")
    XCTAssertEqual(payload.scopes, ["openid", "profile"])
    XCTAssertEqual(payload.storageId, "storage-1")
    XCTAssertEqual(payload.loggerId, "logger-1")
    XCTAssertEqual(payload.acrValues, "urn:acr:form")
    XCTAssertEqual(payload.signOutRedirectUri, "com.example.app://logout")
    XCTAssertEqual(payload.state, "state")
    XCTAssertEqual(payload.nonce, "nonce")
    XCTAssertEqual(payload.uiLocales, "en-US")
    XCTAssertEqual(payload.refreshThreshold, 60)
    XCTAssertEqual(payload.loginHint, "user@example.com")
    XCTAssertEqual(payload.display, "page")
    XCTAssertEqual(payload.prompt, "login")
    XCTAssertEqual(payload.additionalParameters, ["foo": "bar"])
    XCTAssertEqual(payload.browserType, "authSession")
    XCTAssertEqual(payload.browserMode, "login")
    XCTAssertEqual(payload.openId?.authorizationEndpoint, "https://example.com/oauth2/authorize")
    XCTAssertEqual(payload.openId?.tokenEndpoint, "https://example.com/oauth2/token")
    XCTAssertEqual(payload.openId?.userinfoEndpoint, "https://example.com/oauth2/userinfo")
    XCTAssertEqual(payload.openId?.endSessionEndpoint, "https://example.com/oauth2/logout")
  }

  func testParseClientConfigRequiresDiscoveryOrOpenId() {
    let config: NSDictionary = [
      "clientId": "client-id",
      "redirectUri": "com.example.app://callback",
      "scopes": ["openid"]
    ]

    XCTAssertThrowsError(try OidcConfigParser.parseClientConfig(config))
  }

  func testParseOpenIdMissingRequiredFieldReturnsNil() {
    let openId: NSDictionary = [
      "authorizationEndpoint": "https://example.com/oauth2/authorize",
      "userinfoEndpoint": "https://example.com/oauth2/userinfo"
    ]

    let parsed = OidcConfigParser.parseOpenId(openId)

    XCTAssertNil(parsed)
  }

  func testBuildAuthorizeParamsAllowsOverrides() {
    let options: NSDictionary = [
      "prompt": "login",
      "additionalParameters": [
        "prompt": "consent",
        "foo": "bar"
      ]
    ]

    let params = OidcConfigParser.buildAuthorizeParams(from: options)

    XCTAssertEqual(params["prompt"], "consent")
    XCTAssertEqual(params["foo"], "bar")
  }
}
