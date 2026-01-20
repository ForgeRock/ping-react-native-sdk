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
    let configDict = storageImpl.configureSessionStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertFalse(configDict.allKeys.isEmpty, "Configure session storage should return a non-empty config")
    XCTAssertEqual(configDict["account"] as? String, "test.impl.session.id")
  }

  func testConfigureOidcStorageReturnsConfig() throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.impl.oidc.registry"
    ]

    let id = storageImpl.registerOidcStorage(config)
    let configDict = storageImpl.configureOidcStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertFalse(configDict.allKeys.isEmpty, "Configure OIDC storage should return a non-empty config")
    XCTAssertEqual(configDict["account"] as? String, "test.impl.oidc.registry")
  }
}
