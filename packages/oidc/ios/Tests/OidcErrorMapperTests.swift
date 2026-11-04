/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingBrowser
import PingOidc
@testable import RNPingCore
@testable import RNPingOidc

final class OidcErrorMapperTests: XCTestCase {

  func testIsUserCancellationTrueForBrowserCancelCause() {
    let error = OidcError.authorizeError(
      cause: BrowserError.externalUserAgentCancelled,
      message: "Browser authorization failed"
    )

    XCTAssertTrue(OidcErrorMapper.isUserCancellation(error))
  }

  func testIsUserCancellationFalseForOtherBrowserCause() {
    let error = OidcError.authorizeError(cause: BrowserError.externalUserAgentFailure, message: "failed")

    XCTAssertFalse(OidcErrorMapper.isUserCancellation(error))
  }

  func testIsUserCancellationFalseWhenAuthorizeErrorHasNoCause() {
    XCTAssertFalse(OidcErrorMapper.isUserCancellation(OidcError.authorizeError(message: "no code")))
  }

  func testIsUserCancellationFalseForNonAuthorizeErrors() {
    XCTAssertFalse(OidcErrorMapper.isUserCancellation(OidcError.unknown(cause: BrowserError.externalUserAgentCancelled)))
    XCTAssertFalse(OidcErrorMapper.isUserCancellation(OidcError.networkError(message: "timeout")))
  }

  func testMapOidcErrorAuthorizeError() {
    let error = OidcError.authorizeError(message: "authorize failed")

    let mapped = OidcErrorMapper.mapOidcError(error, code: .authorizeError)

    XCTAssertEqual(mapped.type, .authError)
    XCTAssertEqual(mapped.error, OidcErrorCodes.authorizeError.rawValue)
    XCTAssertEqual(mapped.message, "authorize failed")
  }

  func testMapOidcErrorNetworkError() {
    let error = OidcError.networkError(message: "timeout")

    let mapped = OidcErrorMapper.mapOidcError(error, code: .tokenError)

    XCTAssertEqual(mapped.type, .networkError)
    XCTAssertEqual(mapped.error, OidcErrorCodes.tokenError.rawValue)
    XCTAssertEqual(mapped.message, "timeout")
  }

  func testMapOidcErrorApiError() {
    let error = OidcError.apiError(code: 403, message: "forbidden")

    let mapped = OidcErrorMapper.mapOidcError(error, code: .tokenError)

    XCTAssertEqual(mapped.type, .exchangeError)
    XCTAssertEqual(mapped.error, OidcErrorCodes.tokenError.rawValue)
    XCTAssertEqual(mapped.message, "forbidden")
    XCTAssertEqual(mapped.status as? Int, 403)
  }

  func testMapOidcErrorUnknownError() {
    let error = OidcError.unknown(message: "unknown")

    let mapped = OidcErrorMapper.mapOidcError(error, code: .tokenError)

    XCTAssertEqual(mapped.type, .unknownError)
    XCTAssertEqual(mapped.error, OidcErrorCodes.tokenError.rawValue)
    XCTAssertEqual(mapped.message, "unknown")
  }

  func testMapAuthorizeThrowableHandlesNil() {
    let mapped = OidcErrorMapper.mapAuthorizeThrowable(nil)

    XCTAssertEqual(mapped.type, .internalError)
    XCTAssertEqual(mapped.error, OidcErrorCodes.authorizeError.rawValue)
    XCTAssertEqual(mapped.message, "Unknown authorization error")
  }

  func testMapAuthorizeThrowableHandlesOidcError() {
    let mapped = OidcErrorMapper.mapAuthorizeThrowable(
      OidcError.networkError(message: "network down")
    )

    XCTAssertEqual(mapped.type, .networkError)
    XCTAssertEqual(mapped.error, OidcErrorCodes.authorizeError.rawValue)
    XCTAssertEqual(mapped.message, "network down")
  }
}
