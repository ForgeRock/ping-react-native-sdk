/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingCore
@testable import RNPingJourney

final class JourneyClientFactoryTests: XCTestCase {

  override func tearDown() {
    super.tearDown()
    Task {
      await CoreRuntime.oidcClientRegistry.removeAll()
      await CoreRuntime.loggerRegistry.removeAll()
    }
  }

  func testBuildResolvesOidcFromCoreHandle() async throws {
    let oidcClientId = await CoreRuntime.oidcClientRegistry.register(
      OidcHandleStub(
        clientId: "client-id",
        discoveryEndpoint: "https://example.com/am/oauth2/.well-known/openid-configuration",
        redirectUri: "com.example.app://oauth2redirect",
        scopes: ["openid", "profile"]
      )
    )
    let payload = JourneyClientPayload(
      serverUrl: "https://example.com/am",
      timeout: nil,
      realm: "alpha",
      cookie: "iPlanetDirectoryPro",
      clientId: nil,
      discoveryEndpoint: nil,
      redirectUri: nil,
      scopes: [],
      openId: nil,
      acrValues: nil,
      signOutRedirectUri: nil,
      state: nil,
      nonce: nil,
      uiLocales: nil,
      refreshThreshold: nil,
      loginHint: nil,
      display: nil,
      prompt: nil,
      additionalParameters: [:],
      sessionStorageId: nil,
      oidcStorageId: nil,
      loggerId: nil,
      oidcClientId: oidcClientId
    )

    let journey = try await JourneyClientFactory().build(payload)

    XCTAssertNotNil(journey)
  }

  func testBuildRejectsMissingOidcHandle() async {
    let payload = JourneyClientPayload(
      serverUrl: "https://example.com/am",
      timeout: nil,
      realm: nil,
      cookie: nil,
      clientId: nil,
      discoveryEndpoint: nil,
      redirectUri: nil,
      scopes: [],
      openId: nil,
      acrValues: nil,
      signOutRedirectUri: nil,
      state: nil,
      nonce: nil,
      uiLocales: nil,
      refreshThreshold: nil,
      loginHint: nil,
      display: nil,
      prompt: nil,
      additionalParameters: [:],
      sessionStorageId: nil,
      oidcStorageId: nil,
      loggerId: nil,
      oidcClientId: "missing-handle"
    )

    do {
      _ = try await JourneyClientFactory().build(payload)
      XCTFail("Expected missing OIDC handle error")
    } catch let error as JourneyBridgeError {
      guard case .argument = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
    } catch {
      XCTFail("Expected JourneyBridgeError, got \(error)")
    }
  }

  func testBuildAcceptsSessionStorageId() async throws {
    let payload = JourneyClientPayload(
      serverUrl: "https://example.com/am",
      timeout: nil,
      realm: nil,
      cookie: nil,
      clientId: nil,
      discoveryEndpoint: nil,
      redirectUri: nil,
      scopes: [],
      openId: nil,
      acrValues: nil,
      signOutRedirectUri: nil,
      state: nil,
      nonce: nil,
      uiLocales: nil,
      refreshThreshold: nil,
      loginHint: nil,
      display: nil,
      prompt: nil,
      additionalParameters: [:],
      sessionStorageId: "session-storage-1",
      oidcStorageId: nil,
      loggerId: nil,
      oidcClientId: nil
    )

    let journey = try await JourneyClientFactory().build(payload)
    XCTAssertNotNil(journey)
  }

  func testBuildAcceptsUnknownSessionStorageId() async throws {
    let payload = JourneyClientPayload(
      serverUrl: "https://example.com/am",
      timeout: nil,
      realm: nil,
      cookie: nil,
      clientId: nil,
      discoveryEndpoint: nil,
      redirectUri: nil,
      scopes: [],
      openId: nil,
      acrValues: nil,
      signOutRedirectUri: nil,
      state: nil,
      nonce: nil,
      uiLocales: nil,
      refreshThreshold: nil,
      loginHint: nil,
      display: nil,
      prompt: nil,
      additionalParameters: [:],
      sessionStorageId: "missing-session-storage",
      oidcStorageId: nil,
      loggerId: nil,
      oidcClientId: nil
    )

    let journey = try await JourneyClientFactory().build(payload)
    XCTAssertNotNil(journey)
  }

  func testBuildAcceptsUnknownOidcStorageId() async throws {
    let payload = JourneyClientPayload(
      serverUrl: "https://example.com/am",
      timeout: nil,
      realm: nil,
      cookie: nil,
      clientId: "rn-client",
      discoveryEndpoint: "https://example.com/am/oauth2/.well-known/openid-configuration",
      redirectUri: "com.example.app://oauth2redirect",
      scopes: ["openid"],
      openId: nil,
      acrValues: nil,
      signOutRedirectUri: nil,
      state: nil,
      nonce: nil,
      uiLocales: nil,
      refreshThreshold: nil,
      loginHint: nil,
      display: nil,
      prompt: nil,
      additionalParameters: [:],
      sessionStorageId: nil,
      oidcStorageId: "missing-oidc-storage",
      loggerId: nil,
      oidcClientId: nil
    )

    let journey = try await JourneyClientFactory().build(payload)
    XCTAssertNotNil(journey)
  }

