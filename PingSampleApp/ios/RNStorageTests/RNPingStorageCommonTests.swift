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
    // Clear registry before each test
    await CoreRuntime.storageRegistry.removeAll()
  }

  override func tearDown() async throws {
    // Clean up registry after each test
    await CoreRuntime.storageRegistry.removeAll()
    try await super.tearDown()
  }

  // MARK: - Storage Handle Tests

  func testStorageHandleCreation() async throws {
    let storage = MemoryStorage<String>()
    let handle = RNPingStorageCommon.StorageHandle(storage)

    XCTAssertNotNil(handle)
    XCTAssertTrue(handle.storage is MemoryStorage<String>)
  }

  // MARK: - Create & Register Tests

  func testCreateMemoryStorageReturnsValidId() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "keyAlias": "test.keyalias"
    ]

    let id = RNPingStorageCommon.create(config)

    XCTAssertFalse(id.isEmpty)
  }

  func testCreateEncryptedStorageReturnsValidId() async throws {
    let config: NSDictionary = [
      "type": "encrypted",
      "keyAlias": "test.encrypted.keyalias"
    ]

    let id = RNPingStorageCommon.create(config)

    XCTAssertFalse(id.isEmpty)
  }

  func testCreateWithCacheStrategyReturnsValidId() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "keyAlias": "test.cache.keyalias",
      "cacheStrategy": "CACHE"
    ]

    let id = RNPingStorageCommon.create(config)

    XCTAssertFalse(id.isEmpty)
  }

  func testConfigureCreatesStorageInstance() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "keyAlias": "test.configure.keyalias"
    ]

    let id = RNPingStorageCommon.configure(config)

    XCTAssertFalse(id.isEmpty)
  }

  // MARK: - Registry Integration Tests

  func testCreateRegistersStorageInCoreRuntime() async throws {
    let config: NSDictionary = [
      "type": "memory",
      "keyAlias": "test.registry.keyalias"
    ]

    let id = RNPingStorageCommon.create(config)

    // Verify storage is registered
    let resolved = await CoreRuntime.storageRegistry.resolve(id)
    XCTAssertNotNil(resolved)
    XCTAssertTrue(resolved is RNPingStorageCommon.StorageHandle)
  }

  func testMultipleStorageInstancesProduceDistinctIds() async throws {
    let config1: NSDictionary = ["type": "memory", "keyAlias": "test.1"]
    let config2: NSDictionary = ["type": "memory", "keyAlias": "test.2"]

    let id1 = RNPingStorageCommon.create(config1)
    let id2 = RNPingStorageCommon.create(config2)

    XCTAssertNotEqual(id1, id2)
  }

  // MARK: - Save Tests

  func testSaveItemSuccess() async throws {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.save"]
    let id = RNPingStorageCommon.create(config)

    let item: NSDictionary = ["key": "value", "number": 42]

    let expectation = expectation(description: "Save completes")
    var saveSuccess = false

    RNPingStorageCommon.save(
      id,
      item: item,
      resolver: { success in
        saveSuccess = success
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("Save should not reject")
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertTrue(saveSuccess)
  }

  func testSaveWithInvalidIdRejects() async throws {
    let item: NSDictionary = ["key": "value"]

    let expectation = expectation(description: "Save rejects")
    var errorCode: String?

    RNPingStorageCommon.save(
      "invalid-id",
      item: item,
      resolver: { _ in
        XCTFail("Should not resolve with invalid id")
        expectation.fulfill()
      },
      rejecter: { code, _, _ in
        errorCode = code
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertEqual(errorCode, "E_SAVE_FAILED")
  }

  // MARK: - Get Tests

  func testGetItemReturnsNilWhenEmpty() async throws {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.get.empty"]
    let id = RNPingStorageCommon.create(config)

    let expectation = expectation(description: "Get completes")
    var retrievedItem: NSDictionary?

    RNPingStorageCommon.getItem(
      id,
      resolver: { item in
        retrievedItem = item
        expectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("Get should not reject")
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertNil(retrievedItem)
  }

  func testGetItemReturnsStoredData() async throws {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.get.data"]
    let id = RNPingStorageCommon.create(config)

    let savedItem: NSDictionary = ["key": "value", "number": 42]

    // First save
    let saveExpectation = expectation(description: "Save completes")
    RNPingStorageCommon.save(
      id,
      item: savedItem,
      resolver: { _ in saveExpectation.fulfill() },
      rejecter: { _, _, _ in saveExpectation.fulfill() }
    )
    await fulfillment(of: [saveExpectation], timeout: 2.0)

    // Then get
    let getExpectation = expectation(description: "Get completes")
    var retrievedItem: NSDictionary?

    RNPingStorageCommon.getItem(
      id,
      resolver: { item in
        retrievedItem = item
        getExpectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("Get should not reject")
        getExpectation.fulfill()
      }
    )

    await fulfillment(of: [getExpectation], timeout: 2.0)
    XCTAssertNotNil(retrievedItem)
    XCTAssertEqual(retrievedItem?["key"] as? String, "value")
    XCTAssertEqual(retrievedItem?["number"] as? Int, 42)
  }

  func testGetItemWithInvalidIdRejects() async throws {
    let expectation = expectation(description: "Get rejects")
    var errorCode: String?

    RNPingStorageCommon.getItem(
      "invalid-id",
      resolver: { _ in
        XCTFail("Should not resolve with invalid id")
        expectation.fulfill()
      },
      rejecter: { code, _, _ in
        errorCode = code
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertEqual(errorCode, "E_GET_FAILED")
  }

  // MARK: - Delete Tests

  func testDeleteItemSuccess() async throws {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.delete"]
    let id = RNPingStorageCommon.create(config)

    // First save an item
    let saveExpectation = expectation(description: "Save completes")
    RNPingStorageCommon.save(
      id,
      item: ["key": "value"],
      resolver: { _ in saveExpectation.fulfill() },
      rejecter: { _, _, _ in saveExpectation.fulfill() }
    )
    await fulfillment(of: [saveExpectation], timeout: 2.0)

    // Then delete
    let deleteExpectation = expectation(description: "Delete completes")
    var deleteSuccess = false

    RNPingStorageCommon.deleteItem(
      id,
      resolver: { success in
        deleteSuccess = success
        deleteExpectation.fulfill()
      },
      rejecter: { _, _, _ in
        XCTFail("Delete should not reject")
        deleteExpectation.fulfill()
      }
    )

    await fulfillment(of: [deleteExpectation], timeout: 2.0)
    XCTAssertTrue(deleteSuccess)

    // Verify item is removed from registry
    let resolved = await CoreRuntime.storageRegistry.resolve(id)
    XCTAssertNil(resolved)
  }

  func testDeleteItemRemovesFromRegistry() async throws {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.delete.registry"]
    let id = RNPingStorageCommon.create(config)

    // Verify initially registered
    let initialResolve = await CoreRuntime.storageRegistry.resolve(id)
    XCTAssertNotNil(initialResolve)

    // Delete
    let deleteExpectation = expectation(description: "Delete completes")
    RNPingStorageCommon.deleteItem(
      id,
      resolver: { _ in deleteExpectation.fulfill() },
      rejecter: { _, _, _ in deleteExpectation.fulfill() }
    )
    await fulfillment(of: [deleteExpectation], timeout: 2.0)

    // Verify removed from registry
    let afterResolve = await CoreRuntime.storageRegistry.resolve(id)
    XCTAssertNil(afterResolve)
  }

  func testDeleteItemWithInvalidIdRejects() async throws {
    let expectation = expectation(description: "Delete rejects")
    var errorCode: String?

    RNPingStorageCommon.deleteItem(
      "invalid-id",
      resolver: { _ in
        XCTFail("Should not resolve with invalid id")
        expectation.fulfill()
      },
      rejecter: { code, _, _ in
        errorCode = code
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertEqual(errorCode, "E_DELETE_FAILED")
  }

  // MARK: - Integration Tests

  func testFullStorageLifecycle() async throws {
    // Create
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.lifecycle"]
    let id = RNPingStorageCommon.create(config)
    XCTAssertFalse(id.isEmpty)

    // Save
    let saveExpectation = expectation(description: "Save completes")
    var saveSuccess = false
    RNPingStorageCommon.save(
      id,
      item: ["data": "test"],
      resolver: { success in
        saveSuccess = success
        saveExpectation.fulfill()
      },
      rejecter: { _, _, _ in saveExpectation.fulfill() }
    )
    await fulfillment(of: [saveExpectation], timeout: 2.0)
    XCTAssertTrue(saveSuccess)

    // Get
    let getExpectation = expectation(description: "Get completes")
    var retrievedItem: NSDictionary?
    RNPingStorageCommon.getItem(
      id,
      resolver: { item in
        retrievedItem = item
        getExpectation.fulfill()
      },
      rejecter: { _, _, _ in getExpectation.fulfill() }
    )
    await fulfillment(of: [getExpectation], timeout: 2.0)
    XCTAssertNotNil(retrievedItem)
    XCTAssertEqual(retrievedItem?["data"] as? String, "test")

    // Delete
    let deleteExpectation = expectation(description: "Delete completes")
    var deleteSuccess = false
    RNPingStorageCommon.deleteItem(
      id,
      resolver: { success in
        deleteSuccess = success
        deleteExpectation.fulfill()
      },
      rejecter: { _, _, _ in deleteExpectation.fulfill() }
    )
    await fulfillment(of: [deleteExpectation], timeout: 2.0)
    XCTAssertTrue(deleteSuccess)

    // Verify removed
    let resolved = await CoreRuntime.storageRegistry.resolve(id)
    XCTAssertNil(resolved)
  }
}
