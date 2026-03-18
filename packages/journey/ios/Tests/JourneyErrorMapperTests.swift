/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingJourney
import PingOidc
@testable import RNPingCore
@testable import RNPingJourney

final class JourneyErrorMapperTests: XCTestCase {

  func testMapHandlesNilError() {
    let mapped = JourneyErrorMapper.map(nil, code: .userError)

    XCTAssertEqual(mapped.type, .internalError)
    XCTAssertEqual(mapped.error, JourneyErrorCodes.userError.rawValue)
    XCTAssertEqual(mapped.message, "Unknown Journey error")
  }

  func testMapHandlesOidcAuthorizeError() {
    let mapped = JourneyErrorMapper.map(
      OidcError.authorizeError(message: "auth failed"),
      code: .userError
    )

    XCTAssertEqual(mapped.type, .authError)
    XCTAssertEqual(mapped.error, JourneyErrorCodes.userError.rawValue)
    XCTAssertEqual(mapped.message, "auth failed")
  }

  func testMapHandlesOidcNetworkError() {
    let mapped = JourneyErrorMapper.map(
      OidcError.networkError(message: "offline"),
      code: .userError
    )

    XCTAssertEqual(mapped.type, .networkError)
    XCTAssertEqual(mapped.error, JourneyErrorCodes.userError.rawValue)
    XCTAssertEqual(mapped.message, "offline")
  }

  func testMapHandlesOidcApiError() {
    let mapped = JourneyErrorMapper.map(
      OidcError.apiError(code: 403, message: "forbidden"),
      code: .userError
    )

    XCTAssertEqual(mapped.type, .exchangeError)
    XCTAssertEqual(mapped.error, JourneyErrorCodes.userError.rawValue)
    XCTAssertEqual(mapped.message, "forbidden")
    XCTAssertEqual(mapped.status as? Int, 403)
  }

  func testMapHandlesJourneyApiError() {
    let mapped = JourneyErrorMapper.map(
      ApiError.error(401, [:], "unauthorized"),
      code: .nextError
    )

    XCTAssertEqual(mapped.type, .exchangeError)
    XCTAssertEqual(mapped.error, JourneyErrorCodes.nextError.rawValue)
    XCTAssertEqual(mapped.message, "unauthorized")
    XCTAssertEqual(mapped.status as? Int, 401)
  }

  func testMapHandlesBridgeError() {
    let mapped = JourneyErrorMapper.map(
      JourneyBridgeError.argument("bad input"),
      code: .startError
    )

    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, JourneyErrorCodes.startError.rawValue)
    XCTAssertEqual(mapped.message, "bad input")
  }

  func testMapHandlesUrlError() {
    let mapped = JourneyErrorMapper.map(
      URLError(.timedOut),
      code: .resumeError
    )

    XCTAssertEqual(mapped.type, .networkError)
    XCTAssertEqual(mapped.error, JourneyErrorCodes.resumeError.rawValue)
  }

  func testMapFallsBackToInternalError() {
    let mapped = JourneyErrorMapper.map(
      NSError(domain: "custom.domain", code: 99, userInfo: [NSLocalizedDescriptionKey: "boom"]),
      code: .initError
    )

    XCTAssertEqual(mapped.type, .internalError)
    XCTAssertEqual(mapped.error, JourneyErrorCodes.initError.rawValue)
    XCTAssertEqual(mapped.message, "boom")
    XCTAssertEqual(mapped.code as? Int, 99)
  }
}
