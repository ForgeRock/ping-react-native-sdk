/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingCore

/// Tests boolean value reads from React Native readable maps.
final class ReadableMapUtilsTests: XCTestCase {

  /// Verifies a missing key returns nil.
  func testReadBooleanReturnsNilWhenKeyIsMissing() throws {
    let result = try ReadableMapUtils.readBoolean(NSDictionary(), key: "par")

    XCTAssertNil(result)
  }

  /// Verifies a null value returns nil.
  func testReadBooleanReturnsNilWhenValueIsNull() throws {
    let map: NSDictionary = ["par": NSNull()]

    let result = try ReadableMapUtils.readBoolean(map, key: "par")

    XCTAssertNil(result)
  }

  /// Verifies an explicit true value is preserved.
  func testReadBooleanPreservesExplicitTrue() throws {
    let map: NSDictionary = ["par": true]

    let result = try ReadableMapUtils.readBoolean(map, key: "par")

    XCTAssertEqual(result, true)
  }

  /// Verifies an explicit false value is preserved.
  func testReadBooleanPreservesExplicitFalse() throws {
    let map: NSDictionary = ["par": false]

    let result = try ReadableMapUtils.readBoolean(map, key: "par")

    XCTAssertEqual(result, false)
  }

  /// Verifies a non-boolean value throws an error.
  func testReadBooleanThrowsOnNonBooleanValue() {
    let map: NSDictionary = ["par": "true"]

    XCTAssertThrowsError(try ReadableMapUtils.readBoolean(map, key: "par"))
  }

  /// Verifies a numeric 0 is rejected rather than coerced to false.
  func testReadBooleanThrowsOnNumericZero() {
    let map: NSDictionary = ["par": NSNumber(value: 0)]

    XCTAssertThrowsError(try ReadableMapUtils.readBoolean(map, key: "par"))
  }

  /// Verifies a numeric 1 is rejected rather than coerced to true.
  func testReadBooleanThrowsOnNumericOne() {
    let map: NSDictionary = ["par": NSNumber(value: 1)]

    XCTAssertThrowsError(try ReadableMapUtils.readBoolean(map, key: "par"))
  }
}
