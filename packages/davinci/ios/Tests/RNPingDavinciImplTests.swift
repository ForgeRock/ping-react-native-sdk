//
//  RNPingDavinciImplTests.swift
//  RNPingDavinci
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import XCTest
@testable import RNPingDavinci
@testable import RNPingCore

@MainActor
final class RNPingDavinciImplTests: XCTestCase {
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
    RNPingDavinciCommon.cleanup()
  }

  override func tearDown() {
    RNPingDavinciCommon.cleanup()
    super.tearDown()
  }

  func testConfigureDaVinciRejectsWhenDiscoveryEndpointMissing() {
    let impl = RNPingDavinciImpl.shared
    let rejectExpectation = expectation(description: "reject called")
    let resolveExpectation = expectation(description: "resolve not called")
    resolveExpectation.isInverted = true

    let capture = ErrorCaptureBox()
    impl.configureDaVinci(
      [:],
      resolver: { _ in resolveExpectation.fulfill() },
      rejecter: { code, _, error in
        capture.set(code: code, error: error)
        rejectExpectation.fulfill()
      }
    )

    wait(for: [rejectExpectation, resolveExpectation], timeout: 1.0)
    XCTAssertEqual(capture.code, DaVinciErrorCodes.configError.rawValue)
    XCTAssertEqual(capture.error?.userInfo["type"] as? String, ErrorType.argumentError.rawValue)
  }

  func testStartRejectsWhenDaVinciMissing() {
    assertReject(
      expectedCode: DaVinciErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciImpl.shared.start(
        "missing",
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testNextRejectsWhenDaVinciMissing() {
    assertReject(
      expectedCode: DaVinciErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciImpl.shared.next(
        "missing",
        input: [:],
        resolver: resolver,
        rejecter: rejecter
      )
    }
  }

  func testDisposeResolvesWhenDaVinciMissing() {
    let resolveExpectation = expectation(description: "resolve called")
    let rejectExpectation = expectation(description: "reject not called")
    rejectExpectation.isInverted = true

    RNPingDavinciImpl.shared.dispose(
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

  func testInvalidateCallsCleanup() {
    // After invalidate, a previously configured instance should no longer be accessible.
    RNPingDavinciImpl.shared.invalidate()

    assertReject(
      expectedCode: DaVinciErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingDavinciImpl.shared.start(
        "any-id",
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
