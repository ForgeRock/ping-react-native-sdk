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

  override func setUp() {
    super.setUp()
    RNPingJourneyCommon.cleanup()
  }

  override func tearDown() {
    RNPingJourneyCommon.cleanup()
    super.tearDown()
  }

  func testConfigureJourneyRejectsWhenServerUrlMissing() {
    let rejectExpectation = expectation(description: "reject called")
    let resolveExpectation = expectation(description: "resolve not called")
    resolveExpectation.isInverted = true

    var capturedCode: String?
    var capturedError: NSError?

    RNPingJourneyCommon.configureJourney(
      [:],
      resolver: { _ in
        resolveExpectation.fulfill()
      },
      rejecter: { code, _, error in
        capturedCode = code
        capturedError = error
        rejectExpectation.fulfill()
      }
    )

    wait(for: [rejectExpectation, resolveExpectation], timeout: 1.0)

    XCTAssertEqual(capturedCode, JourneyErrorCodes.configError.rawValue)
    XCTAssertEqual(capturedError?.userInfo["type"] as? String, ErrorType.argumentError.rawValue)
  }

  func testStartRejectsWhenJourneyMissing() {
    assertReject(
      expectedCode: JourneyErrorCodes.stateError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingJourneyCommon.start(
        "missing",
        journeyName: "Login",
        options: nil,
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

  private func assertReject(
    expectedCode: String,
    expectedType: ErrorType,
    call: (
      _ rejecter: @escaping (String, String, NSError?) -> Void,
      _ resolver: @escaping (Any?) -> Void
    ) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let rejectExpectation = expectation(description: "reject called")
    let resolveExpectation = expectation(description: "resolve not called")
    resolveExpectation.isInverted = true

    var capturedCode: String?
    var capturedError: NSError?

    call({ code, _, error in
      capturedCode = code
      capturedError = error
      rejectExpectation.fulfill()
    }, { _ in
      resolveExpectation.fulfill()
    })

    wait(for: [rejectExpectation, resolveExpectation], timeout: 1.0)

    XCTAssertEqual(capturedCode, expectedCode, file: file, line: line)
    XCTAssertEqual(capturedError?.userInfo["type"] as? String, expectedType.rawValue, file: file, line: line)
  }
}
