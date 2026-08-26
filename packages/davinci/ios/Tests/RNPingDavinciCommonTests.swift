//
//  RNPingDavinciCommonTests.swift
//  RNPingDavinci
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import XCTest
import PingDavinci
import PingDavinciPlugin
import PingLogger
import PingOrchestrate
@testable import RNPingCore
@testable import RNPingDavinci

final class RNPingDavinciCommonTests: XCTestCase {
  private final class ErrorCaptureBox: @unchecked Sendable {
    private let lock = NSLock()
    private var storedCode: String?
    private var storedError: NSError?

    func set(code: String, error: NSError?) {
      lock.lock()
      storedCode = code
      storedError = error
      lock.unlock()
    }

    var code: String? {
      lock.lock()
      defer { lock.unlock() }
      return storedCode
    }

    var error: NSError? {
      lock.lock()
      defer { lock.unlock() }
      return storedError
    }
  }

  private final class ErrorsCaptureBox: @unchecked Sendable {
    private let lock = NSLock()
    private var storedValue: NSArray?

    func set(_ value: NSArray) {
      lock.lock()
      storedValue = value
      lock.unlock()
    }

    var value: NSArray? {
      lock.lock()
      defer { lock.unlock() }
      return storedValue
    }
  }

  private final class StringCaptureBox: @unchecked Sendable {
    private let lock = NSLock()
    private var storedValue: String?

    func set(_ value: String) {
      lock.lock()
      storedValue = value
      lock.unlock()
    }

    var value: String? {
      lock.lock()
      defer { lock.unlock() }
      return storedValue
    }
  }

  override func setUp() {
    super.setUp()
    RNPingDavinciCommon.cleanup()
  }

  override func tearDown() async throws {
    RNPingDavinciCommon.cleanup()
    await CoreRuntime.loggerRegistry.removeAll()
    try await super.tearDown()
  }

  // MARK: - configureDaVinci

