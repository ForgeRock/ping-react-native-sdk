//
//  DaVinciErrorMapperTests.swift
//  RNPingDavinci
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import XCTest
import PingOidc
@testable import RNPingCore
@testable import RNPingDavinci

final class DaVinciErrorMapperTests: XCTestCase {

  func testMapHandlesNilError() {
    let mapped = DaVinciErrorMapper.map(nil, code: .unknownError)

    XCTAssertEqual(mapped.type, .internalError)
    XCTAssertEqual(mapped.error, DaVinciErrorCodes.unknownError.rawValue)
    XCTAssertEqual(mapped.message, "Unknown DaVinci error")
  }

  func testMapHandlesOidcAuthorizeError() {
    let mapped = DaVinciErrorMapper.map(
      OidcError.authorizeError(message: "auth failed"),
      code: .startError
    )

    XCTAssertEqual(mapped.type, .authError)
    XCTAssertEqual(mapped.error, DaVinciErrorCodes.startError.rawValue)
    XCTAssertEqual(mapped.message, "auth failed")
  }

  func testMapHandlesOidcNetworkError() {
    let mapped = DaVinciErrorMapper.map(
      OidcError.networkError(message: "timeout"),
      code: .nextError
    )

    XCTAssertEqual(mapped.type, .networkError)
    XCTAssertEqual(mapped.error, DaVinciErrorCodes.nextError.rawValue)
    XCTAssertEqual(mapped.message, "timeout")
  }

  func testMapHandlesOidcApiError() {
    let mapped = DaVinciErrorMapper.map(
      OidcError.apiError(code: 401, message: "unauthorized"),
      code: .sessionError
    )

    XCTAssertEqual(mapped.type, .exchangeError)
    XCTAssertEqual(mapped.error, DaVinciErrorCodes.sessionError.rawValue)
    XCTAssertEqual(mapped.message, "unauthorized")
    XCTAssertEqual(mapped.status as? Int, 401)
  }

  func testMapHandlesOidcUnknownError() {
    let mapped = DaVinciErrorMapper.map(
      OidcError.unknown(message: "something weird"),
      code: .unknownError
    )

    XCTAssertEqual(mapped.type, .unknownError)
    XCTAssertEqual(mapped.error, DaVinciErrorCodes.unknownError.rawValue)
    XCTAssertEqual(mapped.message, "something weird")
  }

  func testMapHandlesBridgeArgumentError() {
    let mapped = DaVinciErrorMapper.map(
      DaVinciBridgeError.argument("bad input"),
      code: .configError
    )

    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, DaVinciErrorCodes.configError.rawValue)
    XCTAssertEqual(mapped.message, "bad input")
  }

  func testMapHandlesBridgeStateError() {
    let mapped = DaVinciErrorMapper.map(
      DaVinciBridgeError.state("missing instance"),
      code: .stateError
    )

    XCTAssertEqual(mapped.type, .stateError)
    XCTAssertEqual(mapped.error, DaVinciErrorCodes.stateError.rawValue)
    XCTAssertEqual(mapped.message, "missing instance")
  }

  func testMapHandlesBridgeUnsupportedCollectorError() {
    let mapped = DaVinciErrorMapper.map(
      DaVinciBridgeError.unsupportedCollector("collector not supported"),
      code: .nextError
    )

    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, DaVinciErrorCodes.unsupportedCollectorError.rawValue)
    XCTAssertEqual(mapped.message, "collector not supported")
  }

  func testMapHandlesBridgeCollectorApplyError() {
    let mapped = DaVinciErrorMapper.map(
      DaVinciBridgeError.collectorApply("apply failed"),
      code: .nextError
    )

    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, DaVinciErrorCodes.collectorApplyError.rawValue)
    XCTAssertEqual(mapped.message, "apply failed")
  }

  func testMapHandlesUrlError() {
    let mapped = DaVinciErrorMapper.map(
      URLError(.timedOut),
      code: .nextError
    )

    XCTAssertEqual(mapped.type, .networkError)
    XCTAssertEqual(mapped.error, DaVinciErrorCodes.nextError.rawValue)
  }

  func testMapFallsBackToInternalErrorForNSError() {
    let mapped = DaVinciErrorMapper.map(
      NSError(domain: "custom.domain", code: 77, userInfo: [NSLocalizedDescriptionKey: "boom"]),
      code: .initError
    )

    XCTAssertEqual(mapped.type, .internalError)
    XCTAssertEqual(mapped.error, DaVinciErrorCodes.initError.rawValue)
    XCTAssertEqual(mapped.message, "boom")
    XCTAssertEqual(mapped.code as? Int, 77)
  }

  // MARK: - state / argument convenience builders

  func testStateBuilderProducesStateError() {
    let mapped = DaVinciErrorMapper.state(code: .stateError, message: "no active flow")

    XCTAssertEqual(mapped.type, .stateError)
    XCTAssertEqual(mapped.error, DaVinciErrorCodes.stateError.rawValue)
    XCTAssertEqual(mapped.message, "no active flow")
  }

  func testArgumentBuilderProducesArgumentError() {
    let mapped = DaVinciErrorMapper.argument(code: .configError, message: "missing field")

    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, DaVinciErrorCodes.configError.rawValue)
    XCTAssertEqual(mapped.message, "missing field")
  }
}
