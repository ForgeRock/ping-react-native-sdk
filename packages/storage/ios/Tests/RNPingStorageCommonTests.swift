/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import XCTest
@testable import RNPingCore
@testable import RNPingStorage

@available(iOS 16.0, *)
final class RNPingStorageCommonTests: XCTestCase {

  override func setUp() async throws {
    try await super.setUp()
    await CoreRuntime.sessionStorageConfigRegistry.removeAll()
    await CoreRuntime.oidcStorageConfigRegistry.removeAll()
  }

  override func tearDown() async throws {
    await CoreRuntime.sessionStorageConfigRegistry.removeAll()
    await CoreRuntime.oidcStorageConfigRegistry.removeAll()
    try await super.tearDown()
  }

  func testConfigureSessionStorageReturnsConfig() throws {
    let config: NSDictionary = ["account": "test.session.config"]

    let id = RNPingStorageCommon.registerSessionStorage(config)
    let configJson = RNPingStorageCommon.configureSessionStorage(id)
    let resolved = try decodeConfig(configJson)

    XCTAssertFalse(id.isEmpty)
    XCTAssertFalse(configJson.isEmpty)
    XCTAssertEqual(resolved.account, "test.session.config")
  }

  func testConfigureOidcStorageReturnsConfig() throws {
    let config: NSDictionary = ["account": "test.oidc.config"]

    let id = RNPingStorageCommon.registerOidcStorage(config)
    let configJson = RNPingStorageCommon.configureOidcStorage(id)
    let resolved = try decodeConfig(configJson)

    XCTAssertFalse(id.isEmpty)
    XCTAssertFalse(configJson.isEmpty)
    XCTAssertEqual(resolved.account, "test.oidc.config")
  }

  func testConfigureUsesDefaultValues() throws {
    let config: NSDictionary = [:]

    let id = RNPingStorageCommon.registerSessionStorage(config)
    let configJson = RNPingStorageCommon.configureSessionStorage(id)
    let resolved = try decodeConfig(configJson)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(resolved.account, "com.pingidentity.rnsampleapp.keyalias")
    XCTAssertEqual(resolved.encryptor, true)
  }

  func testConfigureStoresProvidedValues() throws {
    let config: NSDictionary = [
      "cacheable": true,
      "account": "test.custom.account",
      "encryptor": false
    ]

    let id = RNPingStorageCommon.registerSessionStorage(config)
    let configJson = RNPingStorageCommon.configureSessionStorage(id)
    let resolved = try decodeConfig(configJson)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(resolved.cacheable, true)
    XCTAssertEqual(resolved.account, "test.custom.account")
    XCTAssertEqual(resolved.encryptor, false)
  }

  func testCacheableFalseStored() throws {
    let config: NSDictionary = [
      "cacheable": false
    ]

    let id = RNPingStorageCommon.registerSessionStorage(config)
    let configJson = RNPingStorageCommon.configureSessionStorage(id)
    let resolved = try decodeConfig(configJson)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(resolved.cacheable, false)
  }

  func testCacheableTrueStored() throws {
    let config: NSDictionary = [
      "cacheable": true
    ]

    let id = RNPingStorageCommon.registerSessionStorage(config)
    let configJson = RNPingStorageCommon.configureSessionStorage(id)
    let resolved = try decodeConfig(configJson)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(resolved.cacheable, true)
  }

  func testMultipleConfigsProduceDistinctOutputs() throws {
    let config1: NSDictionary = ["account": "test.1"]
    let config2: NSDictionary = ["account": "test.2"]

    let id1 = RNPingStorageCommon.registerSessionStorage(config1)
    let id2 = RNPingStorageCommon.registerSessionStorage(config2)
    let configJson1 = RNPingStorageCommon.configureSessionStorage(id1)
    let configJson2 = RNPingStorageCommon.configureSessionStorage(id2)

    XCTAssertFalse(id1.isEmpty)
    XCTAssertFalse(id2.isEmpty)
    XCTAssertNotEqual(configJson1, configJson2)
  }

  private func decodeConfig(_ json: String) throws -> RNPingStorageCommon.StorageConfig {
    let data = try XCTUnwrap(json.data(using: .utf8))
    return try JSONDecoder().decode(RNPingStorageCommon.StorageConfig.self, from: data)
  }
}
