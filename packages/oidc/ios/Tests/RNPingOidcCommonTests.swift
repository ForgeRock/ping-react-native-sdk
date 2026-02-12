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
    call: (_ rejecter: @escaping (String, String, NSError?) -> Void, _ resolver: @escaping (NSDictionary) -> Void) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let rejectExpectation = expectation(description: "rejecter called")
    let resolveExpectation = expectation(description: "resolver not called")
    resolveExpectation.isInverted = true

    var capturedError: NSError?
    var capturedCode: String?

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

  private func assertClientVoidRejects(
    expectedCode: String,
    expectedType: ErrorType,
    call: (_ rejecter: @escaping (String, String, NSError?) -> Void, _ resolver: @escaping () -> Void) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let rejectExpectation = expectation(description: "rejecter called")
    let resolveExpectation = expectation(description: "resolver not called")
    resolveExpectation.isInverted = true

    var capturedError: NSError?
    var capturedCode: String?

    call({ code, _, error in
      capturedCode = code
      capturedError = error
      rejectExpectation.fulfill()
    }, {
      resolveExpectation.fulfill()
    })

    wait(for: [rejectExpectation, resolveExpectation], timeout: 1.0)

    XCTAssertEqual(capturedCode, expectedCode, file: file, line: line)
    XCTAssertEqual(capturedError?.userInfo["type"] as? String, expectedType.rawValue, file: file, line: line)
  }

  private func assertClientBoolRejects(
    expectedCode: String,
    expectedType: ErrorType,
    call: (_ rejecter: @escaping (String, String, NSError?) -> Void, _ resolver: @escaping (Bool) -> Void) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let rejectExpectation = expectation(description: "rejecter called")
    let resolveExpectation = expectation(description: "resolver not called")
    resolveExpectation.isInverted = true

    var capturedError: NSError?
    var capturedCode: String?

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

  private func assertWebRejects(
    expectedCode: String,
    expectedType: ErrorType,
    call: (_ rejecter: @escaping (String, String, NSError?) -> Void, _ resolver: @escaping (NSDictionary) -> Void) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    assertClientRejects(expectedCode: expectedCode, expectedType: expectedType, call: call, file: file, line: line)
  }

  private func assertWebBoolRejects(
    expectedCode: String,
    expectedType: ErrorType,
    call: (_ rejecter: @escaping (String, String, NSError?) -> Void, _ resolver: @escaping (Bool) -> Void) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    assertClientBoolRejects(expectedCode: expectedCode, expectedType: expectedType, call: call, file: file, line: line)
  }

  private func assertWebVoidRejects(
    expectedCode: String,
    expectedType: ErrorType,
    call: (_ rejecter: @escaping (String, String, NSError?) -> Void, _ resolver: @escaping () -> Void) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    assertClientVoidRejects(expectedCode: expectedCode, expectedType: expectedType, call: call, file: file, line: line)
  }
}