  func testConfigureDaVinciRejectsWhenDiscoveryEndpointMissing() {
    let rejectExpectation = expectation(description: "reject called")
    let resolveExpectation = expectation(description: "resolve not called")
    resolveExpectation.isInverted = true

    let capture = ErrorCaptureBox()

    RNPingDavinciCommon.configureDaVinci(
      [:],
      resolver: { _ in
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { code, _, error in
        capture.set(code: code, error: error)
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [rejectExpectation, resolveExpectation], timeout: 1.0)

    XCTAssertEqual(capture.code, DaVinciErrorCodes.configError.rawValue)
    XCTAssertEqual(capture.error?.userInfo["type"] as? String, ErrorType.argumentError.rawValue)
  }

  func testConfigureDaVinciAcceptsValidConfig() {
    let resolveExpectation = expectation(description: "resolve called")
    let rejectExpectation = expectation(description: "reject not called")
    rejectExpectation.isInverted = true

    RNPingDavinciCommon.configureDaVinci(
      [
        "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
        "clientId": "my-client",
        "redirectUri": "com.example.app://oauth2redirect"
      ],
      resolver: { _ in
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 2.0)
  }

  func testConfigureDaVinciAcceptsValidLoggerId() async {
    let loggerId = await CoreRuntime.loggerRegistry.register(
      TestLoggerHandle(loggerLevel: "STANDARD")
    )

    let resolveExpectation = expectation(description: "resolve called")
    let rejectExpectation = expectation(description: "reject not called")
    rejectExpectation.isInverted = true

    RNPingDavinciCommon.configureDaVinci(
      [
        "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
        "clientId": "my-client",
        "redirectUri": "com.example.app://oauth2redirect",
        "loggerId": loggerId
      ],
      resolver: { _ in
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    await fulfillment(of: [resolveExpectation, rejectExpectation], timeout: 2.0)
  }

  func testConfigureDaVinciAcceptsMissingLoggerId() {
    let resolveExpectation = expectation(description: "resolve called")
    let rejectExpectation = expectation(description: "reject not called")
    rejectExpectation.isInverted = true

    RNPingDavinciCommon.configureDaVinci(
      [
        "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
        "clientId": "my-client",
        "redirectUri": "com.example.app://oauth2redirect",
        "loggerId": "missing-logger-handle"
      ],
      resolver: { _ in
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 2.0)
  }

  func testConfigureDaVinciRejectsWhenStorageIdUnresolvable() {
    assertReject(
      expectedCode: DaVinciErrorCodes.initError.rawValue,
      expectedType: .argumentError
    ) { rejecter, resolver in
      RNPingDavinciCommon.configureDaVinci(
        [
          "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
          "clientId": "my-client",
          "redirectUri": "com.example.app://oauth2redirect",
          "storageId": "missing-storage-handle"
        ],
        resolver: { _ in resolver(NSDictionary()) },
        rejecter: rejecter
      )
    }
  }

  // MARK: - start

  func testStartRejectsWhenDaVinciMissing() {
    assertReject(
      expectedCode: DaVinciErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciCommon.start(
        "missing",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testStartResolvesFailureNodePayloadWhenDiscoveryFails() {
    let davinciId = configureDaVinciAndWait()
    let resolveExpectation = expectation(description: "start resolve")
    let rejectExpectation = expectation(description: "start reject not called")
    rejectExpectation.isInverted = true
    let capture = StringCaptureBox()

    RNPingDavinciCommon.start(
      davinciId,
      resolver: { payload in
        capture.set(payload["type"] as? String ?? "")
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 5.0)
    XCTAssertEqual(capture.value, "FailureNode")
  }

  func testStartResolvesFailureNodePayloadWithConfiguredLogger() async {
    let loggerId = await CoreRuntime.loggerRegistry.register(
      TestLoggerHandle(loggerLevel: "STANDARD")
    )
    let davinciId = configureDaVinciAndWait(loggerId: loggerId)
    let resolveExpectation = expectation(description: "start resolve")
    let rejectExpectation = expectation(description: "start reject not called")
    rejectExpectation.isInverted = true
    let capture = StringCaptureBox()

    RNPingDavinciCommon.start(
      davinciId,
      resolver: { payload in
        capture.set(payload["type"] as? String ?? "")
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    await fulfillment(of: [resolveExpectation, rejectExpectation], timeout: 5.0)
    XCTAssertEqual(capture.value, "FailureNode")
  }

  // MARK: - next

  func testNextRejectsWhenDaVinciMissing() {
    assertReject(
      expectedCode: DaVinciErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciCommon.next(
        "missing",
        input: [:],
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testNextRejectsWhenCollectorInputIsMalformed() {
    assertReject(
      expectedCode: DaVinciErrorCodes.collectorApplyError.rawValue,
      expectedType: .argumentError
    ) { rejecter, resolver in
      RNPingDavinciCommon.next(
        "any-id",
        input: ["collectors": ["invalid-item"]],
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  // MARK: - validate

  func testValidateRejectsWhenNoActiveNode() {
    assertValidateReject(
      expectedCode: DaVinciErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciCommon.validate(
        "missing",
        collectorKey: "username",
        input: ["collectors": [["key": "username", "value": "alice"]]],
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testValidateRejectsWithCollectorApplyErrorForUnknownCollectorKey() {
    let davinciId = "validate-unknown-key"
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [
        TextCollector(with: ["key": "username", "type": "TEXT", "label": "Username", "required": false])
      ])
    )

    assertValidateReject(
      expectedCode: DaVinciErrorCodes.collectorApplyError.rawValue,
      expectedType: .argumentError
    ) { rejecter, resolver in
      RNPingDavinciCommon.validate(
        davinciId,
        collectorKey: "unknown",
        input: ["collectors": [["key": "unknown", "value": "alice"]]],
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testValidateRejectsWithUnsupportedCollectorErrorForUnsupportedCollectorType() {
    let davinciId = "validate-unsupported-collector"
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [
        LabelCollector(with: ["key": "notice", "type": "LABEL", "content": "Notice"])
      ])
    )

    assertValidateReject(
      expectedCode: DaVinciErrorCodes.unsupportedCollectorError.rawValue,
      expectedType: .argumentError
    ) { rejecter, resolver in
      RNPingDavinciCommon.validate(
        davinciId,
        collectorKey: "notice",
        input: ["collectors": [["key": "notice", "value": "anything"]]],
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testValidateResolvesRequiredErrorForEmptyRequiredField() {
    let davinciId = "validate-required"
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [
        TextCollector(with: ["key": "username", "type": "TEXT", "label": "Username", "required": true])
      ])
    )

    assertValidateResolves(
      davinciId: davinciId,
      collectorKey: "username",
      value: ""
    ) { errors in
      XCTAssertEqual(errors.count, 1)
      XCTAssertEqual(errors.first?["code"] as? String, "REQUIRED")
    }
  }

  func testValidateNormalizesRequiredBooleanError() {
    let davinciId = "validate-boolean-required"
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [
        BooleanCollector(with: [
          "key": "agree", "type": "BOOLEAN", "label": "Agree", "required": true,
          "errorMessage": "You must agree."
        ])
      ])
    )

    assertValidateResolves(
      davinciId: davinciId,
      collectorKey: "agree",
      value: false
    ) { errors in
      XCTAssertEqual(errors.count, 1)
      XCTAssertEqual(errors.first?["code"] as? String, "REQUIRED")
      XCTAssertNil(errors.first?["message"])
    }
  }

  func testValidateResolvesRegexErrorForInvalidValue() {
    let davinciId = "validate-regex"
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [
        TextCollector(with: [
          "key": "email", "type": "TEXT", "label": "Email", "required": false,
          "validation": ["regex": "^.+@.+$", "errorMessage": "Invalid email"]
        ])
      ])
    )

    assertValidateResolves(
      davinciId: davinciId,
      collectorKey: "email",
      value: "not-an-email"
    ) { errors in
      XCTAssertEqual(errors.count, 1)
      XCTAssertEqual(errors.first?["code"] as? String, "REGEX_ERROR")
      XCTAssertEqual(errors.first?["message"] as? String, "Invalid email")
    }
  }

  func testValidateResolvesEmptyArrayForValidValue() {
    let davinciId = "validate-valid"
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [
        TextCollector(with: [
          "key": "email", "type": "TEXT", "label": "Email", "required": false,
          "validation": ["regex": "^.+@.+$", "errorMessage": "Invalid email"]
        ])
      ])
    )

    assertValidateResolves(
      davinciId: davinciId,
      collectorKey: "email",
      value: "alice@example.com"
    ) { errors in
      XCTAssertTrue(errors.isEmpty)
    }
  }

  func testValidateResolvesEmptyArrayForNonValidatorCollector() {
    let davinciId = "validate-non-validator"
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [
        FlowCollector(with: ["key": "next", "type": "FLOW", "label": "Next", "required": false])
      ])
    )

    assertValidateResolves(
      davinciId: davinciId,
      collectorKey: "next",
      value: "NEXT"
    ) { errors in
      XCTAssertTrue(errors.isEmpty)
    }
  }

  // MARK: - getSession

  func testGetSessionRejectsWhenDaVinciMissing() {
    assertReject(
      expectedCode: DaVinciErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciCommon.getSession(
        "missing",
        resolver: { _ in resolver(NSDictionary()) },
        rejecter: rejecter
      )
    }
  }

  // MARK: - refresh

  func testRefreshRejectsWhenDaVinciMissing() {
    assertReject(
      expectedCode: DaVinciErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciCommon.refresh(
        "missing",
        resolver: { _ in resolver(NSDictionary()) },
        rejecter: rejecter
      )
    }
  }

  // MARK: - revoke

  func testRevokeRejectsWhenDaVinciMissing() {
    assertReject(
      expectedCode: DaVinciErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciCommon.revoke(
        "missing",
        resolver: { _ in resolver(NSDictionary()) },
        rejecter: rejecter
      )
    }
  }

  // MARK: - userinfo

  func testUserinfoRejectsWhenDaVinciMissing() {
    assertReject(
      expectedCode: DaVinciErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciCommon.userinfo(
        "missing",
        resolver: { _ in resolver(NSDictionary()) },
        rejecter: rejecter
      )
    }
  }

  // MARK: - logout

  func testLogoutRejectsWhenDaVinciMissing() {
    assertReject(
      expectedCode: DaVinciErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciCommon.logout(
        "missing",
        resolver: { resolver(NSDictionary()) },
        rejecter: rejecter
      )
    }
  }

  // MARK: - getSession (no user)

  func testGetSessionResolvesNilWhenNoUserSignedIn() {
    let davinciId = configureDaVinciAndWait()
    let resolveExpectation = expectation(description: "getSession resolve")
    let rejectExpectation = expectation(description: "getSession reject not called")
    rejectExpectation.isInverted = true

    RNPingDavinciCommon.getSession(
      davinciId,
      resolver: { payload in
        XCTAssertNil(payload)
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 2.0)
  }

  // MARK: - refresh (no user)

  func testRefreshResolvesNilWhenNoUserSignedIn() {
    let davinciId = configureDaVinciAndWait()
    let resolveExpectation = expectation(description: "refresh resolve")
    let rejectExpectation = expectation(description: "refresh reject not called")
    rejectExpectation.isInverted = true

    RNPingDavinciCommon.refresh(
      davinciId,
      resolver: { payload in
        XCTAssertNil(payload)
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 2.0)
  }

  // MARK: - revoke (no user)

  func testRevokeResolvesWhenNoUserSignedIn() {
    let davinciId = configureDaVinciAndWait()
    let resolveExpectation = expectation(description: "revoke resolve")
    let rejectExpectation = expectation(description: "revoke reject not called")
    rejectExpectation.isInverted = true

    RNPingDavinciCommon.revoke(
      davinciId,
      resolver: { resolved in
        XCTAssertTrue(resolved)
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 2.0)
  }

  // MARK: - userinfo (no user)

  func testUserinfoResolvesNilWhenNoUserSignedIn() {
    let davinciId = configureDaVinciAndWait()
    let resolveExpectation = expectation(description: "userinfo resolve")
    let rejectExpectation = expectation(description: "userinfo reject not called")
    rejectExpectation.isInverted = true

    RNPingDavinciCommon.userinfo(
      davinciId,
      resolver: { payload in
        XCTAssertNil(payload)
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 2.0)
  }

  // MARK: - dispose

  func testDisposeResolvesWhenDaVinciMissing() {
    let resolveExpectation = expectation(description: "resolve called")
    let rejectExpectation = expectation(description: "reject not called")
    rejectExpectation.isInverted = true

    RNPingDavinciCommon.dispose(
      "missing",
      resolver: {
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 1.0)
  }

  func testDisposeRemovesDaVinciFromRegistry() {
    let davinciId = configureDaVinciAndWait()

    let disposeResolve = expectation(description: "dispose resolve")
    let disposeReject = expectation(description: "dispose reject not called")
    disposeReject.isInverted = true

    RNPingDavinciCommon.dispose(
      davinciId,
      resolver: {
        Task { @MainActor in disposeResolve.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in disposeReject.fulfill() }
      }
    )

    wait(for: [disposeResolve, disposeReject], timeout: 1.0)

    assertReject(
      expectedCode: DaVinciErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciCommon.start(
        davinciId,
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testCleanupThenConfigureDoesNotDropNewDaVinciHandle() {
    let firstId = configureDaVinciAndWait()

    RNPingDavinciCommon.cleanup()

    let secondId = configureDaVinciAndWait()

    assertGetSessionResolves(secondId)

    assertReject(
      expectedCode: DaVinciErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciCommon.start(
        firstId,
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testRapidCleanupConfigureCyclesKeepLatestHandleValid() {
    var latestId: String?

    for _ in 0..<5 {
      RNPingDavinciCommon.cleanup()
      latestId = configureDaVinciAndWait()
    }

    guard let latestId else {
      XCTFail("Expected latest davinci id after configure cycles")
      return
    }

    assertGetSessionResolves(latestId)
  }

  // MARK: - pollDaVinci

  func testPollDaVinciRejectsStateErrorWhenNoContinueNode() {
    assertReject(
      expectedCode: DaVinciErrorCodes.pollError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciCommon.pollDaVinci(
        "missing",
        options: [:],
        resolver: { resolver($0) },
        rejecter: rejecter
      )
    }
  }

  func testPollDaVinciRejectsStateErrorWhenNoPollingCollectorPresent() {
    let davinciId = "no-polling-collector"
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [])
    )

    assertReject(
      expectedCode: DaVinciErrorCodes.pollError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciCommon.pollDaVinci(
        davinciId,
        options: [:],
        resolver: { resolver($0) },
        rejecter: rejecter
      )
    }
  }

  func testPollDaVinciRejectsStateErrorWhenKeyDoesNotMatchAnyPresentCollector() {
    let davinciId = "key-not-among-present-collectors"
    let existing = FakePollingCollector(key: "existing-key", statuses: [.complete(status: "approved")])
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [existing])
    )

    assertReject(
      expectedCode: DaVinciErrorCodes.pollError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciCommon.pollDaVinci(
        davinciId,
        options: ["key": "no-such-key"],
        resolver: { resolver($0) },
        rejecter: rejecter
      )
    }

    XCTAssertFalse(existing.pollWasCalled)
  }

  func testPollDaVinciSelectsCollectorByKeyWhenMultiplePresent() {
    let davinciId = "multi-collector"
    let matching = FakePollingCollector(key: "target-key", statuses: [.complete(status: "approved")])
    let other = FakePollingCollector(key: "other-key", statuses: [.complete(status: "wrong")])
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [other, matching])
    )

    let resolveExpectation = expectation(description: "poll resolve")

    RNPingDavinciCommon.pollDaVinci(
      davinciId,
      options: ["key": "target-key"],
      resolver: { _ in
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in }
    )

    wait(for: [resolveExpectation], timeout: 2.0)
    let pollStartedExpectation = expectation(description: "matching collector polled")
    Task {
      while !matching.pollWasCalled { try? await Task.sleep(nanoseconds: 10_000_000) }
      pollStartedExpectation.fulfill()
    }
    wait(for: [pollStartedExpectation], timeout: 2.0)

    XCTAssertTrue(matching.pollWasCalled)
    XCTAssertFalse(other.pollWasCalled)
  }

  func testPollDaVinciResolvesWithSubscriptionIdBeforeAnyEventIsEmitted() {
    let davinciId = "ordering-check"
    let collector = FakePollingCollector(
      key: "polling-field",
      statuses: [.complete(status: "approved")],
      delayNanoseconds: 200_000_000
    )
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [collector])
    )

    let observer = EventObserver()
    let resolveExpectation = expectation(description: "poll resolve")
    let capture = StringCaptureBox()

    RNPingDavinciCommon.pollDaVinci(
      davinciId,
      options: [:],
      resolver: { payload in
        if let subscriptionId = payload["subscriptionId"] as? String {
          capture.set(subscriptionId)
        }
        // No event should have been observed yet: the fake collector sleeps before yielding.
        XCTAssertEqual(observer.events.count, 0)
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in }
    )

    wait(for: [resolveExpectation], timeout: 2.0)
    XCTAssertNotNil(capture.value)

    let eventExpectation = expectation(description: "event received")
    observer.onEvent = { _ in eventExpectation.fulfill() }
    wait(for: [eventExpectation], timeout: 2.0)
  }

  func testPollDaVinciEmitsContinueThenCompleteEventPayloads() {
    let davinciId = "continue-then-complete"
    let collector = FakePollingCollector(
      key: "polling-field",
      statuses: [.continue(retryCount: 1, maxRetries: 60), .complete(status: "approved")]
    )
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [collector])
    )

    let observer = EventObserver()
    let twoEventsExpectation = expectation(description: "two events received")
    observer.onEvent = { _ in
      if observer.events.count == 2 { twoEventsExpectation.fulfill() }
    }

    let resolveExpectation = expectation(description: "poll resolve")
    let capture = StringCaptureBox()
    RNPingDavinciCommon.pollDaVinci(
      davinciId,
      options: [:],
      resolver: { payload in
        if let subscriptionId = payload["subscriptionId"] as? String {
          capture.set(subscriptionId)
        }
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in }
    )
    wait(for: [resolveExpectation], timeout: 2.0)

    wait(for: [twoEventsExpectation], timeout: 2.0)

    XCTAssertEqual(observer.events[0]["status"] as? String, "continue")
    XCTAssertEqual(observer.events[0]["retryCount"] as? Int, 1)
    XCTAssertEqual(observer.events[0]["maxRetries"] as? Int, 60)
    XCTAssertEqual(observer.events[0]["subscriptionId"] as? String, capture.value)
    XCTAssertEqual(observer.events[0]["daVinciId"] as? String, davinciId)
    XCTAssertEqual(observer.events[1]["status"] as? String, "complete")
    XCTAssertEqual(observer.events[1]["value"] as? String, "approved")
  }

  func testPollDaVinciEmitsTimedOutEvent() {
    assertSinglePollEvent(statuses: [.timedOut]) { event in
      XCTAssertEqual(event["status"] as? String, "timedOut")
    }
  }

  func testPollDaVinciEmitsExpiredEvent() {
    assertSinglePollEvent(statuses: [.expired]) { event in
      XCTAssertEqual(event["status"] as? String, "expired")
    }
  }

  func testPollDaVinciEmitsErrorEventWithMessage() {
    struct SampleError: LocalizedError {
      var errorDescription: String? { "network down" }
    }

    assertSinglePollEvent(statuses: [.error(SampleError())]) { event in
      XCTAssertEqual(event["status"] as? String, "error")
      let errorBody = event["error"] as? [String: Any]
      XCTAssertEqual(errorBody?["message"] as? String, "network down")
    }
  }

  // MARK: - pollDaVinci natural completion does not leak the davinciId-keyed job tracking

  func testPollDaVinciRemovesTaskFromDaVinciIdTrackingOnNaturalCompletion() {
    let davinciId = "natural-completion-no-leak"
    let collector = FakePollingCollector(
      key: "polling-field",
      statuses: [.complete(status: "approved")]
    )
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [collector])
    )

    let observer = EventObserver()
    let eventExpectation = expectation(description: "event received")
    observer.onEvent = { _ in eventExpectation.fulfill() }

    let resolveExpectation = expectation(description: "poll resolve")
    RNPingDavinciCommon.pollDaVinci(
      davinciId,
      options: [:],
      resolver: { _ in
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in }
    )
    wait(for: [resolveExpectation, eventExpectation], timeout: 2.0)

    // Give the natural-completion cleanup a moment to run after the terminal event.
    let settleExpectation = expectation(description: "settle period elapsed")
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
      settleExpectation.fulfill()
    }
    wait(for: [settleExpectation], timeout: 1.0)

    XCTAssertEqual(
      RNPingDavinciCommon._trackedPollTaskCount(for: davinciId),
      0,
      "A naturally completed poll must be removed from the davinciId-keyed tracking " +
        "structure — otherwise finished tasks pile up for the client's lifetime"
    )
  }

  // MARK: - dispose()/cleanup() poll safety net

  func testDisposeCancelsOutstandingPollJobForDaVinciId() {
    let davinciId = "dispose-cancels-poll"
    let collector = FakePollingCollector(
      key: "polling-field",
      statuses: (1...50).map { .continue(retryCount: $0, maxRetries: 60) },
      delayBetweenEmissionsNanoseconds: 30_000_000
    )
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [collector])
    )

    let observer = EventObserver()
    let firstEventExpectation = expectation(description: "first event received")
    firstEventExpectation.assertForOverFulfill = false
    observer.onEvent = { _ in firstEventExpectation.fulfill() }

    let resolveExpectation = expectation(description: "poll resolve")
    RNPingDavinciCommon.pollDaVinci(
      davinciId,
      options: [:],
      resolver: { _ in
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in }
    )
    wait(for: [resolveExpectation, firstEventExpectation], timeout: 2.0)

    let disposeExpectation = expectation(description: "dispose resolve")
    RNPingDavinciCommon.dispose(
      davinciId,
      resolver: {
        Task { @MainActor in disposeExpectation.fulfill() }
      },
      rejecter: { _, _, _ in }
    )
    wait(for: [disposeExpectation], timeout: 1.0)

    let countAtDispose = observer.events.count
    let settleExpectation = expectation(description: "settle period elapsed")
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
      settleExpectation.fulfill()
    }
    wait(for: [settleExpectation], timeout: 1.0)

    XCTAssertEqual(
      observer.events.count,
      countAtDispose,
      "dispose() must cancel outstanding poll tasks for the disposed davinciId"
    )
  }

  func testCleanupCancelsAllOutstandingPollTasks() {
    let davinciId = "cleanup-cancels-poll"
    let collector = FakePollingCollector(
      key: "polling-field",
      statuses: (1...50).map { .continue(retryCount: $0, maxRetries: 60) },
      delayBetweenEmissionsNanoseconds: 30_000_000
    )
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [collector])
    )

    let observer = EventObserver()
    let firstEventExpectation = expectation(description: "first event received")
    firstEventExpectation.assertForOverFulfill = false
    observer.onEvent = { _ in firstEventExpectation.fulfill() }

    let resolveExpectation = expectation(description: "poll resolve")
    RNPingDavinciCommon.pollDaVinci(
      davinciId,
      options: [:],
      resolver: { _ in
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in }
    )
    wait(for: [resolveExpectation, firstEventExpectation], timeout: 2.0)

    RNPingDavinciCommon.cleanup()

    let countAtCleanup = observer.events.count
    let settleExpectation = expectation(description: "settle period elapsed")
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
      settleExpectation.fulfill()
    }
    wait(for: [settleExpectation], timeout: 1.0)

    XCTAssertEqual(
      observer.events.count,
      countAtCleanup,
      "cleanup() must cancel all outstanding poll tasks, matching Android's " +
        "cleanup_cancelsAllOutstandingPollJobs parity test"
    )
  }

  // MARK: - Helpers

  private func assertReject(
    expectedCode: String,
    expectedType: ErrorType,
    call: (
      _ rejecter: @escaping @Sendable (String, String, NSError?) -> Void,
      _ resolver: @escaping @Sendable (NSDictionary) -> Void
    ) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let rejectExpectation = expectation(description: "reject called")
    let resolveExpectation = expectation(description: "resolve not called")
    resolveExpectation.isInverted = true

    let capture = ErrorCaptureBox()

    call({ code, _, error in
      capture.set(code: code, error: error)
      Task { @MainActor in rejectExpectation.fulfill() }
    }, { _ in
      Task { @MainActor in resolveExpectation.fulfill() }
    })

    wait(for: [rejectExpectation, resolveExpectation], timeout: 1.0)

    XCTAssertEqual(capture.code, expectedCode, file: file, line: line)
    XCTAssertEqual(capture.error?.userInfo["type"] as? String, expectedType.rawValue, file: file, line: line)
  }

  /// Same as `assertReject`, sized for `validate()`'s `NSArray`-resolving promise shape.
  private func assertValidateReject(
    expectedCode: String,
    expectedType: ErrorType,
    call: (
      _ rejecter: @escaping @Sendable (String, String, NSError?) -> Void,
      _ resolver: @escaping @Sendable (NSArray) -> Void
    ) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let rejectExpectation = expectation(description: "reject called")
    let resolveExpectation = expectation(description: "resolve not called")
    resolveExpectation.isInverted = true

    let capture = ErrorCaptureBox()

    call({ code, _, error in
      capture.set(code: code, error: error)
      Task { @MainActor in rejectExpectation.fulfill() }
    }, { _ in
      Task { @MainActor in resolveExpectation.fulfill() }
    })

    wait(for: [rejectExpectation, resolveExpectation], timeout: 1.0)

    XCTAssertEqual(capture.code, expectedCode, file: file, line: line)
    XCTAssertEqual(capture.error?.userInfo["type"] as? String, expectedType.rawValue, file: file, line: line)
  }

  /// Calls `validate()` for one collector/value pair and hands the resolved
  /// validation error array to `assertions`.
  private func assertValidateResolves(
    davinciId: String,
    collectorKey: String,
    value: Any,
    file: StaticString = #filePath,
    line: UInt = #line,
    assertions: ([[String: Any]]) -> Void
  ) {
    let resolveExpectation = expectation(description: "validate resolve")
    let rejectExpectation = expectation(description: "validate reject not called")
    rejectExpectation.isInverted = true
    let capture = ErrorsCaptureBox()

    RNPingDavinciCommon.validate(
      davinciId,
      collectorKey: collectorKey,
      input: ["collectors": [["key": collectorKey, "value": value]]],
      resolver: { errors in
        capture.set(errors)
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 1.0)
    assertions(capture.value as? [[String: Any]] ?? [])
  }

  /// Runs `pollDaVinci` against a `FakePollingCollector` that yields a single terminal
  /// status, waits for the corresponding `RNPingDavinci_NativeEmit` notification, and
  /// hands the decoded event body to `assertions`.
  private func assertSinglePollEvent(
    statuses: [PollingStatus],
    file: StaticString = #filePath,
    line: UInt = #line,
    assertions: ([String: Any]) -> Void
  ) {
    let davinciId = "single-event-\(UUID().uuidString)"
    let collector = FakePollingCollector(key: "polling-field", statuses: statuses)
    RNPingDavinciCommon._setContinueNodeForTesting(
      davinciId: davinciId,
      node: makeContinueNode(collectors: [collector])
    )

    let observer = EventObserver()
    let eventExpectation = expectation(description: "event received")
    observer.onEvent = { _ in eventExpectation.fulfill() }

    let resolveExpectation = expectation(description: "poll resolve")
    RNPingDavinciCommon.pollDaVinci(
      davinciId,
      options: [:],
      resolver: { _ in
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in }
    )
    wait(for: [resolveExpectation, eventExpectation], timeout: 2.0)

    guard let event = observer.events.first else {
      XCTFail("Expected one polling status event", file: file, line: line)
      return
    }
    assertions(event)
  }

  private func makeContinueNode(collectors: [any Collector], input: [String: Any] = [:]) -> ContinueNode {
    return TestContinueNode(
      context: FlowContext(flowContext: SharedContext()),
      workflow: Workflow(config: WorkflowConfig()),
      input: input,
      actions: collectors
    )
  }

  private func configureDaVinciAndWait(loggerId: String? = nil) -> String {
    let resolveExpectation = expectation(description: "configure resolve")
    let rejectExpectation = expectation(description: "configure reject not called")
    rejectExpectation.isInverted = true
    let capture = StringCaptureBox()

    var config: [String: Any] = [
      "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
      "clientId": "my-client",
      "redirectUri": "com.example.app://oauth2redirect"
    ]
    if let loggerId {
      config["loggerId"] = loggerId
    }

    RNPingDavinciCommon.configureDaVinci(
      config as NSDictionary,
      resolver: { id in
        capture.set(id)
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 2.0)
    guard let result = capture.value else {
      XCTFail("Expected configured davinci id")
      return "missing"
    }
    return result
  }

  private func assertGetSessionResolves(_ davinciId: String) {
    let resolveExpectation = expectation(description: "getSession resolve")
    let rejectExpectation = expectation(description: "getSession reject not called")
    rejectExpectation.isInverted = true

    RNPingDavinciCommon.getSession(
      davinciId,
      resolver: { _ in
        Task { @MainActor in resolveExpectation.fulfill() }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in rejectExpectation.fulfill() }
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 1.0)
  }
}

private final class TestLoggerHandle: LoggerHandleContract, @unchecked Sendable {
  let loggerLevel: String
  let nativeLogger: Any?

  init(loggerLevel: String) {
    self.loggerLevel = loggerLevel
    self.nativeLogger = LogManager.none
  }
}

private final class TestContinueNode: ContinueNode {
  override func asRequest() -> Request {
    return workflow.config.httpClient.request()
  }
}

/// A bridge-level test double standing in for `PollingCollector` on the active
/// `ContinueNode`. `PollingCollector` is declared `public` (not `open`) in the iOS
/// SDK, so it cannot be subclassed cross-module — this conforms to `Collector` (so
/// it can sit in `node.collectors`) and to `PollableCollector` (the seam
/// `RNPingDavinciCommon.pollDaVinci` actually depends on), replacing the real
/// `poll()` network/timing logic entirely rather than exercising it.
private final class FakePollingCollector: Collector, PollableCollector, @unchecked Sendable {
  typealias T = String

  let id: String
  private let statuses: [PollingStatus]
  private let delayNanoseconds: UInt64
  private let delayBetweenEmissionsNanoseconds: UInt64
  private let lock = NSLock()
  private var _pollWasCalled = false

  var pollWasCalled: Bool {
    lock.lock()
    defer { lock.unlock() }
    return _pollWasCalled
  }

  init(
    key: String,
    statuses: [PollingStatus],
    delayNanoseconds: UInt64 = 0,
    delayBetweenEmissionsNanoseconds: UInt64 = 0
  ) {
    self.id = key
    self.statuses = statuses
    self.delayNanoseconds = delayNanoseconds
    self.delayBetweenEmissionsNanoseconds = delayBetweenEmissionsNanoseconds
  }

  init(with json: [String: Any]) {
    fatalError("Use init(key:statuses:) for tests")
  }

  func initialize(with value: Any) {}

  func payload() -> String? { nil }

  func poll() -> AsyncStream<PollingStatus> {
    lock.lock()
    _pollWasCalled = true
    lock.unlock()
    return AsyncStream { continuation in
      let producerTask = Task { [
        statuses,
        delayNanoseconds,
        delayBetweenEmissionsNanoseconds
      ] in
        if delayNanoseconds > 0 {
          do {
            try await Task.sleep(nanoseconds: delayNanoseconds)
          } catch {
            continuation.finish()
            return
          }
        }
        for status in statuses {
          if Task.isCancelled {
            continuation.finish()
            return
          }
          continuation.yield(status)
          if delayBetweenEmissionsNanoseconds > 0 {
            do {
              try await Task.sleep(nanoseconds: delayBetweenEmissionsNanoseconds)
            } catch {
              continuation.finish()
              return
            }
          }
        }
        continuation.finish()
      }
      continuation.onTermination = { @Sendable _ in
        producerTask.cancel()
      }
    }
  }
}

/// Observes `RNPingDavinci_NativeEmit` notifications posted by `emitPollingStatus`,
/// decoding each `eventBody` for assertions without going through the Obj-C++ bridge
/// modules (`RNPingDavinci`/`RNPingDavinciClassic`), which are not exercised by these
/// Swift-layer unit tests.
private final class EventObserver: @unchecked Sendable {
  private let lock = NSLock()
  private var _events: [[String: Any]] = []
  var onEvent: (([String: Any]) -> Void)?

  var events: [[String: Any]] {
    lock.lock()
    defer { lock.unlock() }
    return _events
  }

  init() {
    NotificationCenter.default.addObserver(
      forName: .pingDavinciNativeEmit,
      object: nil,
      queue: nil
    ) { [weak self] notification in
      guard
        let self,
        let body = notification.userInfo?["eventBody"] as? [String: Any]
      else {
        return
      }
      self.lock.lock()
      self._events.append(body)
      self.lock.unlock()
      self.onEvent?(body)
    }
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }
}
