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
final class RNPingStorageImplTests: XCTestCase {

  var storageImpl: RNPingStorageImpl!

  override func setUp() async throws {
    try await super.setUp()
    storageImpl = RNPingStorageImpl.shared
    await CoreRuntime.sessionStorageConfigRegistry.removeAll()
    await CoreRuntime.oidcStorageConfigRegistry.removeAll()
  }

  override func tearDown() async throws {
    await CoreRuntime.sessionStorageConfigRegistry.removeAll()
    await CoreRuntime.oidcStorageConfigRegistry.removeAll()
    storageImpl = nil
    try await super.tearDown()
  }

  // MARK: - Singleton Tests

  func testSharedInstanceIsSingleton() {
    let instance1 = RNPingStorageImpl.shared
    let instance2 = RNPingStorageImpl.shared

    XCTAssertTrue(instance1 === instance2, "Shared instance should return the same singleton")
  }

  // MARK: - Configure Tests

  func testConfigureSessionStorageReturnsConfig() throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.impl.session.id"
    ]

    let id = storageImpl.registerSessionStorage(config)
    let configJson = storageImpl.configureSessionStorage(id)
    let resolved = try decodeConfig(configJson)

    XCTAssertFalse(id.isEmpty)
    XCTAssertFalse(configJson.isEmpty, "Configure session storage should return a non-empty config")
    XCTAssertEqual(resolved.account, "test.impl.session.id")
  }

  func testConfigureOidcStorageReturnsConfig() throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.impl.oidc.registry"
    ]

    let id = storageImpl.registerOidcStorage(config)
    let configJson = storageImpl.configureOidcStorage(id)
    let resolved = try decodeConfig(configJson)

    XCTAssertFalse(id.isEmpty)
    XCTAssertFalse(configJson.isEmpty, "Configure OIDC storage should return a non-empty config")
    XCTAssertEqual(resolved.account, "test.impl.oidc.registry")
  }

  private func decodeConfig(_ json: String) throws -> RNPingStorageCommon.StorageConfig {
    let data = try XCTUnwrap(json.data(using: .utf8))
    return try JSONDecoder().decode(RNPingStorageCommon.StorageConfig.self, from: data)
  }
}