  func testBuildAcceptsLoggerIdResolvedFromCoreRegistry() async throws {
    let loggerId = await CoreRuntime.loggerRegistry.register(
      TestLoggerHandle(loggerLevel: "WARN")
    )
    let payload = JourneyClientPayload(
      serverUrl: "https://example.com/am",
      timeout: nil,
      realm: nil,
      cookie: nil,
      clientId: nil,
      discoveryEndpoint: nil,
      redirectUri: nil,
      scopes: [],
      openId: nil,
      acrValues: nil,
      signOutRedirectUri: nil,
      state: nil,
      nonce: nil,
      uiLocales: nil,
      refreshThreshold: nil,
      loginHint: nil,
      display: nil,
      prompt: nil,
      additionalParameters: [:],
      sessionStorageId: nil,
      oidcStorageId: nil,
      loggerId: loggerId,
      oidcClientId: nil
    )

    let journey = try await JourneyClientFactory().build(payload)
    XCTAssertNotNil(journey)
  }

  func testBuildIgnoresUnknownLoggerId() async throws {
    let payload = JourneyClientPayload(
      serverUrl: "https://example.com/am",
      timeout: nil,
      realm: nil,
      cookie: nil,
      clientId: nil,
      discoveryEndpoint: nil,
      redirectUri: nil,
      scopes: [],
      openId: nil,
      acrValues: nil,
      signOutRedirectUri: nil,
      state: nil,
      nonce: nil,
      uiLocales: nil,
      refreshThreshold: nil,
      loginHint: nil,
      display: nil,
      prompt: nil,
      additionalParameters: [:],
      sessionStorageId: nil,
      oidcStorageId: nil,
      loggerId: "missing-logger-handle",
      oidcClientId: nil
    )

    let journey = try await JourneyClientFactory().build(payload)
    XCTAssertNotNil(journey)
  }

  func testBuildRejectsOidcHandleWithoutDiscoveryEndpointOrOpenId() async {
    let oidcClientId = await CoreRuntime.oidcClientRegistry.register(
      OidcHandleStub(
        clientId: "client-id",
        discoveryEndpoint: nil,
        redirectUri: "com.example.app://oauth2redirect",
        scopes: ["openid"]
      )
    )
    let payload = JourneyClientPayload(
      serverUrl: "https://example.com/am",
      timeout: nil,
      realm: "alpha",
      cookie: "iPlanetDirectoryPro",
      clientId: nil,
      discoveryEndpoint: nil,
      redirectUri: nil,
      scopes: [],
      openId: nil,
      acrValues: nil,
      signOutRedirectUri: nil,
      state: nil,
      nonce: nil,
      uiLocales: nil,
      refreshThreshold: nil,
      loginHint: nil,
      display: nil,
      prompt: nil,
      additionalParameters: [:],
      sessionStorageId: nil,
      oidcStorageId: nil,
      loggerId: nil,
      oidcClientId: oidcClientId
    )

    do {
      _ = try await JourneyClientFactory().build(payload)
      XCTFail("Expected invalid OIDC handle error")
    } catch let error as JourneyBridgeError {
      guard case .argument = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
    } catch {
      XCTFail("Expected JourneyBridgeError, got \(error)")
    }
  }
}

private final class TestLoggerHandle: LoggerHandleContract, @unchecked Sendable {
  let loggerLevel: String

  init(loggerLevel: String) {
    self.loggerLevel = loggerLevel
  }
}

private final class OidcHandleStub: OidcClientConfigHandle {
  let clientId: String
  let discoveryEndpoint: String?
  let redirectUri: String
  let scopes: [String]
  let openId: OidcOpenIdConfig?
  let acrValues: String?
  let signOutRedirectUri: String?
  let state: String?
  let nonce: String?
  let uiLocales: String?
  let refreshThreshold: Int64?
  let loginHint: String?
  let display: String?
  let prompt: String?
  let additionalParameters: [String: String]

  init(
    clientId: String,
    discoveryEndpoint: String?,
    redirectUri: String,
    scopes: [String],
    openId: OidcOpenIdConfig? = nil,
    acrValues: String? = nil,
    signOutRedirectUri: String? = nil,
    state: String? = nil,
    nonce: String? = nil,
    uiLocales: String? = nil,
    refreshThreshold: Int64? = nil,
    loginHint: String? = nil,
    display: String? = nil,
    prompt: String? = nil,
    additionalParameters: [String: String] = [:]
  ) {
    self.clientId = clientId
    self.discoveryEndpoint = discoveryEndpoint
    self.redirectUri = redirectUri
    self.scopes = scopes
    self.openId = openId
    self.acrValues = acrValues
    self.signOutRedirectUri = signOutRedirectUri
    self.state = state
    self.nonce = nonce
    self.uiLocales = uiLocales
    self.refreshThreshold = refreshThreshold
    self.loginHint = loginHint
    self.display = display
    self.prompt = prompt
    self.additionalParameters = additionalParameters
  }
}
