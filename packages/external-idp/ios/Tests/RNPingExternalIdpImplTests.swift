/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingCore
@testable import RNPingExternalIdp

@MainActor
final class RNPingExternalIdpImplTests: XCTestCase {

  private var impl: RNPingExternalIdpImpl!

  override func setUp() async throws {
    try await super.setUp()
    impl = RNPingExternalIdpImpl.shared
  }

  override func tearDown() async throws {
    impl = nil
    try await super.tearDown()
  }

  // MARK: - Singleton

  func testSharedInstanceIsSingleton() {
    let instance1 = RNPingExternalIdpImpl.shared
    let instance2 = RNPingExternalIdpImpl.shared
    XCTAssertTrue(instance1 === instance2, "Shared instance should return the same singleton")
  }

  // MARK: - authorizeForJourney

  func testAuthorizeForJourneyRejectsWhenJourneyIdIsEmpty() async {
    let (code, type, _) = await invokeAuthorizeForJourney(journeyId: "")
    XCTAssertEqual(code, "EXTERNAL_IDP_CALLBACK_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.argumentError.rawValue)
  }

  func testAuthorizeForJourneyRejectsWhenJourneyIdIsWhitespace() async {
    let (code, type, _) = await invokeAuthorizeForJourney(journeyId: "   ")
    XCTAssertEqual(code, "EXTERNAL_IDP_CALLBACK_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.argumentError.rawValue)
  }

  func testAuthorizeForJourneyRejectsWithWindowUnavailableWhenNoActiveWindow() async {
    let (code, type, message) = await invokeAuthorizeForJourney(journeyId: "journey-1")
    XCTAssertEqual(code, "EXTERNAL_IDP_WINDOW_UNAVAILABLE")
    XCTAssertEqual(type, ErrorType.authError.rawValue)
    XCTAssertNotNil(message)
    XCTAssertTrue(message?.contains("window") == true)
  }

  func testAuthorizeForJourneyRejectsWithWindowUnavailableForNonEmptyOptions() async {
    let options: NSDictionary = ["index": 1]
    let config: NSDictionary = ["redirectUri": "com.example.app://callback"]
    let (code, _, _) = await invokeAuthorizeForJourney(
      journeyId: "journey-1",
      options: options,
      config: config
    )
    XCTAssertEqual(code, "EXTERNAL_IDP_WINDOW_UNAVAILABLE")
  }

  // MARK: - authorizeForDaVinci

  func testAuthorizeForDaVinciRejectsWhenDaVinciIdIsEmpty() async {
    let (code, type, _) = await invokeAuthorizeForDaVinci(davinciId: "")
    XCTAssertEqual(code, "EXTERNAL_IDP_CALLBACK_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.argumentError.rawValue)
  }

  func testAuthorizeForDaVinciRejectsWhenDaVinciIdIsWhitespace() async {
    let (code, type, _) = await invokeAuthorizeForDaVinci(davinciId: "   ")
    XCTAssertEqual(code, "EXTERNAL_IDP_CALLBACK_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.argumentError.rawValue)
  }

  func testAuthorizeForDaVinciRejectsWithWindowUnavailableWhenNoActiveWindow() async {
    let (code, type, message) = await invokeAuthorizeForDaVinci(davinciId: "davinci-1")
    XCTAssertEqual(code, "EXTERNAL_IDP_WINDOW_UNAVAILABLE")
    XCTAssertEqual(type, ErrorType.authError.rawValue)
    XCTAssertNotNil(message)
    XCTAssertTrue(message?.contains("window") == true)
  }

  // MARK: - selectProviderForJourney

  func testSelectProviderForJourneyRejectsWhenJourneyIdIsEmpty() async {
    let (code, type, _) = await invokeSelectProviderForJourney(
      journeyId: "",
      provider: "google"
    )
    XCTAssertEqual(code, "EXTERNAL_IDP_CALLBACK_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.argumentError.rawValue)
  }

  func testSelectProviderForJourneyRejectsWhenJourneyIdIsWhitespace() async {
    let (code, type, _) = await invokeSelectProviderForJourney(
      journeyId: "   ",
      provider: "google"
    )
    XCTAssertEqual(code, "EXTERNAL_IDP_CALLBACK_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.argumentError.rawValue)
  }

  func testSelectProviderForJourneyRejectsWhenProviderIsEmpty() async {
    let (code, type, _) = await invokeSelectProviderForJourney(
      journeyId: "journey-1",
      provider: ""
    )
    XCTAssertEqual(code, "EXTERNAL_IDP_CONFIG_ERROR")
    XCTAssertEqual(type, ErrorType.argumentError.rawValue)
  }

  func testSelectProviderForJourneyRejectsWhenProviderIsWhitespace() async {
    let (code, type, _) = await invokeSelectProviderForJourney(
      journeyId: "journey-1",
      provider: "   "
    )
    XCTAssertEqual(code, "EXTERNAL_IDP_CONFIG_ERROR")
    XCTAssertEqual(type, ErrorType.argumentError.rawValue)
  }

  func testSelectProviderForJourneyRejectsWhenCallbackNotFound() async {
    let (code, type, _) = await invokeSelectProviderForJourney(
      journeyId: "missing-journey",
      provider: "google"
    )
    XCTAssertEqual(code, "EXTERNAL_IDP_CALLBACK_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.stateError.rawValue)
  }

  // MARK: - Helpers

  @MainActor
  private func invokeAuthorizeForJourney(
    journeyId: String,
    options: NSDictionary = [:],
    config: NSDictionary = [:]
  ) async -> (String?, String?, String?) {
    await withCheckedContinuation { (continuation: CheckedContinuation<(String?, String?, String?), Never>) in
      impl.authorizeForJourney(
        journeyId,
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

  @MainActor
  private func invokeSelectProviderForJourney(
    journeyId: String,
    provider: String,
    options: NSDictionary = [:],
    config: NSDictionary = [:]
  ) async -> (String?, String?, String?) {
    await withCheckedContinuation { (continuation: CheckedContinuation<(String?, String?, String?), Never>) in
      impl.selectProviderForJourney(
        journeyId,
        provider: provider,
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

  @MainActor
  private func invokeAuthorizeForDaVinci(
    davinciId: String,
    options: NSDictionary = [:],
    config: NSDictionary = [:]
  ) async -> (String?, String?, String?) {
    await withCheckedContinuation { (continuation: CheckedContinuation<(String?, String?, String?), Never>) in
      impl.authorizeForDaVinci(
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
