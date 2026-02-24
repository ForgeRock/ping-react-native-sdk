/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingCore
@testable import RNPingJourney

final class RNPingJourneyCommonTests: XCTestCase {
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
    RNPingJourneyCommon.cleanup()
  }

  override func tearDown() {
    RNPingJourneyCommon.cleanup()
    Task {
      await CoreRuntime.loggerRegistry.removeAll()
    }
    super.tearDown()
  }

  func testConfigureJourneyRejectsWhenServerUrlMissing() {
    let rejectExpectation = expectation(description: "reject called")
    let resolveExpectation = expectation(description: "resolve not called")
    resolveExpectation.isInverted = true

    let capture = ErrorCaptureBox()

    RNPingJourneyCommon.configureJourney(
      [:],
      resolver: { _ in
        Task { @MainActor in
          resolveExpectation.fulfill()
        }
      },
      rejecter: { code, _, error in
        capture.set(code: code, error: error)
        Task { @MainActor in
          rejectExpectation.fulfill()
        }
      }
    )

    wait(for: [rejectExpectation, resolveExpectation], timeout: 1.0)

    XCTAssertEqual(capture.code, JourneyErrorCodes.configError.rawValue)
    XCTAssertEqual(capture.error?.userInfo["type"] as? String, ErrorType.argumentError.rawValue)
  }

  func testConfigureJourneyAcceptsResolvedLoggerId() async {
    let loggerId = await CoreRuntime.loggerRegistry.register(
      TestLoggerHandle(loggerLevel: "STANDARD")
    )

    let resolveExpectation = expectation(description: "resolve called")
    let rejectExpectation = expectation(description: "reject not called")
    rejectExpectation.isInverted = true

    RNPingJourneyCommon.configureJourney(
      [
        "serverUrl": "https://example.com/am",
        "loggerId": loggerId
      ],
      resolver: { _ in
        Task { @MainActor in
          resolveExpectation.fulfill()
        }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in
          rejectExpectation.fulfill()
        }
      }
    )

    await fulfillment(of: [resolveExpectation, rejectExpectation], timeout: 1.0)
  }

  func testConfigureJourneyAcceptsMissingLoggerId() async {
    let resolveExpectation = expectation(description: "resolve called")
    let rejectExpectation = expectation(description: "reject not called")
    rejectExpectation.isInverted = true

    RNPingJourneyCommon.configureJourney(
      [
        "serverUrl": "https://example.com/am",
        "loggerId": "missing-logger-handle"
      ],
      resolver: { _ in
        Task { @MainActor in
          resolveExpectation.fulfill()
        }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in
          rejectExpectation.fulfill()
        }
      }
    )

    await fulfillment(of: [resolveExpectation, rejectExpectation], timeout: 1.0)
  }

  func testStartRejectsWhenJourneyMissing() {
    assertReject(
      expectedCode: JourneyErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingJourneyCommon.start(
        "missing",
        journeyName: "Login",
        forceAuth: false,
        noSession: false,
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testStartRejectsWhenJourneyNameIsBlank() {
    assertReject(
      expectedCode: JourneyErrorCodes.startError.rawValue,
      expectedType: .argumentError
    ) { rejecter, resolver in
      RNPingJourneyCommon.start(
        "any-id",
        journeyName: "   ",
        forceAuth: false,
        noSession: false,
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testNextRejectsWhenJourneyMissing() {
    assertReject(
      expectedCode: JourneyErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingJourneyCommon.next(
        "missing",
        input: [:],
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testNextRejectsWhenCallbackInputIsMalformed() {
    assertReject(
      expectedCode: JourneyErrorCodes.nextError.rawValue,
      expectedType: .argumentError
    ) { rejecter, resolver in
      RNPingJourneyCommon.next(
        "any-id",
        input: ["callbacks": ["invalid-item"]],
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testResumeRejectsWhenJourneyMissing() {
    assertReject(
      expectedCode: JourneyErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingJourneyCommon.resume(
        "missing",
        uri: "com.example://resume",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testResumeRejectsWhenUriIsBlank() {
    assertReject(
      expectedCode: JourneyErrorCodes.resumeError.rawValue,
      expectedType: .argumentError
    ) { rejecter, resolver in
      RNPingJourneyCommon.resume(
        "any-id",
        uri: "   ",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testGetSessionRejectsWhenJourneyMissing() {
    assertReject(
      expectedCode: JourneyErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingJourneyCommon.getSession(
        "missing",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testLogoutRejectsWhenJourneyMissing() {
    assertReject(
      expectedCode: JourneyErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingJourneyCommon.logout(
        "missing",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testRefreshRejectsWhenJourneyMissing() {
    assertReject(
      expectedCode: JourneyErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingJourneyCommon.refresh(
        "missing",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testRevokeRejectsWhenJourneyMissing() {
    assertReject(
      expectedCode: JourneyErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingJourneyCommon.revoke(
        "missing",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testUserInfoRejectsWhenJourneyMissing() {
    assertReject(
      expectedCode: JourneyErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingJourneyCommon.userinfo(
        "missing",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testSSOTokenRejectsWhenJourneyMissing() {
    assertReject(
      expectedCode: JourneyErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingJourneyCommon.ssoToken(
        "missing",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testDisposeResolvesWhenJourneyMissing() {
    let resolveExpectation = expectation(description: "resolve called")
    let rejectExpectation = expectation(description: "reject not called")
    rejectExpectation.isInverted = true

    RNPingJourneyCommon.dispose(
      "missing",
      resolver: {
        Task { @MainActor in
          resolveExpectation.fulfill()
        }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in
          rejectExpectation.fulfill()
        }
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 1.0)
  }

  func testDisposeRemovesJourneyFromRegistry() {
    let journeyId = configureJourneyAndWait(
      [
        "serverUrl": "https://example.com/am"
      ]
    )

    let disposeResolve = expectation(description: "dispose resolve")
    let disposeReject = expectation(description: "dispose reject not called")
    disposeReject.isInverted = true

    RNPingJourneyCommon.dispose(
      journeyId,
      resolver: {
        Task { @MainActor in
          disposeResolve.fulfill()
        }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in
          disposeReject.fulfill()
        }
      }
    )

    wait(for: [disposeResolve, disposeReject], timeout: 1.0)

    assertReject(
      expectedCode: JourneyErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingJourneyCommon.start(
        journeyId,
        journeyName: "Login",
        forceAuth: false,
        noSession: false,
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  private func assertReject(
    expectedCode: String,
    expectedType: ErrorType,
    call: (
      _ rejecter: @escaping @Sendable (String, String, NSError?) -> Void,
      _ resolver: @escaping @Sendable (Any?) -> Void
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
      Task { @MainActor in
        rejectExpectation.fulfill()
      }
    }, { _ in
      Task { @MainActor in
        resolveExpectation.fulfill()
      }
    })

    wait(for: [rejectExpectation, resolveExpectation], timeout: 1.0)

    XCTAssertEqual(capture.code, expectedCode, file: file, line: line)
    XCTAssertEqual(capture.error?.userInfo["type"] as? String, expectedType.rawValue, file: file, line: line)
  }

  private func configureJourneyAndWait(_ config: NSDictionary) -> String {
    let resolveExpectation = expectation(description: "configure resolve")
    let rejectExpectation = expectation(description: "configure reject not called")
    rejectExpectation.isInverted = true
    let capture = StringCaptureBox()

    RNPingJourneyCommon.configureJourney(
      config,
      resolver: { journeyId in
        capture.set(journeyId)
        Task { @MainActor in
          resolveExpectation.fulfill()
        }
      },
      rejecter: { _, _, _ in
        Task { @MainActor in
          rejectExpectation.fulfill()
        }
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 1.0)
    guard let result = capture.value else {
      XCTFail("Expected configured journey id")
      return "missing"
    }
    return result
  }
}

private final class TestLoggerHandle: LoggerHandleContract, @unchecked Sendable {
  let loggerLevel: String

  init(loggerLevel: String) {
    self.loggerLevel = loggerLevel
  }
}
