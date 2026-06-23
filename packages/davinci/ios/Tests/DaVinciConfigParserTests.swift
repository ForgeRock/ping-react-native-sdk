//
//  DaVinciConfigParserTests.swift
//  RNPingDavinci
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import XCTest
@testable import RNPingDavinci

final class DaVinciConfigParserTests: XCTestCase {

  func testParseMapsAllRequiredAndOptionalFields() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "scopes": ["openid", "profile"],
      "storageId": "storage-1",
      "loggerId": "logger-1",
      "timeout": 30000,
      "signOutRedirectUri": "com.example.app://logout",
      "loginHint": "user@example.com",
      "nonce": "abc123",
      "state": "state-xyz",
      "prompt": "login",
      "display": "page",
      "uiLocales": "en-US",
      "acrValues": "urn:example:acr",
      "refreshThreshold": 60,
      "additionalParameters": ["foo": "bar"]
    ]

    let payload = try DaVinciConfigParser.parse(config)

    XCTAssertEqual(payload.discoveryEndpoint, "https://auth.example.com/.well-known/openid-configuration")
    XCTAssertEqual(payload.clientId, "my-client")
    XCTAssertEqual(payload.redirectUri, "com.example.app://oauth2redirect")
    XCTAssertEqual(payload.scopes, ["openid", "profile"])
    XCTAssertEqual(payload.storageId, "storage-1")
    XCTAssertEqual(payload.loggerId, "logger-1")
    XCTAssertEqual(payload.timeout, 30000)
    XCTAssertEqual(payload.signOutRedirectUri, "com.example.app://logout")
    XCTAssertEqual(payload.loginHint, "user@example.com")
    XCTAssertEqual(payload.nonce, "abc123")
    XCTAssertEqual(payload.state, "state-xyz")
    XCTAssertEqual(payload.prompt, "login")
    XCTAssertEqual(payload.display, "page")
    XCTAssertEqual(payload.uiLocales, "en-US")
    XCTAssertEqual(payload.acrValues, "urn:example:acr")
    XCTAssertEqual(payload.refreshThreshold, 60)
    XCTAssertEqual(payload.additionalParameters, ["foo": "bar"])
  }

  func testParseSucceedsWithRequiredFieldsOnly() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect"
    ]

    let payload = try DaVinciConfigParser.parse(config)

    XCTAssertEqual(payload.discoveryEndpoint, "https://auth.example.com/.well-known/openid-configuration")
    XCTAssertEqual(payload.clientId, "my-client")
    XCTAssertEqual(payload.redirectUri, "com.example.app://oauth2redirect")
    XCTAssertNil(payload.storageId)
    XCTAssertNil(payload.loggerId)
    XCTAssertNil(payload.timeout)
    XCTAssertTrue(payload.scopes.isEmpty)
    XCTAssertTrue(payload.additionalParameters.isEmpty)
  }

  func testParseThrowsWhenDiscoveryEndpointMissing() {
    let config: NSDictionary = [
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect"
    ]
    XCTAssertThrowsError(try DaVinciConfigParser.parse(config)) { error in
      guard case let DaVinciBridgeError.argument(message) = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
      XCTAssertTrue(message.contains("discoveryEndpoint"))
    }
  }

  func testParseThrowsWhenClientIdMissing() {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "redirectUri": "com.example.app://oauth2redirect"
    ]
    XCTAssertThrowsError(try DaVinciConfigParser.parse(config)) { error in
      guard case let DaVinciBridgeError.argument(message) = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
      XCTAssertTrue(message.contains("clientId"))
    }
  }

  func testParseThrowsWhenRedirectUriMissing() {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client"
    ]
    XCTAssertThrowsError(try DaVinciConfigParser.parse(config)) { error in
      guard case let DaVinciBridgeError.argument(message) = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
      XCTAssertTrue(message.contains("redirectUri"))
    }
  }

  func testParseTrimsWhitespaceFromOptionalStrings() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "loginHint": "  user@example.com  "
    ]

    let payload = try DaVinciConfigParser.parse(config)
    XCTAssertEqual(payload.loginHint, "user@example.com")
  }

  func testParseReturnsNilForBlankOptionalStrings() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "loggerId": "   "
    ]

    let payload = try DaVinciConfigParser.parse(config)
    XCTAssertNil(payload.loggerId)
  }

  func testParseReadsTimeoutAsInt64FromNumber() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "timeout": NSNumber(value: 15000)
    ]

    let payload = try DaVinciConfigParser.parse(config)
    XCTAssertEqual(payload.timeout, 15000)
  }

  func testParseReadsTimeoutFromStringFallback() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "timeout": "10000"
    ]

    let payload = try DaVinciConfigParser.parse(config)
    XCTAssertEqual(payload.timeout, 10000)
  }

  func testParseReturnsNilTimeoutForUnparseable() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "timeout": "not-a-number"
    ]

    let payload = try DaVinciConfigParser.parse(config)
    XCTAssertNil(payload.timeout)
  }

  func testParseEmptyScopesForMissingKey() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect"
    ]

    let payload = try DaVinciConfigParser.parse(config)
    XCTAssertTrue(payload.scopes.isEmpty)
  }

  func testParseReadsAdditionalParametersMap() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "additionalParameters": ["p1": "v1", "p2": "v2"]
    ]

    let payload = try DaVinciConfigParser.parse(config)
    XCTAssertEqual(payload.additionalParameters["p1"], "v1")
    XCTAssertEqual(payload.additionalParameters["p2"], "v2")
  }
}
