/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingOneProtect
@testable import RNPingCore
@testable import RNPingProtect

@MainActor
final class RNPingProtectImplTests: XCTestCase {

  private var impl: RNPingProtectImpl!

  override func setUp() async throws {
    try await super.setUp()
    impl = RNPingProtectImpl.shared
    CoreRuntime.setDaVinciCollectorResolver(nil)
  }

  override func tearDown() async throws {
    CoreRuntime.setDaVinciCollectorResolver(nil)
    impl = nil
    try await super.tearDown()
  }

  // MARK: - Singleton

  func testSharedInstanceIsSingleton() {
    let instance1 = RNPingProtectImpl.shared
    let instance2 = RNPingProtectImpl.shared
    XCTAssertTrue(instance1 === instance2, "Shared instance should return the same singleton")
  }

  // MARK: - collectForDaVinci

  func testCollectForDaVinciRejectsWhenDaVinciIdIsEmpty() async {
    let (code, type, _) = await invokeCollectForDaVinci(davinciId: "")
    XCTAssertEqual(code, "PROTECT_COLLECTOR_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.argumentError.rawValue)
  }

  func testCollectForDaVinciRejectsWhenDaVinciIdIsWhitespace() async {
    let (code, type, _) = await invokeCollectForDaVinci(davinciId: "   ")
    XCTAssertEqual(code, "PROTECT_COLLECTOR_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.argumentError.rawValue)
  }

  func testCollectForDaVinciRejectsWithCollectorNotFoundWhenNoCollectorsRegistered() async {
    let (code, type, message) = await invokeCollectForDaVinci(davinciId: "davinci-1")
    XCTAssertEqual(code, "PROTECT_COLLECTOR_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.stateError.rawValue)
    XCTAssertNotNil(message)
  }

  func testCollectForDaVinciRejectsWithCollectorNotFoundForNonEmptyOptions() async {
    let options: NSDictionary = ["index": 1]
    let (code, _, _) = await invokeCollectForDaVinci(
      davinciId: "davinci-1",
      options: options
    )
    XCTAssertEqual(code, "PROTECT_COLLECTOR_NOT_FOUND")
  }

  /// Verifies that a `collect()` failure (e.g. PingOneProtect not initialized in the
  /// test environment) rejects with `PROTECT_COLLECT_ERROR` / `auth_error`.
  func testCollectForDaVinciRejectsWhenCollectFails() async {
    CoreRuntime.setDaVinciCollectorResolver { _ in
      [ProtectCollector(with: [:])]
    }
    let (code, type, _) = await invokeCollectForDaVinci(davinciId: "davinci-collect-fail")
    XCTAssertEqual(code, "PROTECT_COLLECT_ERROR")
    XCTAssertEqual(type, "auth_error")
  }

  // MARK: - Helpers

  @MainActor
  private func invokeCollectForDaVinci(
    davinciId: String,
    options: NSDictionary = [:],
    config: NSDictionary = [:]
  ) async -> (String?, String?, String?) {
    await withCheckedContinuation { (continuation: CheckedContinuation<(String?, String?, String?), Never>) in
      impl.collectForDaVinci(
        davinciId,
        options: options,
        config: config,
        resolve: { _ in
          continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil, nil))
        },
        rejecter: { code, message, error in
          let type = (error as NSError?)?.userInfo["type"] as? String
          continuation.resume(returning: (code, type, message))
        }
      )
    }
  }
}
