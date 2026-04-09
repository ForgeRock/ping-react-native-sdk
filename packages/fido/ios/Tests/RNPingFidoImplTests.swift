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

  // MARK: - Register Tests

  func testRegisterRejectsWithWindowUnavailableWhenNoActiveWindow() async {
    let (code, message) = await invokeRegister(options: [:])
    XCTAssertEqual(code, "FIDO_WINDOW_UNAVAILABLE")
    XCTAssertNotNil(message)
    XCTAssertTrue(message?.contains("window") == true)
    XCTAssertTrue(message?.contains("registration") == true)
  }

  func testRegisterRejectsWithWindowUnavailableForNonEmptyOptions() async {
    let options: NSDictionary = [
      "challenge": "dGVzdC1jaGFsbGVuZ2U=",
      "rp": ["id": "example.com", "name": "Example"],
      "user": ["id": "user-id", "name": "user@example.com", "displayName": "User"],
    ]
    let (code, _) = await invokeRegister(options: options)
    XCTAssertEqual(code, "FIDO_WINDOW_UNAVAILABLE")
  }

  // MARK: - Authenticate Tests

  func testAuthenticateRejectsWithWindowUnavailableWhenNoActiveWindow() async {
    let (code, message) = await invokeAuthenticate(options: [:])
    XCTAssertEqual(code, "FIDO_WINDOW_UNAVAILABLE")
    XCTAssertNotNil(message)
    XCTAssertTrue(message?.contains("window") == true)
    XCTAssertTrue(message?.contains("authentication") == true)
  }

  func testAuthenticateRejectsWithWindowUnavailableForNonEmptyOptions() async {
    let options: NSDictionary = [
      "challenge": "dGVzdC1jaGFsbGVuZ2U=",
      "rpId": "example.com",
      "allowCredentials": [],
    ]
    let (code, _) = await invokeAuthenticate(options: options)
    XCTAssertEqual(code, "FIDO_WINDOW_UNAVAILABLE")
  }

  // MARK: - Journey Callback Tests

  func testRegisterForJourneyRejectsWhenCallbackMissing() async {
    let (code, _) = await invokeRegisterForJourney(
      journeyId: "journey-missing",
      options: [:]
    )
    XCTAssertEqual(code, "FIDO_CALLBACK_NOT_FOUND")
  }

  func testAuthenticateForJourneyRejectsWhenCallbackMissing() async {
    let (code, _) = await invokeAuthenticateForJourney(
      journeyId: "journey-missing",
      options: [:]
    )
    XCTAssertEqual(code, "FIDO_CALLBACK_NOT_FOUND")
  }

  // MARK: - Helpers

  @MainActor
  private func invokeRegister(options: NSDictionary) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      fidoImpl.register(options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  @MainActor
  private func invokeAuthenticate(options: NSDictionary) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      fidoImpl.authenticate(options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  @MainActor
  private func invokeRegisterForJourney(
    journeyId: String,
    options: NSDictionary
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      fidoImpl.registerForJourney(journeyId, options: options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }

  @MainActor
  private func invokeAuthenticateForJourney(
    journeyId: String,
    options: NSDictionary
  ) async -> (String?, String?) {
    await withCheckedContinuation { continuation in
      fidoImpl.authenticateForJourney(journeyId, options: options, config: [:]) { _ in
        continuation.resume(returning: ("UNEXPECTED_RESOLVE", nil))
      } rejecter: { code, message, _ in
        continuation.resume(returning: (code, message))
      }
    }
  }
}
