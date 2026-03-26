/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingFido

@MainActor
final class RNPingFidoImplTests: XCTestCase {

  private var fidoImpl: RNPingFidoImpl!

  override func setUp() async throws {
    try await super.setUp()
    fidoImpl = RNPingFidoImpl.shared
  }

  override func tearDown() async throws {
    fidoImpl = nil
    try await super.tearDown()
  }

  // MARK: - Singleton Tests

  func testSharedInstanceIsSingleton() {
    let instance1 = RNPingFidoImpl.shared
    let instance2 = RNPingFidoImpl.shared

    XCTAssertTrue(instance1 === instance2, "Shared instance should return the same singleton")
  }

  // MARK: - Bridge Contract Tests

  func testGetDefaultFidoRejectsWithScaffoldError() async {
    let (code, message) = await fetchDefaultFidoError()
    XCTAssertEqual(code, "FIDO_ERROR")
    XCTAssertEqual(message, "FIDO bridge is scaffolded but not implemented.")
  }

  @MainActor
  private func fetchDefaultFidoError() async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      fidoImpl.getDefaultFido { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", "Expected rejection"))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }
}
