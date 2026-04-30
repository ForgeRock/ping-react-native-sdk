/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingBinding

@MainActor
final class RNPingBindingImplTests: XCTestCase {

  private var impl: RNPingBindingImpl!

  override func setUp() async throws {
    try await super.setUp()
    impl = RNPingBindingImpl.shared
  }

  override func tearDown() async throws {
    impl = nil
    try await super.tearDown()
  }

  // MARK: - Singleton Tests

  func testSharedReturnsSameInstance() {
    let a = RNPingBindingImpl.shared
    let b = RNPingBindingImpl.shared
    XCTAssertTrue(a === b)
  }

  // MARK: - Bind Journey Tests

  func testBindForJourneyRejectsWithCallbackNotFoundWhenJourneyIdEmpty() async {
    let (code, message) = await invokeBindForJourney(journeyId: "", options: [:])
    XCTAssertEqual(code, "BINDING_CALLBACK_NOT_FOUND")
    XCTAssertNotNil(message)
  }

  func testBindForJourneyRejectsWithUiUnavailableForNonEmptyJourneyId() async {
    let (code, _) = await invokeBindForJourney(journeyId: "journey-test", options: [:])
    XCTAssertEqual(code, "BINDING_UI_UNAVAILABLE")
  }

  // MARK: - Sign Journey Tests

  func testSignForJourneyRejectsWithCallbackNotFoundWhenJourneyIdEmpty() async {
    let (code, message) = await invokeSignForJourney(journeyId: "", options: [:])
    XCTAssertEqual(code, "BINDING_CALLBACK_NOT_FOUND")
    XCTAssertNotNil(message)
  }

  func testSignForJourneyRejectsWithUiUnavailableForNonEmptyJourneyId() async {
    let (code, _) = await invokeSignForJourney(journeyId: "journey-test", options: [:])
    XCTAssertEqual(code, "BINDING_UI_UNAVAILABLE")
  }

  // MARK: - Helpers

  @MainActor
  private func invokeBindForJourney(
    journeyId: String,
    options: NSDictionary
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      impl.bindForJourney(journeyId, options: options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  @MainActor
  private func invokeSignForJourney(
    journeyId: String,
    options: NSDictionary
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      impl.signForJourney(journeyId, options: options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }
}
