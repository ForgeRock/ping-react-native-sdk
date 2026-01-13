/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingStorage
@testable import RNPingCore
@testable import RNPingStorage

@available(iOS 16.0, *)
final class RNPingStorageImplTests: XCTestCase {

  var storageImpl: RNPingStorageImpl!

  override func setUp() async throws {
    try await super.setUp()
    storageImpl = RNPingStorageImpl.shared
    // Clear registries before each test
    await CoreRuntime.sessionStorageRegistry.removeAll()
    await CoreRuntime.oidcStorageRegistry.removeAll()
  }

  override func tearDown() async throws {
    // Clean up registries after each test
    await CoreRuntime.sessionStorageRegistry.removeAll()
    await CoreRuntime.oidcStorageRegistry.removeAll()
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

  func testConfigureRegistersStorageInstance() async {
    let config: NSDictionary = [
      "type": "memory",
      "keyAlias": "test.impl.registry"
    ]

    let id = storageImpl.configureSessionStorage(config)

    // Verify storage is registered in CoreRuntime
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    XCTAssertNotNil(resolved, "Configured storage should be registered in CoreRuntime")
  }

  // MARK: - Session Storage Tests

  func testConfigureSessionStorageReturnsValidId() {
    let config: NSDictionary = [
      "type": "memory",
      "keyAlias": "test.impl.session.id"
    ]

    let id = storageImpl.configureSessionStorage(config)

    XCTAssertFalse(id.isEmpty, "Configure session storage should return a non-empty storage ID")
  }

  func testConfigureSessionStorageDoesNotRegisterInOidcRegistry() async {
    let config: NSDictionary = [
      "type": "memory",
      "keyAlias": "test.impl.session.oidc.separation"
    ]

    let id = storageImpl.configureSessionStorage(config)

    let oidcResolved = await CoreRuntime.oidcStorageRegistry.resolve(id)
    XCTAssertNil(oidcResolved, "Session storage should not be registered in OIDC registry")
  }

  // MARK: - OIDC Storage Tests

  func testConfigureOidcStorageRegistersInOidcRegistry() async {
    let config: NSDictionary = [
      "type": "memory",
      "keyAlias": "test.impl.oidc.registry"
    ]

    let id = storageImpl.configureOidcStorage(config)

    // Verify storage is registered in OIDC registry
    let resolved = await CoreRuntime.oidcStorageRegistry.resolve(id)
    XCTAssertNotNil(resolved, "Configured OIDC storage should be registered in OIDC registry")
  }

}
