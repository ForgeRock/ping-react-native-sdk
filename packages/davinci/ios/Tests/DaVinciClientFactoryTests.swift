//
//  DaVinciClientFactoryTests.swift
//  RNPingDavinci
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import XCTest
import PingLogger
@testable import RNPingCore
@testable import RNPingDavinci

final class DaVinciClientFactoryTests: XCTestCase {

  override func tearDown() async throws {
    await CoreRuntime.oidcStorageConfigRegistry.removeAll()
    await CoreRuntime.loggerRegistry.removeAll()
    try await super.tearDown()
  }

  func testBuildSucceedsWithRequiredFieldsOnly() async throws {
    let payload = DaVinciClientPayload(
      discoveryEndpoint: "https://auth.example.com/.well-known/openid-configuration",
      clientId: "my-client",
      redirectUri: "com.example.app://oauth2redirect",
      scopes: ["openid"],
      storageId: nil,
      loggerId: nil,
      timeout: nil,
      signOutRedirectUri: nil,
      loginHint: nil,
      nonce: nil,
      state: nil,
      prompt: nil,
      display: nil,
      uiLocales: nil,
      acrValues: nil,
      refreshThreshold: nil,
      additionalParameters: [:]
    )

    let davinci = try await DaVinciClientFactory().build(payload)
    XCTAssertNotNil(davinci)
  }

  func testBuildAcceptsValidStorageId() async throws {
    let storageId = await CoreRuntime.oidcStorageConfigRegistry.register(
      StorageHandleStub(cacheable: true, account: "com.example.storage", encryptor: true)
    )

    let payload = DaVinciClientPayload(
      discoveryEndpoint: "https://auth.example.com/.well-known/openid-configuration",
      clientId: "my-client",
      redirectUri: "com.example.app://oauth2redirect",
      scopes: [],
      storageId: storageId,
      loggerId: nil,
      timeout: nil,
      signOutRedirectUri: nil,
      loginHint: nil,
      nonce: nil,
      state: nil,
      prompt: nil,
      display: nil,
      uiLocales: nil,
      acrValues: nil,
      refreshThreshold: nil,
      additionalParameters: [:]
    )

    let davinci = try await DaVinciClientFactory().build(payload)
    XCTAssertNotNil(davinci)
  }

  func testBuildAcceptsStorageIdWithNilAccountUsesDefault() async throws {
    let storageId = await CoreRuntime.oidcStorageConfigRegistry.register(
      StorageHandleStub(cacheable: nil, account: nil, encryptor: nil)
    )

    let payload = DaVinciClientPayload(
      discoveryEndpoint: "https://auth.example.com/.well-known/openid-configuration",
      clientId: "my-client",
      redirectUri: "com.example.app://oauth2redirect",
      scopes: [],
      storageId: storageId,
      loggerId: nil,
      timeout: nil,
      signOutRedirectUri: nil,
      loginHint: nil,
      nonce: nil,
      state: nil,
      prompt: nil,
      display: nil,
      uiLocales: nil,
      acrValues: nil,
      refreshThreshold: nil,
      additionalParameters: [:]
    )

    let davinci = try await DaVinciClientFactory().build(payload)
    XCTAssertNotNil(davinci, "build should succeed when account is nil — default 'com.pingidentity.rndavinci.storage' is used")
  }

  func testBuildThrowsForUnknownStorageId() async {
    let payload = DaVinciClientPayload(
      discoveryEndpoint: "https://auth.example.com/.well-known/openid-configuration",
      clientId: "my-client",
      redirectUri: "com.example.app://oauth2redirect",
      scopes: [],
      storageId: "missing-storage-handle",
      loggerId: nil,
      timeout: nil,
      signOutRedirectUri: nil,
      loginHint: nil,
      nonce: nil,
      state: nil,
      prompt: nil,
      display: nil,
      uiLocales: nil,
      acrValues: nil,
      refreshThreshold: nil,
      additionalParameters: [:]
    )

    do {
      _ = try await DaVinciClientFactory().build(payload)
      XCTFail("Expected argument error for unknown storage id")
    } catch let error as DaVinciBridgeError {
      guard case .argument = error else {
        return XCTFail("Expected argument error, got \(error)")
      }
    } catch {
      XCTFail("Expected DaVinciBridgeError, got \(error)")
    }
  }

  func testBuildIgnoresUnknownLoggerId() async throws {
    let payload = DaVinciClientPayload(
      discoveryEndpoint: "https://auth.example.com/.well-known/openid-configuration",
      clientId: "my-client",
      redirectUri: "com.example.app://oauth2redirect",
      scopes: [],
      storageId: nil,
      loggerId: "missing-logger-handle",
      timeout: nil,
      signOutRedirectUri: nil,
      loginHint: nil,
      nonce: nil,
      state: nil,
      prompt: nil,
      display: nil,
      uiLocales: nil,
      acrValues: nil,
      refreshThreshold: nil,
      additionalParameters: [:]
    )

    let davinci = try await DaVinciClientFactory().build(payload)
    XCTAssertNotNil(davinci)
  }

  func testBuildAcceptsValidLoggerId() async throws {
    let loggerId = await CoreRuntime.loggerRegistry.register(
      TestLoggerHandle(loggerLevel: "WARN")
    )

    let payload = DaVinciClientPayload(
      discoveryEndpoint: "https://auth.example.com/.well-known/openid-configuration",
      clientId: "my-client",
      redirectUri: "com.example.app://oauth2redirect",
      scopes: [],
      storageId: nil,
      loggerId: loggerId,
      timeout: nil,
      signOutRedirectUri: nil,
      loginHint: nil,
      nonce: nil,
      state: nil,
      prompt: nil,
      display: nil,
      uiLocales: nil,
      acrValues: nil,
      refreshThreshold: nil,
      additionalParameters: [:]
    )

    let davinci = try await DaVinciClientFactory().build(payload)
    XCTAssertNotNil(davinci)
  }
}

private final class StorageHandleStub: StorageConfigHandleContract {
  let cacheable: Bool?
  let account: String?
  let encryptor: Bool?

  init(cacheable: Bool? = nil, account: String? = nil, encryptor: Bool? = nil) {
    self.cacheable = cacheable
    self.account = account
    self.encryptor = encryptor
  }
}

private final class TestLoggerHandle: LoggerHandleContract, @unchecked Sendable {
  let loggerLevel: String
  let nativeLogger: Any?

  init(loggerLevel: String) {
    self.loggerLevel = loggerLevel
    self.nativeLogger = LogManager.none
  }
}
