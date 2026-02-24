/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingJourney
@testable import RNPingCore

@MainActor
final class RNPingJourneyImplTests: XCTestCase {
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

  override func setUp() {
    super.setUp()
    RNPingJourneyCommon.cleanup()
  }

  override func tearDown() {
    RNPingJourneyCommon.cleanup()
    super.tearDown()
  }

  func testConfigureJourneyRejectsWhenServerUrlMissing() {
    let impl = RNPingJourneyImpl.shared
    let rejectExpectation = expectation(description: "reject called")
    let resolveExpectation = expectation(description: "resolve not called")
    resolveExpectation.isInverted = true

    let capture = ErrorCaptureBox()
    impl.configureJourney(
      [:],
      resolver: { _ in resolveExpectation.fulfill() },
      rejecter: { code, _, error in
        capture.set(code: code, error: error)
        rejectExpectation.fulfill()
      }
    )

    wait(for: [rejectExpectation, resolveExpectation], timeout: 1.0)
    XCTAssertEqual(capture.code, JourneyErrorCodes.configError.rawValue)
    XCTAssertEqual(capture.error?.userInfo["type"] as? String, ErrorType.argumentError.rawValue)
  }

  func testStartRejectsWhenJourneyMissing() {
    assertReject(
      expectedCode: JourneyErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingJourneyImpl.shared.start(
        "missing",
        journeyName: "Login",
        options: ["forceAuth": true, "noSession": true],
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
      RNPingJourneyImpl.shared.next(
        "missing",
        nodeId: "ignored-node-id",
        input: [:],
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testDisposeResolvesWhenJourneyMissing() {
    let resolveExpectation = expectation(description: "resolve called")
    let rejectExpectation = expectation(description: "reject not called")
    rejectExpectation.isInverted = true

    RNPingJourneyImpl.shared.dispose(
      "missing",
      resolver: {
        resolveExpectation.fulfill()
      },
      rejecter: { _, _, _ in
        rejectExpectation.fulfill()
      }
    )

    wait(for: [resolveExpectation, rejectExpectation], timeout: 1.0)
  }

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
      rejectExpectation.fulfill()
    }, { _ in
      resolveExpectation.fulfill()
    })

    wait(for: [rejectExpectation, resolveExpectation], timeout: 1.0)
    XCTAssertEqual(capture.code, expectedCode, file: file, line: line)
    XCTAssertEqual(capture.error?.userInfo["type"] as? String, expectedType.rawValue, file: file, line: line)
  }
}
