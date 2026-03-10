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


final class RNPingStorageCommonTests: XCTestCase {

  override func setUp() async throws {
    try await super.setUp()
    await CoreRuntime.sessionStorageConfigRegistry.removeAll()
    await CoreRuntime.oidcStorageConfigRegistry.removeAll()
    RNPingStorageCommon._testResetApplyLogger()
  }

  override func tearDown() async throws {
    await CoreRuntime.sessionStorageConfigRegistry.removeAll()
    await CoreRuntime.oidcStorageConfigRegistry.removeAll()
    RNPingStorageCommon._testResetApplyLogger()
    try await super.tearDown()
  }

  func testConfigureSessionStorageReturnsConfig() throws {
    let config: NSDictionary = ["account": "test.session.config"]

    let id = RNPingStorageCommon.registerSessionStorage(config)
    let configDict = RNPingStorageCommon.configureSessionStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertFalse(configDict.allKeys.isEmpty)
    XCTAssertEqual(configDict["account"] as? String, "test.session.config")
  }

  func testConfigureOidcStorageReturnsConfig() throws {
    let config: NSDictionary = ["account": "test.oidc.config"]

    let id = RNPingStorageCommon.registerOidcStorage(config)
    let configDict = RNPingStorageCommon.configureOidcStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertFalse(configDict.allKeys.isEmpty)
    XCTAssertEqual(configDict["account"] as? String, "test.oidc.config")
  }

  func testConfigureUsesDefaultValues() throws {
    let config: NSDictionary = [:]

    let id = RNPingStorageCommon.registerSessionStorage(config)
    let configDict = RNPingStorageCommon.configureSessionStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(configDict["account"] as? String, "com.pingidentity.rnsampleapp.keyalias")
    XCTAssertEqual(configDict["encryptor"] as? Bool, true)
  }

  func testConfigureStoresProvidedValues() throws {
    let config: NSDictionary = [
      "cacheable": true,
      "account": "test.custom.account",
      "encryptor": false
    ]

    let id = RNPingStorageCommon.registerSessionStorage(config)
    let configDict = RNPingStorageCommon.configureSessionStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(configDict["cacheable"] as? Bool, true)
    XCTAssertEqual(configDict["account"] as? String, "test.custom.account")
    XCTAssertEqual(configDict["encryptor"] as? Bool, false)
  }

  func testCacheableFalseStored() throws {
    let config: NSDictionary = [
      "cacheable": false
    ]

    let id = RNPingStorageCommon.registerSessionStorage(config)
    let configDict = RNPingStorageCommon.configureSessionStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(configDict["cacheable"] as? Bool, false)
  }

  func testCacheableTrueStored() throws {
    let config: NSDictionary = [
      "cacheable": true
    ]

    let id = RNPingStorageCommon.registerSessionStorage(config)
    let configDict = RNPingStorageCommon.configureSessionStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(configDict["cacheable"] as? Bool, true)
  }

  func testMultipleConfigsProduceDistinctOutputs() throws {
    let config1: NSDictionary = ["account": "test.1"]
    let config2: NSDictionary = ["account": "test.2"]

    let id1 = RNPingStorageCommon.registerSessionStorage(config1)
    let id2 = RNPingStorageCommon.registerSessionStorage(config2)
    let configDict1 = RNPingStorageCommon.configureSessionStorage(id1)
    let configDict2 = RNPingStorageCommon.configureSessionStorage(id2)

    XCTAssertFalse(id1.isEmpty)
    XCTAssertFalse(id2.isEmpty)
    XCTAssertNotEqual(configDict1["account"] as? String, configDict2["account"] as? String)
  }

  func testRegisterSessionStorageAppliesLoggerIdWhenProvided() throws {
    var capturedLoggerId: String?
    RNPingStorageCommon._testSetApplyLogger { id in
      capturedLoggerId = id
      return true
    }
    let config: NSDictionary = [
      "account": "test.session.config",
      "loggerId": "logger-1"
    ]

    let id = RNPingStorageCommon.registerSessionStorage(config)
    let configDict = RNPingStorageCommon.configureSessionStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(capturedLoggerId, "logger-1")
    XCTAssertNil(configDict["loggerId"], "loggerId is a bridge-only value and should not be persisted")
  }
}
