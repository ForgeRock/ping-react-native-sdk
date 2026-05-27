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
    await CoreRuntime.bindingUserKeyStorageConfigRegistry.removeAll()
    await CoreRuntime.pushStorageConfigRegistry.removeAll()
  }

  override func tearDown() async throws {
    await CoreRuntime.sessionStorageConfigRegistry.removeAll()
    await CoreRuntime.oidcStorageConfigRegistry.removeAll()
    await CoreRuntime.bindingUserKeyStorageConfigRegistry.removeAll()
    await CoreRuntime.pushStorageConfigRegistry.removeAll()
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
    XCTAssertEqual(configDict["account"] as? String, "com.pingidentity.rnstorage.storage")
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

  func testRegisterSessionStorageIgnoresLoggerIdAndDoesNotPersistIt() throws {
    let config: NSDictionary = [
      "account": "test.session.config",
      "loggerId": "logger-1"
    ]

    let id = RNPingStorageCommon.registerSessionStorage(config)
    let configDict = RNPingStorageCommon.configureSessionStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertNil(configDict["loggerId"], "loggerId is a bridge-only value and should not be persisted")
  }

  // MARK: - Binding user-key storage

  func testConfigureBindingUserKeyStorageReturnsConfig() throws {
    let config: NSDictionary = ["account": "test.binding.config"]

    let id = RNPingStorageCommon.registerBindingUserKeyStorage(config)
    let configDict = RNPingStorageCommon.configureBindingUserKeyStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(configDict["account"] as? String, "test.binding.config")
  }

  func testConfigureBindingUserKeyStorageUsesDefaultValues() throws {
    let config: NSDictionary = [:]

    let id = RNPingStorageCommon.registerBindingUserKeyStorage(config)
    let configDict = RNPingStorageCommon.configureBindingUserKeyStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(configDict["account"] as? String, "com.pingidentity.rnstorage.storage")
    XCTAssertEqual(configDict["encryptor"] as? Bool, true)
  }

  func testConfigureBindingUserKeyStorageStoresAllValues() throws {
    let config: NSDictionary = [
      "cacheable": true,
      "account": "binding.custom.account",
      "encryptor": false
    ]

    let id = RNPingStorageCommon.registerBindingUserKeyStorage(config)
    let configDict = RNPingStorageCommon.configureBindingUserKeyStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(configDict["cacheable"] as? Bool, true)
    XCTAssertEqual(configDict["account"] as? String, "binding.custom.account")
    XCTAssertEqual(configDict["encryptor"] as? Bool, false)
  }

  // MARK: - Push storage

  func testConfigurePushStorageReturnsConfig() throws {
    let config: NSDictionary = ["account": "test.push.config"]

    let id = RNPingStorageCommon.registerPushStorage(config)
    let configDict = RNPingStorageCommon.configurePushStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(configDict["account"] as? String, "test.push.config")
  }

  func testConfigurePushStorageUsesDefaultValues() throws {
    let config: NSDictionary = [:]

    let id = RNPingStorageCommon.registerPushStorage(config)
    let configDict = RNPingStorageCommon.configurePushStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(configDict["account"] as? String, "com.pingidentity.rnstorage.storage")
    XCTAssertEqual(configDict["encryptor"] as? Bool, true)
  }

  func testConfigurePushStorageStoresAllValues() throws {
    let config: NSDictionary = [
      "cacheable": false,
      "account": "push.custom.account",
      "encryptor": true
    ]

    let id = RNPingStorageCommon.registerPushStorage(config)
    let configDict = RNPingStorageCommon.configurePushStorage(id)

    XCTAssertFalse(id.isEmpty)
    XCTAssertEqual(configDict["cacheable"] as? Bool, false)
    XCTAssertEqual(configDict["account"] as? String, "push.custom.account")
    XCTAssertEqual(configDict["encryptor"] as? Bool, true)
  }

  func testBindingUserKeyAndPushStorageRegistriesAreIndependent() throws {
    let bindingConfig: NSDictionary = ["account": "binding.account"]
    let pushConfig: NSDictionary = ["account": "push.account"]

    let bindingId = RNPingStorageCommon.registerBindingUserKeyStorage(bindingConfig)
    let pushId = RNPingStorageCommon.registerPushStorage(pushConfig)
    let bindingDict = RNPingStorageCommon.configureBindingUserKeyStorage(bindingId)
    let pushDict = RNPingStorageCommon.configurePushStorage(pushId)

    XCTAssertNotEqual(bindingId, pushId)
    XCTAssertEqual(bindingDict["account"] as? String, "binding.account")
    XCTAssertEqual(pushDict["account"] as? String, "push.account")
  }
}
