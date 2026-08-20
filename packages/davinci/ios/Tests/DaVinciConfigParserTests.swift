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
      "par": true,
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

    XCTAssertEqual(payload.oidc.discoveryEndpoint, "https://auth.example.com/.well-known/openid-configuration")
    XCTAssertEqual(payload.oidc.clientId, "my-client")
    XCTAssertEqual(payload.oidc.redirectUri, "com.example.app://oauth2redirect")
    XCTAssertEqual(payload.oidc.scopes, ["openid", "profile"])
    XCTAssertEqual(payload.oidc.par, true)
    XCTAssertEqual(payload.oidc.storageId, "storage-1")
    XCTAssertEqual(payload.loggerId, "logger-1")
    XCTAssertEqual(payload.timeout, 30000)
    XCTAssertEqual(payload.oidc.signOutRedirectUri, "com.example.app://logout")
    XCTAssertEqual(payload.oidc.loginHint, "user@example.com")
    XCTAssertEqual(payload.oidc.nonce, "abc123")
    XCTAssertEqual(payload.oidc.state, "state-xyz")
    XCTAssertEqual(payload.oidc.prompt, "login")
    XCTAssertEqual(payload.oidc.display, "page")
    XCTAssertEqual(payload.oidc.uiLocales, "en-US")
    XCTAssertEqual(payload.oidc.acrValues, "urn:example:acr")
    XCTAssertEqual(payload.oidc.refreshThreshold, 60)
    XCTAssertEqual(payload.oidc.additionalParameters, ["foo": "bar"])
  }

  func testParseSucceedsWithRequiredFieldsOnly() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect"
    ]

    let payload = try DaVinciConfigParser.parse(config)

    XCTAssertEqual(payload.oidc.discoveryEndpoint, "https://auth.example.com/.well-known/openid-configuration")
    XCTAssertEqual(payload.oidc.clientId, "my-client")
    XCTAssertEqual(payload.oidc.redirectUri, "com.example.app://oauth2redirect")
    XCTAssertNil(payload.oidc.storageId)
    XCTAssertNil(payload.loggerId)
    XCTAssertNil(payload.timeout)
    XCTAssertTrue(payload.oidc.scopes.isEmpty)
    XCTAssertNil(payload.oidc.par)
    XCTAssertTrue(payload.oidc.additionalParameters.isEmpty)
    XCTAssertNil(payload.protect)
  }

  func testParseThrowsForNonBooleanPar() {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "par": "true"
    ]

    XCTAssertThrowsError(try DaVinciConfigParser.parse(config))
  }

  // MARK: - Protect lifecycle parsing

  func testParseProtectAbsentReturnsNilProtect() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect"
    ]

    let payload = try DaVinciConfigParser.parse(config)

    XCTAssertNil(payload.protect)
  }

  func testParseProtectDefaultsWhenEmpty() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "protect": NSDictionary()
    ]

    let payload = try DaVinciConfigParser.parse(config)
    let protect = try XCTUnwrap(payload.protect)

    XCTAssertNil(protect.envId)
    XCTAssertTrue(protect.isBehavioralDataCollection)
    XCTAssertFalse(protect.isLazyMetadata)
    XCTAssertNil(protect.customHost)
    XCTAssertFalse(protect.isConsoleLogEnabled)
    XCTAssertTrue(protect.deviceAttributesToIgnore.isEmpty)
    XCTAssertFalse(protect.pauseBehavioralDataOnSuccess)
    XCTAssertFalse(protect.resumeBehavioralDataOnStart)
  }

  func testParseProtectAllFieldsMapped() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "protect": [
        "envId": "env-abc",
        "isBehavioralDataCollection": false,
        "isLazyMetadata": true,
        "customHost": "https://custom.host",
        "isConsoleLogEnabled": true,
        "deviceAttributesToIgnore": ["deviceId", "screen"],
        "pauseBehavioralDataOnSuccess": true,
        "resumeBehavioralDataOnStart": true
      ] as NSDictionary
    ]

    let payload = try DaVinciConfigParser.parse(config)
    let protect = try XCTUnwrap(payload.protect)

    XCTAssertEqual(protect.envId, "env-abc")
    XCTAssertFalse(protect.isBehavioralDataCollection)
    XCTAssertTrue(protect.isLazyMetadata)
    XCTAssertEqual(protect.customHost, "https://custom.host")
    XCTAssertTrue(protect.isConsoleLogEnabled)
    XCTAssertEqual(protect.deviceAttributesToIgnore, ["deviceId", "screen"])
    XCTAssertTrue(protect.pauseBehavioralDataOnSuccess)
    XCTAssertTrue(protect.resumeBehavioralDataOnStart)
  }

  func testParseProtectLoggerIdForwarded() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "protect": ["loggerId": "protect-logger-1"] as NSDictionary
    ]

    let payload = try DaVinciConfigParser.parse(config)

    XCTAssertEqual(payload.protect?.loggerId, "protect-logger-1")
  }

  func testParseProtectLoggerIdIsNilWhenAbsent() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "protect": NSDictionary()
    ]

    let payload = try DaVinciConfigParser.parse(config)

    XCTAssertNil(payload.protect?.loggerId)
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
    XCTAssertEqual(payload.oidc.loginHint, "user@example.com")
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

  func testParseThrowsForUnparseableTimeout() {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "timeout": "not-a-number"
    ]

    XCTAssertThrowsError(try DaVinciConfigParser.parse(config)) { error in
      guard case let DaVinciBridgeError.argument(message) = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
      XCTAssertTrue(message.contains("timeout"))
    }
  }

  func testParseReadsRefreshThresholdFromStringFallback() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "refreshThreshold": "120"
    ]

    let payload = try DaVinciConfigParser.parse(config)
    XCTAssertEqual(payload.oidc.refreshThreshold, 120)
  }

  func testParseThrowsForUnparseableRefreshThreshold() {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "refreshThreshold": "not-a-number"
    ]

    XCTAssertThrowsError(try DaVinciConfigParser.parse(config)) { error in
      guard case let DaVinciBridgeError.argument(message) = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
      XCTAssertTrue(message.contains("refreshThreshold"))
    }
  }

  func testParseEmptyScopesForMissingKey() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect"
    ]

    let payload = try DaVinciConfigParser.parse(config)
    XCTAssertTrue(payload.oidc.scopes.isEmpty)
  }

  func testParseReadsAdditionalParametersMap() throws {
    let config: NSDictionary = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect",
      "additionalParameters": ["p1": "v1", "p2": "v2"]
    ]

    let payload = try DaVinciConfigParser.parse(config)
    XCTAssertEqual(payload.oidc.additionalParameters["p1"], "v1")
    XCTAssertEqual(payload.oidc.additionalParameters["p2"], "v2")
  }
}
