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
    // Clear registry before each test
    await CoreRuntime.storageRegistry.removeAll()
  }

  override func tearDown() async throws {
    // Clean up registry after each test
    await CoreRuntime.storageRegistry.removeAll()
    storageImpl = nil
    try await super.tearDown()
  }

  // MARK: - Singleton Tests

  func testSharedInstanceIsSingleton() {
    let instance1 = RNPingStorageImpl.shared
    let instance2 = RNPingStorageImpl.shared

    XCTAssertTrue(instance1 === instance2, "Shared instance should return the same singleton")
  }

  func testSharedInstanceIsNotNil() {
    XCTAssertNotNil(RNPingStorageImpl.shared, "Shared instance should not be nil")
  }

  // MARK: - Configure Tests

  func testConfigureWithMemoryStorageReturnsValidId() {
    let config: NSDictionary = [
      "type": "memory",
      "keyAlias": "test.impl.memory"
    ]

    let id = storageImpl.configure(config)

    XCTAssertFalse(id.isEmpty, "Configure should return a non-empty storage ID")
    XCTAssertGreaterThan(id.count, 0, "Storage ID should have length")
  }

  func testConfigureWithEncryptedStorageReturnsValidId() {
    let config: NSDictionary = [
      "type": "encrypted",
      "keyAlias": "test.impl.encrypted"
    ]

    let id = storageImpl.configure(config)

    XCTAssertFalse(id.isEmpty, "Configure should return a non-empty storage ID for encrypted storage")
  }

  func testConfigureWithCacheStrategyReturnsValidId() {
    let config: NSDictionary = [
      "type": "memory",
      "keyAlias": "test.impl.cache",
      "cacheStrategy": "CACHE"
    ]

    let id = storageImpl.configure(config)

    XCTAssertFalse(id.isEmpty, "Configure should handle cache strategy configuration")
  }

  func testConfigureMultipleTimesProducesDistinctIds() {
    let config1: NSDictionary = ["type": "memory", "keyAlias": "test.impl.1"]
    let config2: NSDictionary = ["type": "memory", "keyAlias": "test.impl.2"]

    let id1 = storageImpl.configure(config1)
    let id2 = storageImpl.configure(config2)

    XCTAssertNotEqual(id1, id2, "Each configure call should produce a distinct storage ID")
  }

  func testConfigureRegistersStorageInstance() async {
    let config: NSDictionary = [
      "type": "memory",
      "keyAlias": "test.impl.registry"
    ]

    let id = storageImpl.configure(config)

    // Verify storage is registered in CoreRuntime
    let resolved = await CoreRuntime.storageRegistry.resolve(id)
    XCTAssertNotNil(resolved, "Configured storage should be registered in CoreRuntime")
  }

  // MARK: - Save Tests

  func testSaveWithValidIdResolves() async {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.impl.save"]
    let id = storageImpl.configure(config)

    let item: NSDictionary = ["key": "value", "number": 42]
    let expectation = expectation(description: "Save should resolve")
    var saveResult: Bool = false

    storageImpl.save(
      id,
      item: item,
      resolver: { success in
        saveResult = success as? Bool ?? false
        expectation.fulfill()
      },
      rejecter: { code, message, error in
        XCTFail("Save should not reject: \(message)")
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertTrue(saveResult, "Save should return true on success")
  }

  func testSaveWithInvalidIdRejects() async {
    let item: NSDictionary = ["key": "value"]
    let expectation = expectation(description: "Save should reject with invalid ID")
    var errorCode: String?
    var errorMessage: String?

    storageImpl.save(
      "invalid-storage-id",
      item: item,
      resolver: { _ in
        XCTFail("Save should not resolve with invalid ID")
        expectation.fulfill()
      },
      rejecter: { code, message, error in
        errorCode = code
        errorMessage = message
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertEqual(errorCode, "E_SAVE_FAILED", "Error code should be E_SAVE_FAILED")
    XCTAssertNotNil(errorMessage, "Error message should be provided")
  }

  func testSaveWithEmptyDictionary() async {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.impl.save.empty"]
    let id = storageImpl.configure(config)

    let item: NSDictionary = [:]
    let expectation = expectation(description: "Save should handle empty dictionary")
    var saveResult: Bool = false

    storageImpl.save(
      id,
      item: item,
      resolver: { success in
        saveResult = success as? Bool ?? false
        expectation.fulfill()
      },
      rejecter: { code, message, error in
        XCTFail("Save should not reject with empty dictionary: \(message)")
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertTrue(saveResult, "Save should succeed with empty dictionary")
  }

  func testSaveWithComplexNestedData() async {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.impl.save.complex"]
    let id = storageImpl.configure(config)

    let item: NSDictionary = [
      "string": "test",
      "number": 123,
      "boolean": true,
      "array": [1, 2, 3],
      "nested": ["inner": "value", "innerNumber": 456]
    ]
    let expectation = expectation(description: "Save should handle complex data")
    var saveResult: Bool = false

    storageImpl.save(
      id,
      item: item,
      resolver: { success in
        saveResult = success as? Bool ?? false
        expectation.fulfill()
      },
      rejecter: { code, message, error in
        XCTFail("Save should not reject with complex data: \(message)")
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertTrue(saveResult, "Save should succeed with complex nested data")
  }

  func testSaveOverwritesPreviousData() async {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.impl.save.overwrite"]
    let id = storageImpl.configure(config)

    // First save
    let item1: NSDictionary = ["version": 1]
    let saveExpectation1 = expectation(description: "First save should complete")

    storageImpl.save(
      id,
      item: item1,
      resolver: { _ in saveExpectation1.fulfill() },
      rejecter: { _, message, _ in
        XCTFail("First save failed: \(message)")
        saveExpectation1.fulfill()
      }
    )
    await fulfillment(of: [saveExpectation1], timeout: 2.0)

    // Second save (overwrite)
    let item2: NSDictionary = ["version": 2]
    let saveExpectation2 = expectation(description: "Second save should complete")

    storageImpl.save(
      id,
      item: item2,
      resolver: { _ in saveExpectation2.fulfill() },
      rejecter: { _, message, _ in
        XCTFail("Second save failed: \(message)")
        saveExpectation2.fulfill()
      }
    )
    await fulfillment(of: [saveExpectation2], timeout: 2.0)

    // Verify the latest data
    let getExpectation = expectation(description: "Get should return latest data")
    var retrievedItem: NSDictionary?

    storageImpl.getItem(
      id,
      resolver: { item in
        retrievedItem = item as? NSDictionary
        getExpectation.fulfill()
      },
      rejecter: { _, message, _ in
        XCTFail("Get failed: \(message)")
        getExpectation.fulfill()
      }
    )
    await fulfillment(of: [getExpectation], timeout: 2.0)

    XCTAssertNotNil(retrievedItem, "Retrieved item should not be nil")
    XCTAssertEqual(retrievedItem?["version"] as? Int, 2, "Should retrieve the latest saved version")
  }

  // MARK: - Get Tests

  func testGetItemWithValidIdResolves() async {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.impl.get"]
    let id = storageImpl.configure(config)

    // First save data
    let savedItem: NSDictionary = ["key": "value", "number": 42]
    let saveExpectation = expectation(description: "Save should complete")

    storageImpl.save(
      id,
      item: savedItem,
      resolver: { _ in saveExpectation.fulfill() },
      rejecter: { _, message, _ in
        XCTFail("Save failed: \(message)")
        saveExpectation.fulfill()
      }
    )
    await fulfillment(of: [saveExpectation], timeout: 2.0)

    // Then get
    let getExpectation = expectation(description: "Get should resolve")
    var retrievedItem: NSDictionary?

    storageImpl.getItem(
      id,
      resolver: { item in
        retrievedItem = item as? NSDictionary
        getExpectation.fulfill()
      },
      rejecter: { code, message, error in
        XCTFail("Get should not reject: \(message)")
        getExpectation.fulfill()
      }
    )

    await fulfillment(of: [getExpectation], timeout: 2.0)
    XCTAssertNotNil(retrievedItem, "Retrieved item should not be nil")
    XCTAssertEqual(retrievedItem?["key"] as? String, "value", "Retrieved value should match saved value")
    XCTAssertEqual(retrievedItem?["number"] as? Int, 42, "Retrieved number should match saved number")
  }

  func testGetItemReturnsNilWhenEmpty() async {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.impl.get.empty"]
    let id = storageImpl.configure(config)

    let expectation = expectation(description: "Get should resolve with nil")
    var retrievedItem: NSDictionary?

    storageImpl.getItem(
      id,
      resolver: { item in
        retrievedItem = item as? NSDictionary
        expectation.fulfill()
      },
      rejecter: { code, message, error in
        XCTFail("Get should not reject when empty: \(message)")
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertNil(retrievedItem, "Retrieved item should be nil when storage is empty")
  }

  func testGetItemWithInvalidIdRejects() async {
    let expectation = expectation(description: "Get should reject with invalid ID")
    var errorCode: String?
    var errorMessage: String?

    storageImpl.getItem(
      "invalid-storage-id",
      resolver: { _ in
        XCTFail("Get should not resolve with invalid ID")
        expectation.fulfill()
      },
      rejecter: { code, message, error in
        errorCode = code
        errorMessage = message
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertEqual(errorCode, "E_GET_FAILED", "Error code should be E_GET_FAILED")
    XCTAssertNotNil(errorMessage, "Error message should be provided")
  }

  func testGetItemPreservesDataTypes() async {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.impl.get.types"]
    let id = storageImpl.configure(config)

    let savedItem: NSDictionary = [
      "string": "test",
      "integer": 123,
      "double": 45.67,
      "boolean": true,
      "array": [1, 2, 3],
      "nested": ["key": "value"]
    ]

    // Save
    let saveExpectation = expectation(description: "Save should complete")
    storageImpl.save(
      id,
      item: savedItem,
      resolver: { _ in saveExpectation.fulfill() },
      rejecter: { _, message, _ in
        XCTFail("Save failed: \(message)")
        saveExpectation.fulfill()
      }
    )
    await fulfillment(of: [saveExpectation], timeout: 2.0)

    // Get
    let getExpectation = expectation(description: "Get should complete")
    var retrievedItem: NSDictionary?

    storageImpl.getItem(
      id,
      resolver: { item in
        retrievedItem = item as? NSDictionary
        getExpectation.fulfill()
      },
      rejecter: { _, message, _ in
        XCTFail("Get failed: \(message)")
        getExpectation.fulfill()
      }
    )
    await fulfillment(of: [getExpectation], timeout: 2.0)

    XCTAssertNotNil(retrievedItem)
    XCTAssertEqual(retrievedItem?["string"] as? String, "test")
    XCTAssertEqual(retrievedItem?["integer"] as? Int, 123)
    if let doubleValue = retrievedItem?["double"] as? Double {
      XCTAssertEqual(doubleValue, 45.67, accuracy: 0.001)
    } else {
      XCTFail("Expected double value to be present")
    }
    XCTAssertEqual(retrievedItem?["boolean"] as? Bool, true)
    XCTAssertNotNil(retrievedItem?["array"] as? [Int])
    XCTAssertNotNil(retrievedItem?["nested"] as? [String: String])
  }

  // MARK: - Delete Tests

  func testDeleteItemWithValidIdResolves() async {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.impl.delete"]
    let id = storageImpl.configure(config)

    // First save data
    let saveExpectation = expectation(description: "Save should complete")
    storageImpl.save(
      id,
      item: ["key": "value"],
      resolver: { _ in saveExpectation.fulfill() },
      rejecter: { _, message, _ in
        XCTFail("Save failed: \(message)")
        saveExpectation.fulfill()
      }
    )
    await fulfillment(of: [saveExpectation], timeout: 2.0)

    // Then delete
    let deleteExpectation = expectation(description: "Delete should resolve")
    var deleteResult: Bool = false

    storageImpl.deleteItem(
      id,
      resolver: { success in
        deleteResult = success as? Bool ?? false
        deleteExpectation.fulfill()
      },
      rejecter: { code, message, error in
        XCTFail("Delete should not reject: \(message)")
        deleteExpectation.fulfill()
      }
    )

    await fulfillment(of: [deleteExpectation], timeout: 2.0)
    XCTAssertTrue(deleteResult, "Delete should return true on success")
  }

  func testDeleteItemRemovesFromRegistry() async {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.impl.delete.registry"]
    let id = storageImpl.configure(config)

    // Verify initially registered
    let initialResolve = await CoreRuntime.storageRegistry.resolve(id)
    XCTAssertNotNil(initialResolve, "Storage should be registered initially")

    // Delete
    let deleteExpectation = expectation(description: "Delete should complete")
    storageImpl.deleteItem(
      id,
      resolver: { _ in deleteExpectation.fulfill() },
      rejecter: { _, message, _ in
        XCTFail("Delete failed: \(message)")
        deleteExpectation.fulfill()
      }
    )
    await fulfillment(of: [deleteExpectation], timeout: 2.0)

    // Verify removed from registry
    let afterResolve = await CoreRuntime.storageRegistry.resolve(id)
    XCTAssertNil(afterResolve, "Storage should be removed from registry after delete")
  }

  func testDeleteItemWithInvalidIdRejects() async {
    let expectation = expectation(description: "Delete should reject with invalid ID")
    var errorCode: String?
    var errorMessage: String?

    storageImpl.deleteItem(
      "invalid-storage-id",
      resolver: { _ in
        XCTFail("Delete should not resolve with invalid ID")
        expectation.fulfill()
      },
      rejecter: { code, message, error in
        errorCode = code
        errorMessage = message
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertEqual(errorCode, "E_DELETE_FAILED", "Error code should be E_DELETE_FAILED")
    XCTAssertNotNil(errorMessage, "Error message should be provided")
  }

  func testDeleteItemClearsStoredData() async {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.impl.delete.data"]
    let id = storageImpl.configure(config)

    // Save data
    let saveExpectation = expectation(description: "Save should complete")
    storageImpl.save(
      id,
      item: ["key": "value"],
      resolver: { _ in saveExpectation.fulfill() },
      rejecter: { _, message, _ in
        XCTFail("Save failed: \(message)")
        saveExpectation.fulfill()
      }
    )
    await fulfillment(of: [saveExpectation], timeout: 2.0)

    // Delete
    let deleteExpectation = expectation(description: "Delete should complete")
    storageImpl.deleteItem(
      id,
      resolver: { _ in deleteExpectation.fulfill() },
      rejecter: { _, message, _ in
        XCTFail("Delete failed: \(message)")
        deleteExpectation.fulfill()
      }
    )
    await fulfillment(of: [deleteExpectation], timeout: 2.0)

    // Verify data is removed (getting should fail since storage is removed from registry)
    let getExpectation = expectation(description: "Get should reject after delete")
    var getErrorOccurred = false

    storageImpl.getItem(
      id,
      resolver: { _ in
        getExpectation.fulfill()
      },
      rejecter: { _, _, _ in
        getErrorOccurred = true
        getExpectation.fulfill()
      }
    )
    await fulfillment(of: [getExpectation], timeout: 2.0)

    XCTAssertTrue(getErrorOccurred, "Get should fail after storage is deleted")
  }

  // MARK: - Integration Tests

  func testFullStorageLifecycle() async {
    let config: NSDictionary = ["type": "memory", "keyAlias": "test.impl.lifecycle"]

    // Configure
    let id = storageImpl.configure(config)
    XCTAssertFalse(id.isEmpty, "Configure should return valid ID")

    // Save
    let saveExpectation = expectation(description: "Save should complete")
    var saveSuccess = false
    storageImpl.save(
      id,
      item: ["data": "lifecycle-test", "counter": 42],
      resolver: { success in
        saveSuccess = success as? Bool ?? false
        saveExpectation.fulfill()
      },
      rejecter: { _, message, _ in
        XCTFail("Save failed: \(message)")
        saveExpectation.fulfill()
      }
    )
    await fulfillment(of: [saveExpectation], timeout: 2.0)
    XCTAssertTrue(saveSuccess)

    // Get
    let getExpectation = expectation(description: "Get should complete")
    var retrievedItem: NSDictionary?
    storageImpl.getItem(
      id,
      resolver: { item in
        retrievedItem = item as? NSDictionary
        getExpectation.fulfill()
      },
      rejecter: { _, message, _ in
        XCTFail("Get failed: \(message)")
        getExpectation.fulfill()
      }
    )
    await fulfillment(of: [getExpectation], timeout: 2.0)
    XCTAssertNotNil(retrievedItem)
    XCTAssertEqual(retrievedItem?["data"] as? String, "lifecycle-test")
    XCTAssertEqual(retrievedItem?["counter"] as? Int, 42)

    // Delete
    let deleteExpectation = expectation(description: "Delete should complete")
    var deleteSuccess = false
    storageImpl.deleteItem(
      id,
      resolver: { success in
        deleteSuccess = success as? Bool ?? false
        deleteExpectation.fulfill()
      },
      rejecter: { _, message, _ in
        XCTFail("Delete failed: \(message)")
        deleteExpectation.fulfill()
      }
    )
    await fulfillment(of: [deleteExpectation], timeout: 2.0)
    XCTAssertTrue(deleteSuccess)

    // Verify removed
    let resolved = await CoreRuntime.storageRegistry.resolve(id)
    XCTAssertNil(resolved, "Storage should be removed from registry")
  }

  func testMultipleStorageInstances() async {
    let config1: NSDictionary = ["type": "memory", "keyAlias": "test.impl.multi.1"]
    let config2: NSDictionary = ["type": "memory", "keyAlias": "test.impl.multi.2"]

    let id1 = storageImpl.configure(config1)
    let id2 = storageImpl.configure(config2)

    XCTAssertNotEqual(id1, id2, "Different configs should produce different IDs")

    // Save different data to each
    let save1Expectation = expectation(description: "Save to storage 1")
    storageImpl.save(
      id1,
      item: ["storage": "first"],
      resolver: { _ in save1Expectation.fulfill() },
      rejecter: { _, message, _ in
        XCTFail("Save 1 failed: \(message)")
        save1Expectation.fulfill()
      }
    )

    let save2Expectation = expectation(description: "Save to storage 2")
    storageImpl.save(
      id2,
      item: ["storage": "second"],
      resolver: { _ in save2Expectation.fulfill() },
      rejecter: { _, message, _ in
        XCTFail("Save 2 failed: \(message)")
        save2Expectation.fulfill()
      }
    )

    await fulfillment(of: [save1Expectation, save2Expectation], timeout: 2.0)

    // Verify each storage has its own data
    let get1Expectation = expectation(description: "Get from storage 1")
    var item1: NSDictionary?
    storageImpl.getItem(
      id1,
      resolver: { item in
        item1 = item as? NSDictionary
        get1Expectation.fulfill()
      },
      rejecter: { _, message, _ in
        XCTFail("Get 1 failed: \(message)")
        get1Expectation.fulfill()
      }
    )

    let get2Expectation = expectation(description: "Get from storage 2")
    var item2: NSDictionary?
    storageImpl.getItem(
      id2,
      resolver: { item in
        item2 = item as? NSDictionary
        get2Expectation.fulfill()
      },
      rejecter: { _, message, _ in
        XCTFail("Get 2 failed: \(message)")
        get2Expectation.fulfill()
      }
    )

    await fulfillment(of: [get1Expectation, get2Expectation], timeout: 2.0)

    XCTAssertEqual(item1?["storage"] as? String, "first")
    XCTAssertEqual(item2?["storage"] as? String, "second")
  }

  // MARK: - Error Handling Tests

  func testSaveErrorPropagatesCorrectly() async {
    let expectation = expectation(description: "Error should propagate")
    var didReject = false
    var errorCode: String?

    storageImpl.save(
      "non-existent-id",
      item: ["key": "value"],
      resolver: { _ in
        XCTFail("Should not resolve")
        expectation.fulfill()
      },
      rejecter: { code, message, error in
        didReject = true
        errorCode = code
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertTrue(didReject)
    XCTAssertNotNil(errorCode)
  }

  func testGetErrorPropagatesCorrectly() async {
    let expectation = expectation(description: "Error should propagate")
    var didReject = false
    var errorCode: String?

    storageImpl.getItem(
      "non-existent-id",
      resolver: { _ in
        XCTFail("Should not resolve")
        expectation.fulfill()
      },
      rejecter: { code, message, error in
        didReject = true
        errorCode = code
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertTrue(didReject)
    XCTAssertNotNil(errorCode)
  }

  func testDeleteErrorPropagatesCorrectly() async {
    let expectation = expectation(description: "Error should propagate")
    var didReject = false
    var errorCode: String?

    storageImpl.deleteItem(
      "non-existent-id",
      resolver: { _ in
        XCTFail("Should not resolve")
        expectation.fulfill()
      },
      rejecter: { code, message, error in
        didReject = true
        errorCode = code
        expectation.fulfill()
      }
    )

    await fulfillment(of: [expectation], timeout: 2.0)
    XCTAssertTrue(didReject)
    XCTAssertNotNil(errorCode)
  }

  // MARK: - Thread Safety Tests

  func testConcurrentOperationsOnDifferentStorages() async {
    let configs = (1...5).map { i in
      ["type": "memory", "keyAlias": "test.impl.concurrent.\(i)"] as NSDictionary
    }

    let ids = configs.map { storageImpl.configure($0) }

    // Perform concurrent saves
    let expectations = ids.enumerated().map { index, id in
      let exp = expectation(description: "Concurrent save \(index)")
      storageImpl.save(
        id,
        item: ["index": index],
        resolver: { _ in exp.fulfill() },
        rejecter: { _, message, _ in
          XCTFail("Concurrent save \(index) failed: \(message)")
          exp.fulfill()
        }
      )
      return exp
    }

    await fulfillment(of: expectations, timeout: 5.0)

    // Verify all saved correctly
    let getExpectations = ids.enumerated().map { index, id in
      let exp = expectation(description: "Concurrent get \(index)")
      storageImpl.getItem(
        id,
        resolver: { item in
          XCTAssertEqual((item as? NSDictionary)?["index"] as? Int, index)
          exp.fulfill()
        },
        rejecter: { _, message, _ in
          XCTFail("Concurrent get \(index) failed: \(message)")
          exp.fulfill()
        }
      )
      return exp
    }

    await fulfillment(of: getExpectations, timeout: 5.0)
  }
}
