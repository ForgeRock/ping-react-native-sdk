/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingOidc
@testable import RNPingCore
@testable import RNPingOidc

@available(iOS 16.0, *)
final class OidcErrorMapperTests: XCTestCase {

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
