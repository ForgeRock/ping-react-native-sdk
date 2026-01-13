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
final class RNPingStorageCommonTests: XCTestCase {

  override func setUp() async throws {
    try await super.setUp()
    // Clear registries before each test
    await CoreRuntime.sessionStorageRegistry.removeAll()
    await CoreRuntime.oidcStorageRegistry.removeAll()
  }

  override func tearDown() async throws {
    // Clean up registries after each test
    await CoreRuntime.sessionStorageRegistry.removeAll()
    await CoreRuntime.oidcStorageRegistry.removeAll()
    try await super.tearDown()
  }

  // MARK: - Storage Handle Tests

  func testStorageHandleCreation() async throws {
    let storage = MemoryStorage<String>()
    let handle = RNPingStorageCommon.StorageHandle(storage)

    XCTAssertNotNil(handle)
    XCTAssertTrue(handle.storage is MemoryStorage<String>)
  }

  // MARK: - Configuration Tests

  func testConfigureMemoryStorageReturnsValidId() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.account"
    ]

    let id = RNPingStorageCommon.configureSessionStorage(config)

    XCTAssertFalse(id.isEmpty)
  }

  func testConfigureEncryptedStorageReturnsValidId() async throws {
    let config: NSDictionary = [
      "type": "encrypted",
      "account": "test.encrypted.account"
    ]

    let id = RNPingStorageCommon.configureSessionStorage(config)

    XCTAssertFalse(id.isEmpty)
  }

  func testConfigureWithCacheStrategyReturnsValidId() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.cache.account",
      "cacheStrategy": "CACHE"
    ]

    let id = RNPingStorageCommon.configureSessionStorage(config)

    XCTAssertFalse(id.isEmpty)
  }

  func testConfigureWithDatastoreTypeReturnsValidId() async throws {
    let config: NSDictionary = [
      "type": "datastore",
      "account": "test.datastore.account"
    ]

    let id = RNPingStorageCommon.configureSessionStorage(config)

    XCTAssertFalse(id.isEmpty)
  }
  
  func testConfigureOidcStorageReturnsValidId() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.oidc.account"
    ]

    let id = RNPingStorageCommon.configureOidcStorage(config)

    XCTAssertFalse(id.isEmpty)
  }
  
  func testConfigureOidcStorageRegistersInOidcRegistry() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.oidc.registry.account"
    ]

    let id = RNPingStorageCommon.configureOidcStorage(config)

    // Verify storage is registered in OIDC registry
    let resolved = await CoreRuntime.oidcStorageRegistry.resolve(id)
    XCTAssertNotNil(resolved)
    XCTAssertTrue(resolved is RNPingStorageCommon.StorageHandle)
  }
  
  func testConfigureOidcStorageNotInSessionRegistry() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.oidc.notsession.account"
    ]

    let id = RNPingStorageCommon.configureOidcStorage(config)

    // Verify storage is NOT in session registry
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    XCTAssertNil(resolved)
    
    // But IS in OIDC registry
    let oidcResolved = await CoreRuntime.oidcStorageRegistry.resolve(id)
    XCTAssertNotNil(oidcResolved)
  }
  
  // MARK: - Registry Integration Tests

  func testConfigureRegistersStorageInCoreRuntime() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.registry.account"
    ]

    let id = RNPingStorageCommon.configureSessionStorage(config)

    // Verify storage is registered
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    XCTAssertNotNil(resolved)
    XCTAssertTrue(resolved is RNPingStorageCommon.StorageHandle)
  }

  func testMultipleStorageInstancesProduceDistinctIds() async throws {
    let config1: NSDictionary = ["type": "memory", "account": "test.1"]
    let config2: NSDictionary = ["type": "memory", "account": "test.2"]

    let id1 = RNPingStorageCommon.configureSessionStorage(config1)
    let id2 = RNPingStorageCommon.configureSessionStorage(config2)

    XCTAssertNotEqual(id1, id2)
  }
  
  func testRegisteredStorageHandleContainsCorrectStorageType() async throws {
    let config: NSDictionary = ["type": "memory", "account": "test.handle.type"]
    let id = RNPingStorageCommon.configureSessionStorage(config)
    
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    XCTAssertNotNil(resolved)
    
    guard let handle = resolved as? RNPingStorageCommon.StorageHandle else {
      XCTFail("Resolved object should be a StorageHandle")
      return
    }
    
    XCTAssertTrue(handle.storage is MemoryStorage<String>)
  }
  
  func testCachedStorageIsWrappedInStorageDelegate() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.cached",
      "cacheStrategy": "CACHE"
    ]
    let id = RNPingStorageCommon.configureSessionStorage(config)
    
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    guard let handle = resolved as? RNPingStorageCommon.StorageHandle else {
      XCTFail("Resolved object should be a StorageHandle")
      return
    }
    
    XCTAssertTrue(handle.storage is StorageDelegate<String>)
  }
  
  // MARK: - Default Value Tests
  
  func testConfigureWithoutAccountUsesDefaultValue() async throws {
    let config: NSDictionary = [
      "type": "memory"
    ]
    
    let id = RNPingStorageCommon.configureSessionStorage(config)
    
    XCTAssertFalse(id.isEmpty)
    // Storage should be created successfully with default account
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    XCTAssertNotNil(resolved)
  }
  
  // MARK: - Encryptor Configuration Tests
  
  func testConfigureWithEncryptorFalseUsesNoEncryptor() async throws {
    let config: NSDictionary = [
      "type": "encrypted",
      "account": "test.no.encryptor",
      "encryptor": false
    ]
    
    let id = RNPingStorageCommon.configureSessionStorage(config)
    
    XCTAssertFalse(id.isEmpty)
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    XCTAssertNotNil(resolved)
    
    guard let handle = resolved as? RNPingStorageCommon.StorageHandle else {
      XCTFail("Resolved object should be a StorageHandle")
      return
    }
    
    XCTAssertTrue(handle.storage is KeychainStorage<String>)
  }
  
  func testConfigureEncryptedStorageWithEncryptorTrue() async throws {
    let config: NSDictionary = [
      "type": "encrypted",
      "account": "test.with.encryptor",
      "encryptor": true
    ]
    
    let id = RNPingStorageCommon.configureSessionStorage(config)
    
    XCTAssertFalse(id.isEmpty)
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    XCTAssertNotNil(resolved)
  }
  
  // MARK: - Case Sensitivity Tests
  
  func testConfigureWithMixedCaseStorageType() async throws {
    let configs: [NSDictionary] = [
      ["type": "Memory", "account": "test.mixed.1"],
      ["type": "ENCRYPTED", "account": "test.mixed.2"],
      ["type": "DataStore", "account": "test.mixed.3"],
      ["type": "DATASTORE", "account": "test.mixed.4"]
    ]
    
    for config in configs {
      let id = RNPingStorageCommon.configureSessionStorage(config)
      XCTAssertFalse(id.isEmpty)
      
      let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
      XCTAssertNotNil(resolved)
    }
  }
  
  func testConfigureWithLowercaseCacheStrategy() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.lowercase.cache",
      "cacheStrategy": "cache"
    ]
    
    let id = RNPingStorageCommon.configureSessionStorage(config)
    
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    guard let handle = resolved as? RNPingStorageCommon.StorageHandle else {
      XCTFail("Resolved object should be a StorageHandle")
      return
    }
    
    // Should be wrapped in StorageDelegate due to uppercased check
    XCTAssertTrue(handle.storage is StorageDelegate<String>)
  }
  
  func testConfigureWithMixedCaseCacheStrategy() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.mixedcase.cache",
      "cacheStrategy": "CaCHe"
    ]
    
    let id = RNPingStorageCommon.configureSessionStorage(config)
    
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    guard let handle = resolved as? RNPingStorageCommon.StorageHandle else {
      XCTFail("Resolved object should be a StorageHandle")
      return
    }
    
    // Should be wrapped in StorageDelegate due to uppercased check
    XCTAssertTrue(handle.storage is StorageDelegate<String>)
  }
  
  // MARK: - Non-Cache Strategy Tests
  
  func testConfigureWithNonCacheStrategyDoesNotWrap() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.no.cache.wrap",
      "cacheStrategy": "NO_CACHE"
    ]
    
    let id = RNPingStorageCommon.configureSessionStorage(config)
    
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    guard let handle = resolved as? RNPingStorageCommon.StorageHandle else {
      XCTFail("Resolved object should be a StorageHandle")
      return
    }
    
    // Should NOT be wrapped in StorageDelegate
    XCTAssertTrue(handle.storage is MemoryStorage<String>)
    XCTAssertTrue(type(of: handle.storage) == MemoryStorage<String>.self)
  }
  
  func testConfigureWithoutCacheStrategyDoesNotWrap() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.no.strategy"
    ]
    
    let id = RNPingStorageCommon.configureSessionStorage(config)
    
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    guard let handle = resolved as? RNPingStorageCommon.StorageHandle else {
      XCTFail("Resolved object should be a StorageHandle")
      return
    }
    
    // Should NOT be wrapped in StorageDelegate
    XCTAssertTrue(handle.storage is MemoryStorage<String>)
    XCTAssertTrue(type(of: handle.storage) == MemoryStorage<String>.self)
  }
  
  // MARK: - Registry Separation Tests
  
  func testConfigureSessionStorageNotInOidcRegistry() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": "test.session.nooidc"
    ]
    
    let id = RNPingStorageCommon.configureSessionStorage(config)
    
    // Verify storage is NOT in OIDC registry
    let oidcResolved = await CoreRuntime.oidcStorageRegistry.resolve(id)
    XCTAssertNil(oidcResolved)
    
    // But IS in session registry
    let sessionResolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    XCTAssertNotNil(sessionResolved)
  }
  
  // MARK: - Edge Cases
  
  func testConfigureWithEmptyAccount() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "account": ""
    ]
    
    let id = RNPingStorageCommon.configureSessionStorage(config)
    
    // Should still create storage with empty account string
    XCTAssertFalse(id.isEmpty)
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    XCTAssertNotNil(resolved)
  }
  
  func testConfigureMultipleEncryptedStoragesWithDifferentAccounts() async throws {
    let config1: NSDictionary = [
      "type": "encrypted",
      "account": "test.encrypted.1"
    ]
    let config2: NSDictionary = [
      "type": "encrypted",
      "account": "test.encrypted.2"
    ]
    
    let id1 = RNPingStorageCommon.configureSessionStorage(config1)
    let id2 = RNPingStorageCommon.configureSessionStorage(config2)
    
    XCTAssertNotEqual(id1, id2)
    
    let resolved1 = await CoreRuntime.sessionStorageRegistry.resolve(id1)
    let resolved2 = await CoreRuntime.sessionStorageRegistry.resolve(id2)
    
    XCTAssertNotNil(resolved1)
    XCTAssertNotNil(resolved2)
  }
  
  func testConfigureDatastoreWithCacheStrategy() async throws {
    let config: NSDictionary = [
      "type": "datastore",
      "account": "test.datastore.cached",
      "cacheStrategy": "CACHE"
    ]
    
    let id = RNPingStorageCommon.configureSessionStorage(config)
    
    let resolved = await CoreRuntime.sessionStorageRegistry.resolve(id)
    guard let handle = resolved as? RNPingStorageCommon.StorageHandle else {
      XCTFail("Resolved object should be a StorageHandle")
      return
    }
    
    // Should be wrapped in StorageDelegate
    XCTAssertTrue(handle.storage is StorageDelegate<String>)
  }

  
}
