/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingCore

@available(iOS 16.0, *)
final class PromiseBridgeTests: XCTestCase {

  func testResolveForwardsValue() {
    var resolvedValue: String?
    let bridge = PromiseBridge<String>(resolver: { value in
      resolvedValue = value
    })

    bridge.resolve("ok")

    XCTAssertEqual(resolvedValue, "ok")
  }

  func testRejectForwardsGenericErrorPayload() {
    var rejectedCode: String?
    var rejectedMessage: String?
    var rejectedError: NSError?
    let bridge = PromiseBridge<String>(
      resolver: { _ in },
      rejecter: { code, message, error in
        rejectedCode = code
        rejectedMessage = message
        rejectedError = error
      }
    )

    let error = GenericError(
      type: .argumentError,
      error: "TEST_ERROR",
      message: "Invalid input"
    )
    bridge.reject(error)

    XCTAssertEqual(rejectedCode, "TEST_ERROR")
    XCTAssertEqual(rejectedMessage, "Invalid input")
    XCTAssertEqual(rejectedError?.userInfo["type"] as? String, "argument_error")
    XCTAssertEqual(rejectedError?.userInfo["error"] as? String, "TEST_ERROR")
    XCTAssertEqual(rejectedError?.userInfo["message"] as? String, "Invalid input")
  }

  func testRejectUsesProvidedUnderlyingError() {
    var rejectedError: NSError?
    let bridge = PromiseBridge<String>(
      resolver: { _ in },
      rejecter: { _, _, error in
        rejectedError = error
      }
    )

    let underlying = NSError(domain: "test.domain", code: 42)
    let error = GenericError(type: .internalError, error: "TEST_ERROR")
    bridge.reject(error, underlying: underlying)

    XCTAssertTrue(rejectedError === underlying)
  }

  func testRejectCodeMessageForwardsValues() {
    var rejectedCode: String?
    var rejectedMessage: String?
    var rejectedError: NSError?
    let bridge = PromiseBridge<String>(
      resolver: { _ in },
      rejecter: { code, message, error in
        rejectedCode = code
        rejectedMessage = message
        rejectedError = error
      }
    )

    let underlying = NSError(domain: "test.domain", code: 7)
    bridge.reject(code: "MANUAL_ERROR", message: "Manual reject", underlying: underlying)

    XCTAssertEqual(rejectedCode, "MANUAL_ERROR")
    XCTAssertEqual(rejectedMessage, "Manual reject")
    XCTAssertTrue(rejectedError === underlying)
  }

  func testRejectWithoutRejecterDoesNotCrash() {
    let bridge = PromiseBridge<String>(resolver: { _ in })
    let error = GenericError(type: .unknownError, error: "NO_REJECTER")

    bridge.reject(error)
    bridge.reject(code: "MANUAL_ERROR", message: "ignored")
  }
}
