/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingCore

final class ReadableMapUtilsTests: XCTestCase {

  func testReadBooleanReturnsNilWhenKeyIsMissing() throws {
    let result = try ReadableMapUtils.readBoolean(NSDictionary(), key: "par")

    XCTAssertNil(result)
  }

  func testReadBooleanReturnsNilWhenValueIsNull() throws {
    let map: NSDictionary = ["par": NSNull()]

    let result = try ReadableMapUtils.readBoolean(map, key: "par")

    XCTAssertNil(result)
  }

  func testReadBooleanPreservesExplicitTrue() throws {
    let map: NSDictionary = ["par": true]

    let result = try ReadableMapUtils.readBoolean(map, key: "par")

    XCTAssertEqual(result, true)
  }

  func testReadBooleanPreservesExplicitFalse() throws {
    let map: NSDictionary = ["par": false]

    let result = try ReadableMapUtils.readBoolean(map, key: "par")

    XCTAssertEqual(result, false)
  }

  func testReadBooleanThrowsOnNonBooleanValue() {
    let map: NSDictionary = ["par": "true"]

    XCTAssertThrowsError(try ReadableMapUtils.readBoolean(map, key: "par"))
  }
}
