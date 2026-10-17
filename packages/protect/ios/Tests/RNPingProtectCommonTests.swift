/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingJourneyPlugin
import PingLogger
import PingOneProtect
@testable import RNPingCore
@testable import RNPingProtect

private final class RecordingLogger: PingLogger.Logger, @unchecked Sendable {
  private let lock = NSLock()
  private var recordedWarnings: [String] = []

  var warnings: [String] {
    lock.lock()
    defer { lock.unlock() }
    return recordedWarnings
  }

  func d(_ message: String) {}
  func i(_ message: String) {}
  func e(_ message: String, error: Error?) {}

  func w(_ message: String, error: Error?) {
    lock.lock()
    defer { lock.unlock() }
    recordedWarnings.append(message)
  }
}

private enum JourneyOutcome {
  case resolved(type: String?)
  case rejected(code: String?, message: String?, type: String?)
}

@MainActor
final class RNPingProtectCommonTests: XCTestCase {

  override func tearDown() async throws {
    CoreRuntime.setJourneyCallbackResolver(nil)
    await ProtectInitializationState.shared.resetForTesting()
    try await super.tearDown()
  }

  // MARK: - parseCallConfig

  func testParseCallConfigTrimsLoggerId() {
    let config = RNPingProtectCommon.parseCallConfig(
      ["loggerId": "  logger-123  "]
    )
    XCTAssertEqual(config.loggerId, "logger-123")
  }

  func testParseCallConfigDefaultsMissingLoggerIdToNil() {
    let config = RNPingProtectCommon.parseCallConfig([:])
    XCTAssertNil(config.loggerId)
  }

  func testParseCallConfigReturnsNilLoggerIdWhenBlank() {
    let config = RNPingProtectCommon.parseCallConfig(
      ["loggerId": "   "]
    )
    XCTAssertNil(config.loggerId)
  }

  // MARK: - parseProtectInitConfig

  func testParseProtectInitConfigExtractsEnvId() {
    let config = RNPingProtectCommon.parseProtectInitConfig(["envId": "my-env-id"])
    XCTAssertEqual(config.envId, "my-env-id")
  }

  func testParseProtectInitConfigDefaultsBehavioralDataCollectionToTrue() {
    let config = RNPingProtectCommon.parseProtectInitConfig([:])
    XCTAssertTrue(config.isBehavioralDataCollection)
  }

  func testParseProtectInitConfigDefaultsLazyMetadataToFalse() {
    let config = RNPingProtectCommon.parseProtectInitConfig([:])
    XCTAssertFalse(config.isLazyMetadata)
  }

  func testParseProtectInitConfigExtractsDeviceAttributesToIgnore() {
    let config = RNPingProtectCommon.parseProtectInitConfig(
      ["deviceAttributesToIgnore": ["deviceId", "screen"]]
    )
    XCTAssertEqual(config.deviceAttributesToIgnore, ["deviceId", "screen"])
  }

  func testParseProtectInitConfigReturnsNilEnvIdWhenEmpty() {
    let config = RNPingProtectCommon.parseProtectInitConfig(["envId": ""])
    XCTAssertNil(config.envId)
  }

  // MARK: - pauseBehavioralData / resumeBehavioralData rejection when SDK not initialized

  func testPauseBehavioralDataRejectsWhenSDKNotInitialized() async {
    let expectation = XCTestExpectation(description: "pauseBehavioralData rejects")
    var rejectedCode: String?

    RNPingProtectCommon.pauseBehavioralData([:], resolver: { _ in
      XCTFail("Expected rejection")
    }, rejecter: { code, _, _ in
      rejectedCode = code
      expectation.fulfill()
    })

    await fulfillment(of: [expectation], timeout: 5)
    XCTAssertEqual(rejectedCode, "PROTECT_COLLECT_ERROR")
  }

  func testResumeBehavioralDataRejectsWhenSDKNotInitialized() async {
    let expectation = XCTestExpectation(description: "resumeBehavioralData rejects")
    var rejectedCode: String?

    RNPingProtectCommon.resumeBehavioralData([:], resolver: { _ in
      XCTFail("Expected rejection")
    }, rejecter: { code, _, _ in
      rejectedCode = code
      expectation.fulfill()
    })

    await fulfillment(of: [expectation], timeout: 5)
    XCTAssertEqual(rejectedCode, "PROTECT_COLLECT_ERROR")
  }

