/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

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

  func testConfigureSessionStorageRegistersConfig() async throws {
    let config: NSDictionary = ["account": "test.session.config"]

    let id = RNPingStorageCommon.configureSessionStorage(config)
    let resolved = try await resolveSessionConfig(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(resolved.account, "test.session.config")
  }

  func testConfigureOidcStorageRegistersConfig() async throws {
    let config: NSDictionary = ["account": "test.oidc.config"]

    let id = RNPingStorageCommon.configureOidcStorage(config)
    let resolved = try await resolveOidcConfig(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(resolved.account, "test.oidc.config")
  }

  func testSessionAndOidcRegistriesAreSeparated() async throws {
    let config: NSDictionary = ["account": "test.separation"]
    let id = RNPingStorageCommon.configureOidcStorage(config)

    let oidcResolved = await CoreRuntime.oidcStorageConfigRegistry.resolve(id)
    let sessionResolved = await CoreRuntime.sessionStorageConfigRegistry.resolve(id)

    XCTAssertNotNil(oidcResolved)
    XCTAssertNil(sessionResolved)
  }

  func testConfigureUsesDefaultValues() async throws {
    let config: NSDictionary = [:]

    let id = RNPingStorageCommon.configureSessionStorage(config)
    let resolved = try await resolveSessionConfig(id)

    XCTAssertEqual(resolved.account, "com.pingidentity.rnsampleapp.keyalias")
    XCTAssertEqual(resolved.encryptor, true)
  }

  func testConfigureStoresProvidedValues() async throws {
    let config: NSDictionary = [
      "type": "encrypted",
      "cacheStrategy": "CACHE",
      "account": "test.custom.account",
      "encryptor": false
    ]

    let id = RNPingStorageCommon.configureSessionStorage(config)
    let resolved = try await resolveSessionConfig(id)

    XCTAssertEqual(resolved.type, "encrypted")
    XCTAssertEqual(resolved.cacheble, true)
    XCTAssertEqual(resolved.account, "test.custom.account")
    XCTAssertEqual(resolved.encryptor, false)
  }

  func testCacheStrategyNoCacheMapsToCachebleFalse() async throws {
    let config: NSDictionary = [
      "cacheStrategy": "NO_CACHE"
    ]

    let id = RNPingStorageCommon.configureSessionStorage(config)
    let resolved = try await resolveSessionConfig(id)

    XCTAssertEqual(resolved.cacheble, false)
  }

  func testCacheStrategyCacheMapsToCachebleTrue() async throws {
    let config: NSDictionary = [
      "cacheStrategy": "CACHE"
    ]

    let id = RNPingStorageCommon.configureSessionStorage(config)
    let resolved = try await resolveSessionConfig(id)

    XCTAssertEqual(resolved.cacheble, true)
  }

  func testMultipleConfigsProduceDistinctIds() async throws {
    let config1: NSDictionary = ["account": "test.1"]
    let config2: NSDictionary = ["account": "test.2"]

    let id1 = RNPingStorageCommon.configureSessionStorage(config1)
    let id2 = RNPingStorageCommon.configureSessionStorage(config2)

    XCTAssertNotEqual(id1, id2)
  }

  private func resolveSessionConfig(_ id: String) async throws -> RNPingStorageCommon.StorageConfig {
    let handle = await CoreRuntime.sessionStorageConfigRegistry.resolve(id)
    let configHandle = try XCTUnwrap(handle as? RNPingStorageCommon.StorageConfigHandle)
    return configHandle.config
  }

  private func resolveOidcConfig(_ id: String) async throws -> RNPingStorageCommon.StorageConfig {
    let handle = await CoreRuntime.oidcStorageConfigRegistry.resolve(id)
    let configHandle = try XCTUnwrap(handle as? RNPingStorageCommon.StorageConfigHandle)
    return configHandle.config
  }
}
