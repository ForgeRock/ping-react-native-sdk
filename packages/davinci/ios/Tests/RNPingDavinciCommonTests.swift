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
import PingLogger
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
      expectedCode: DaVinciErrorCodes.nextError.rawValue,
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

  private func configureDaVinciAndWait() -> String {
    let resolveExpectation = expectation(description: "configure resolve")
    let rejectExpectation = expectation(description: "configure reject not called")
    rejectExpectation.isInverted = true
    let capture = StringCaptureBox()

    RNPingDavinciCommon.configureDaVinci(
      [
        "discoveryEndpoint": "https://auth.example.com/.well-known/openid-configuration",
        "clientId": "my-client",
        "redirectUri": "com.example.app://oauth2redirect"
      ],
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