  // MARK: - collectForJourney

  func testCollectForJourneyRejectsBlankJourneyId() async {
    for id in ["", "   "] {
      let outcome = await invokeCollectForJourney(journeyId: id)
      guard case let .rejected(code, message, type) = outcome else { return XCTFail("Expected rejection") }
      XCTAssertEqual(code, "PROTECT_ARGUMENT_ERROR")
      XCTAssertEqual(type, ErrorType.argumentError.rawValue)
      XCTAssertEqual(message, "Journey id must not be empty for Protect data collection.")
    }
  }

  func testCollectForJourneyRejectsWhenNoResolverRegistered() async {
    let outcome = await invokeCollectForJourney(journeyId: "journey-1")
    guard case let .rejected(code, _, type) = outcome else { return XCTFail("Expected rejection") }
    XCTAssertEqual(code, "PROTECT_CALLBACK_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.stateError.rawValue)
  }

  func testCollectForJourneyRejectsWhenCallbackListIsEmpty() async {
    CoreRuntime.setJourneyCallbackResolver { _ in [] }
    let outcome = await invokeCollectForJourney(journeyId: "journey-1")
    guard case let .rejected(code, message, type) = outcome else { return XCTFail("Expected rejection") }
    XCTAssertEqual(code, "PROTECT_CALLBACK_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.stateError.rawValue)
    XCTAssertEqual(message, "No active Protect evaluation callback found for Journey journey-1 at index 0.")
  }

  func testCollectForJourneyRejectsWhenIndexIsOutOfRange() async {
    let callback = await makeEvaluationCallback()
    CoreRuntime.setJourneyCallbackResolver { _ in [callback] }
    let outcome = await invokeCollectForJourney(journeyId: "journey-1", options: ["index": 3])
    guard case let .rejected(code, message, type) = outcome else { return XCTFail("Expected rejection") }
    XCTAssertEqual(code, "PROTECT_CALLBACK_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.stateError.rawValue)
    XCTAssertEqual(message, "No active Protect evaluation callback found for Journey journey-1 at index 3.")
  }

  func testCollectForJourneyRejectsWhenIndexIsNegative() async {
    let callback = await makeEvaluationCallback()
    CoreRuntime.setJourneyCallbackResolver { _ in [callback] }
    let outcome = await invokeCollectForJourney(journeyId: "journey-1", options: ["index": -1])
    guard case let .rejected(code, _, type) = outcome else { return XCTFail("Expected rejection") }
    XCTAssertEqual(code, "PROTECT_CALLBACK_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.stateError.rawValue)
  }

  func testCollectForJourneyRejectsWhenNotInitializedAndLeavesInputUntouched() async {
    let callback = await makeEvaluationCallback()
    CoreRuntime.setJourneyCallbackResolver { _ in [callback] }
    let outcome = await invokeCollectForJourney(journeyId: "journey-1")
    guard case let .rejected(code, message, type) = outcome else { return XCTFail("Expected rejection") }
    XCTAssertEqual(code, "PROTECT_NOT_INITIALIZED")
    XCTAssertEqual(type, ErrorType.stateError.rawValue)
    XCTAssertEqual(
      message,
      "Protect has not been initialized. Call initializeProtectForJourney() before collecting."
    )
    XCTAssertEqual(inputValues(of: callback), ["", ""])
  }

  /// `Protect.data()` throws promptly when PingOneSignals is not initialized, which makes the
  /// collect-failure branch reachable without a real Protect runtime.
  func testCollectForJourneyRejectsWhenCollectFails() async {
    let callback = await makeEvaluationCallback()
    CoreRuntime.setJourneyCallbackResolver { _ in [callback] }
    await ProtectInitializationState.shared.markInitialized(from: .appConfig, logger: nil)

    let outcome = await invokeCollectForJourney(journeyId: "journey-1")
    guard case let .rejected(code, message, _) = outcome else { return XCTFail("Expected rejection") }
    XCTAssertEqual(code, "PROTECT_COLLECT_ERROR")
    XCTAssertFalse(message?.isEmpty ?? true)
    XCTAssertFalse(inputValues(of: callback)[1].isEmpty, "clientError input must carry the failure message")
  }

  // MARK: - initializeForJourney

  func testInitializeForJourneyRejectsBlankJourneyId() async {
    for id in ["", "   "] {
      let outcome = await invokeInitializeForJourney(journeyId: id)
      guard case let .rejected(code, message, type) = outcome else { return XCTFail("Expected rejection") }
      XCTAssertEqual(code, "PROTECT_ARGUMENT_ERROR")
      XCTAssertEqual(type, ErrorType.argumentError.rawValue)
      XCTAssertEqual(message, "Journey id must not be empty for Protect initialization.")
    }
  }

  func testInitializeForJourneyRejectsWhenNoResolverRegistered() async {
    let outcome = await invokeInitializeForJourney(journeyId: "journey-1")
    guard case let .rejected(code, _, type) = outcome else { return XCTFail("Expected rejection") }
    XCTAssertEqual(code, "PROTECT_CALLBACK_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.stateError.rawValue)
  }

  func testInitializeForJourneyRejectsWhenCallbackListIsEmpty() async {
    CoreRuntime.setJourneyCallbackResolver { _ in [] }
    let outcome = await invokeInitializeForJourney(journeyId: "journey-1")
    guard case let .rejected(code, message, type) = outcome else { return XCTFail("Expected rejection") }
    XCTAssertEqual(code, "PROTECT_CALLBACK_NOT_FOUND")
    XCTAssertEqual(type, ErrorType.stateError.rawValue)
    XCTAssertEqual(message, "No active Protect initialize callback found for Journey journey-1.")
  }

  // MARK: - registerJourneyCallbacks

  func testRegisterJourneyCallbacksRegistersProtectCallbackTypes() async {
    await RNPingProtectCommon.registerJourneyCallbackTypes()

    let types = [
      JourneyConstants.pingOneProtectInitializeCallback,
      JourneyConstants.pingOneProtectEvaluationCallback,
    ]
    for type in types {
      let registered = await CallbackRegistry.shared.type(for: type)
      XCTAssertNotNil(registered, "\(type) should be registered in the CallbackRegistry")
    }
  }

  func testJourneyCallbackTypeKeysMatchServerCallbackTypeNames() {
    XCTAssertEqual(
      JourneyConstants.pingOneProtectInitializeCallback,
      "PingOneProtectInitializeCallback"
    )
    XCTAssertEqual(
      JourneyConstants.pingOneProtectEvaluationCallback,
      "PingOneProtectEvaluationCallback"
    )
  }

  func testRegisterJourneyCallbacksResolvesOnlyAfterRegistration() async {
    let resolved = expectation(description: "resolved")
    RNPingProtectCommon.registerJourneyCallbacks(
      resolver: { _ in resolved.fulfill() },
      rejecter: { _, _, _ in XCTFail("Unexpected rejection") }
    )
    await fulfillment(of: [resolved], timeout: 5)

    let initializeRegistered = await CallbackRegistry.shared.type(
      for: JourneyConstants.pingOneProtectInitializeCallback
    )
    let evaluationRegistered = await CallbackRegistry.shared.type(
      for: JourneyConstants.pingOneProtectEvaluationCallback
    )
    XCTAssertNotNil(initializeRegistered)
    XCTAssertNotNil(evaluationRegistered)
  }

  // MARK: - journeyIndex

  func testJourneyIndexDefaultsToZeroWhenMissingOrNull() {
    XCTAssertEqual(RNPingProtectCommon.journeyIndex([:]), 0)
    XCTAssertEqual(RNPingProtectCommon.journeyIndex(["index": NSNull()]), 0)
  }

  func testJourneyIndexReadsProvidedValue() {
    XCTAssertEqual(RNPingProtectCommon.journeyIndex(["index": 2]), 2)
    XCTAssertEqual(RNPingProtectCommon.journeyIndex(["index": 2.0]), 2)
  }

  func testJourneyIndexWarnsAndDefaultsToZeroForUnrecognizedValues() {
    let values: [Any] = [1.9, "1", NSNumber(value: true)]
    for value in values {
      let logger = RecordingLogger()
      XCTAssertEqual(RNPingProtectCommon.journeyIndex(["index": value], logger: logger), 0)
      XCTAssertEqual(logger.warnings.count, 1)
    }
  }

  // MARK: - ProtectInitializationState

  func testMarkInitializedFirstSourceWinsAndWarnsOnDifferentSource() async {
    let logger = RecordingLogger()
    let state = ProtectInitializationState.shared

    await state.markInitialized(from: .appConfig, logger: logger)
    await state.markInitialized(from: .journeyTreeConfig, logger: logger)

    let initializedBy = await state.initializedBy
    XCTAssertEqual(initializedBy, .appConfig)
    XCTAssertEqual(logger.warnings.count, 1)
    XCTAssertTrue(logger.warnings[0].contains("once-only"))
    XCTAssertTrue(logger.warnings[0].contains("already initialized by app config"))
    XCTAssertTrue(logger.warnings[0].contains("from Journey tree config was not applied"))
  }

  func testMarkInitializedWarnsInReverseOrder() async {
    let logger = RecordingLogger()
    let state = ProtectInitializationState.shared

    await state.markInitialized(from: .journeyTreeConfig, logger: logger)
    await state.markInitialized(from: .appConfig, logger: logger)

    let initializedBy = await state.initializedBy
    XCTAssertEqual(initializedBy, .journeyTreeConfig)
    XCTAssertEqual(logger.warnings.count, 1)
    XCTAssertTrue(logger.warnings[0].contains("already initialized by Journey tree config"))
  }

  func testMarkInitializedSameSourceDoesNotWarn() async {
    let logger = RecordingLogger()
    let state = ProtectInitializationState.shared

    await state.markInitialized(from: .appConfig, logger: logger)
    await state.markInitialized(from: .appConfig, logger: logger)

    XCTAssertTrue(logger.warnings.isEmpty)
  }

  func testResetForTestingClearsInitializationSource() async {
    let state = ProtectInitializationState.shared
    await state.markInitialized(from: .appConfig, logger: nil)
    await state.resetForTesting()
    let initializedBy = await state.initializedBy
    XCTAssertNil(initializedBy)
  }

  // MARK: - Helpers

  private func makeEvaluationCallback() async -> PingOneProtectEvaluationCallback {
    let callback = PingOneProtectEvaluationCallback()
    _ = await callback.initialize(with: [
      "type": "PingOneProtectEvaluationCallback",
      "output": [["name": "pauseBehavioralData", "value": false]],
      "input": [
        ["name": "IDToken1signals", "value": ""],
        ["name": "IDToken1clientError", "value": ""],
      ],
    ])
    return callback
  }

  private func inputValues(of callback: PingOneProtectEvaluationCallback) -> [String] {
    let input = callback.json["input"] as? [[String: Any]] ?? []
    return input.map { $0["value"] as? String ?? "" }
  }

  private func invokeCollectForJourney(
    journeyId: String,
    options: NSDictionary = [:],
    config: NSDictionary = [:]
  ) async -> JourneyOutcome {
    await withCheckedContinuation { (continuation: CheckedContinuation<JourneyOutcome, Never>) in
      RNPingProtectCommon.collectForJourney(
        journeyId,
        options: options,
        config: config,
        resolver: { result in
          continuation.resume(returning: .resolved(type: (result as? NSDictionary)?["type"] as? String))
        },
        rejecter: { code, message, error in
          let type = (error as NSError?)?.userInfo["type"] as? String
          continuation.resume(returning: .rejected(code: code, message: message, type: type))
        }
      )
    }
  }

  private func invokeInitializeForJourney(
    journeyId: String,
    config: NSDictionary = [:]
  ) async -> JourneyOutcome {
    await withCheckedContinuation { (continuation: CheckedContinuation<JourneyOutcome, Never>) in
      RNPingProtectCommon.initializeForJourney(
        journeyId,
        config: config,
        resolver: { result in
          continuation.resume(returning: .resolved(type: (result as? NSDictionary)?["type"] as? String))
        },
        rejecter: { code, message, error in
          let type = (error as NSError?)?.userInfo["type"] as? String
          continuation.resume(returning: .rejected(code: code, message: message, type: type))
        }
      )
    }
  }
}
