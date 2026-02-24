/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingCore
@testable import RNPingOidc

final class RNPingOidcCommonTests: XCTestCase {
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

  func testClientTokenRejectsWhenClientMissing() {
    assertClientRejects(
      expectedCode: OidcErrorCodes.tokenError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingOidcCommon.clientToken("missing-client", resolver: resolver, rejecter: rejecter)
    }
  }

  func testClientRefreshRejectsWhenClientMissing() {
    assertClientRejects(
      expectedCode: OidcErrorCodes.refreshError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingOidcCommon.clientRefresh("missing-client", resolver: resolver, rejecter: rejecter)
    }
  }

  func testClientUserinfoRejectsWhenClientMissing() {
    assertClientRejects(
      expectedCode: OidcErrorCodes.userinfoError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingOidcCommon.clientUserinfo("missing-client", cache: true, resolver: resolver, rejecter: rejecter)
    }
  }

  func testClientRevokeRejectsWhenClientMissing() {
    assertClientVoidRejects(
      expectedCode: OidcErrorCodes.revokeError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingOidcCommon.clientRevoke("missing-client", resolver: resolver, rejecter: rejecter)
    }
  }

  func testClientEndSessionRejectsWhenClientMissing() {
    assertClientBoolRejects(
      expectedCode: OidcErrorCodes.logoutError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingOidcCommon.clientEndSession("missing-client", resolver: resolver, rejecter: rejecter)
    }
  }

  func testAuthorizeRejectsWhenWebClientMissing() {
    assertWebRejects(
      expectedCode: OidcErrorCodes.authorizeError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingOidcCommon.authorize("missing-web", options: [:], resolver: resolver, rejecter: rejecter)
    }
  }

  func testHasUserRejectsWhenWebClientMissing() {
    assertWebBoolRejects(
      expectedCode: OidcErrorCodes.hasUserError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingOidcCommon.hasUser("missing-web", resolver: resolver, rejecter: rejecter)
    }
  }

  func testTokenRejectsWhenWebClientMissing() {
    assertWebRejects(
      expectedCode: OidcErrorCodes.tokenError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingOidcCommon.token("missing-web", resolver: resolver, rejecter: rejecter)
    }
  }

  func testRefreshRejectsWhenWebClientMissing() {
    assertWebRejects(
      expectedCode: OidcErrorCodes.refreshError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingOidcCommon.refresh("missing-web", resolver: resolver, rejecter: rejecter)
    }
  }

  func testUserinfoRejectsWhenWebClientMissing() {
    assertWebRejects(
      expectedCode: OidcErrorCodes.userinfoError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingOidcCommon.userinfo("missing-web", cache: true, resolver: resolver, rejecter: rejecter)
    }
  }

  func testRevokeRejectsWhenWebClientMissing() {
    assertWebVoidRejects(
      expectedCode: OidcErrorCodes.revokeError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingOidcCommon.revoke("missing-web", resolver: resolver, rejecter: rejecter)
    }
  }

  func testLogoutRejectsWhenWebClientMissing() {
    assertWebVoidRejects(
      expectedCode: OidcErrorCodes.logoutError.rawValue,
      expectedType: .stateError
    ) { rejecter, resolver in
      RNPingOidcCommon.logout("missing-web", resolver: resolver, rejecter: rejecter)
    }
  }

  private func assertClientRejects(
    expectedCode: String,
    expectedType: ErrorType,
    call: (
      _ rejecter: @escaping @Sendable (String, String, NSError?) -> Void,
      _ resolver: @escaping @Sendable (NSDictionary) -> Void
    ) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let rejectExpectation = expectation(description: "rejecter called")
    let resolveExpectation = expectation(description: "resolver not called")
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

  private func assertClientVoidRejects(
    expectedCode: String,
    expectedType: ErrorType,
    call: (
      _ rejecter: @escaping @Sendable (String, String, NSError?) -> Void,
      _ resolver: @escaping @Sendable () -> Void
    ) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let rejectExpectation = expectation(description: "rejecter called")
    let resolveExpectation = expectation(description: "resolver not called")
    resolveExpectation.isInverted = true

    let capture = ErrorCaptureBox()

    call({ code, _, error in
      capture.set(code: code, error: error)
      Task { @MainActor in
        rejectExpectation.fulfill()
      }
    }, {
      Task { @MainActor in
        resolveExpectation.fulfill()
      }
    })

    wait(for: [rejectExpectation, resolveExpectation], timeout: 1.0)

    XCTAssertEqual(capture.code, expectedCode, file: file, line: line)
    XCTAssertEqual(capture.error?.userInfo["type"] as? String, expectedType.rawValue, file: file, line: line)
  }

  private func assertClientBoolRejects(
    expectedCode: String,
    expectedType: ErrorType,
    call: (
      _ rejecter: @escaping @Sendable (String, String, NSError?) -> Void,
      _ resolver: @escaping @Sendable (Bool) -> Void
    ) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let rejectExpectation = expectation(description: "rejecter called")
    let resolveExpectation = expectation(description: "resolver not called")
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

  private func assertWebRejects(
    expectedCode: String,
    expectedType: ErrorType,
    call: (
      _ rejecter: @escaping @Sendable (String, String, NSError?) -> Void,
      _ resolver: @escaping @Sendable (NSDictionary) -> Void
    ) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    assertClientRejects(expectedCode: expectedCode, expectedType: expectedType, call: call, file: file, line: line)
  }

  private func assertWebBoolRejects(
    expectedCode: String,
    expectedType: ErrorType,
    call: (
      _ rejecter: @escaping @Sendable (String, String, NSError?) -> Void,
      _ resolver: @escaping @Sendable (Bool) -> Void
    ) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    assertClientBoolRejects(expectedCode: expectedCode, expectedType: expectedType, call: call, file: file, line: line)
  }

  private func assertWebVoidRejects(
    expectedCode: String,
    expectedType: ErrorType,
    call: (
      _ rejecter: @escaping @Sendable (String, String, NSError?) -> Void,
      _ resolver: @escaping @Sendable () -> Void
    ) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    assertClientVoidRejects(expectedCode: expectedCode, expectedType: expectedType, call: call, file: file, line: line)
  }
}
