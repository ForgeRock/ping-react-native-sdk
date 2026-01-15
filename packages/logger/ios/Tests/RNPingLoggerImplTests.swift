/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingCore
@testable import RNPingLogger

@available(iOS 16.0, *)
final class RNPingLoggerImplTests: XCTestCase {

  var loggerImpl: RNPingLoggerImpl!

  override func setUp() async throws {
    try await super.setUp()
    loggerImpl = RNPingLoggerImpl.shared
    await CoreRuntime.loggerRegistry.removeAll()
  }

  override func tearDown() async throws {
    await CoreRuntime.loggerRegistry.removeAll()
    loggerImpl = nil
    try await super.tearDown()
  }

  // MARK: - Singleton Tests

  func testSharedInstanceIsSingleton() {
    let instance1 = RNPingLoggerImpl.shared
    let instance2 = RNPingLoggerImpl.shared

    XCTAssertTrue(instance1 === instance2, "Shared instance should return the same singleton")
  }

  func testSharedInstanceIsNotNil() {
    XCTAssertNotNil(RNPingLoggerImpl.shared, "Shared instance should not be nil")
  }

  // MARK: - Register Tests

  func testRegisterLoggerReturnsValidId() {
    let config: NSDictionary = ["level": "STANDARD"]

    let id = loggerImpl.registerLogger(config)

    XCTAssertFalse(id.isEmpty, "registerLogger should return a non-empty ID")
  }

  func testRegisterLoggerRegistersHandle() async {
    let config: NSDictionary = ["level": "STANDARD"]

    let id = loggerImpl.registerLogger(config)
    let handle = await CoreRuntime.loggerRegistry.resolve(id)

    XCTAssertNotNil(handle, "registerLogger should register a handle in the registry")
  }

  func testRegisterLoggerStoresParsedLevel() async {
    let config: NSDictionary = ["level": "WARN"]

    let id = loggerImpl.registerLogger(config)
    let level = await loggerImpl._testLevel(id)

    XCTAssertEqual(level, "WARN", "registerLogger should store the parsed level")
  }

  func testRegisterLoggerDefaultsToNoneOnInvalidLevel() async {
    let config: NSDictionary = ["level": "UNKNOWN"]

    let id = loggerImpl.registerLogger(config)
    let level = await loggerImpl._testLevel(id)

    XCTAssertEqual(level, "NONE", "registerLogger should default to NONE for invalid levels")
  }

  // MARK: - Sync Tests

  func testSyncLoggerUpdatesLevel() async {
    let config: NSDictionary = ["level": "STANDARD"]
    let id = loggerImpl.registerLogger(config)

    loggerImpl.syncLogger(id, level: "WARN")
    let level = await waitForLevel(id)

    XCTAssertEqual(level, "WARN", "syncLogger should update the stored level")
  }

  func testSyncLoggerIgnoresInvalidLevel() async {
    let config: NSDictionary = ["level": "STANDARD"]
    let id = loggerImpl.registerLogger(config)

    loggerImpl.syncLogger(id, level: "INVALID")
    let level = await loggerImpl._testLevel(id)

    XCTAssertEqual(level, "STANDARD", "syncLogger should ignore invalid levels")
  }

  private func waitForLevel(_ id: String, timeout: TimeInterval = 2.0) async -> String? {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if let level = await loggerImpl._testLevel(id) {
        return level
      }
      try? await Task.sleep(nanoseconds: 50_000_000)
    }
    return nil
  }
}
