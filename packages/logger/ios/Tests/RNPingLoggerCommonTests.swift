/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingCore
@testable import RNPingLogger


final class RNPingLoggerCommonTests: XCTestCase {

  override func setUp() async throws {
    try await super.setUp()
    await CoreRuntime.loggerRegistry.removeAll()
    RNPingLoggerCommon._testReset()
  }

  override func tearDown() async throws {
    await CoreRuntime.loggerRegistry.removeAll()
    RNPingLoggerCommon._testReset()
    try await super.tearDown()
  }

  func testSyncCreatesRegistryEntry() async {
    let config: NSDictionary = [
      "id": "js.logger.1",
      "level": "STANDARD"
    ]

    RNPingLoggerCommon.sync(config)

    let registryId = await waitForRegistryId("js.logger.1")
    XCTAssertNotNil(registryId, "sync should create a registry entry")

    if let registryId = registryId {
      let handle = await waitForHandle(registryId)
      XCTAssertEqual(handle?.level, "STANDARD", "sync should store the provided level")
    }
  }

  func testSyncUpdatesExistingHandle() async {
    let firstConfig: NSDictionary = [
      "id": "js.logger.2",
      "level": "STANDARD"
    ]

    RNPingLoggerCommon.sync(firstConfig)
    let registryId = await waitForRegistryId("js.logger.2")
    XCTAssertNotNil(registryId, "sync should register the initial handle")

    if let registryId = registryId {
      let updatedConfig: NSDictionary = [
        "id": "js.logger.2",
        "level": "WARN"
      ]

      RNPingLoggerCommon.sync(updatedConfig)
      let handle = await waitForHandleLevel(registryId, expectedLevel: "WARN")
      XCTAssertEqual(handle?.level, "WARN", "sync should update the level on existing handle")
    }
  }

  func testSyncWithMissingFieldsDoesNotRegister() async {
    let config: NSDictionary = ["level": "STANDARD"]

    RNPingLoggerCommon.sync(config)

    let registryId = await waitForRegistryId("missing-id")
    XCTAssertNil(registryId, "sync should ignore configs missing id")
  }

  private func waitForRegistryId(
    _ id: String,
    timeout: TimeInterval = 2.0
  ) async -> String? {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if let registryId = RNPingLoggerCommon._testRegistryId(for: id) {
        return registryId
      }
      try? await Task.sleep(nanoseconds: 50_000_000)
    }
    return nil
  }

  private func waitForHandle(
    _ registryId: String,
    expectedLevel: String? = nil,
    timeout: TimeInterval = 2.0
  ) async -> RNPingLoggerCommon.LoggerHandle? {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if let handle = await CoreRuntime.loggerRegistry.resolve(registryId) as? RNPingLoggerCommon.LoggerHandle {
        if let expectedLevel {
          if handle.level == expectedLevel {
            return handle
          }
        } else {
          return handle
        }
      }
      try? await Task.sleep(nanoseconds: 50_000_000)
    }
    return nil
  }

  private func waitForHandleLevel(
    _ registryId: String,
    expectedLevel: String,
    timeout: TimeInterval = 2.0
  ) async -> RNPingLoggerCommon.LoggerHandle? {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if let handle = await CoreRuntime.loggerRegistry.resolve(registryId) as? RNPingLoggerCommon.LoggerHandle,
         handle.level == expectedLevel {
        return handle
      }
      try? await Task.sleep(nanoseconds: 50_000_000)
    }
    return await CoreRuntime.loggerRegistry.resolve(registryId) as? RNPingLoggerCommon.LoggerHandle
  }
}
