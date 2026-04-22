/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingDeviceClient
import RNPingCore
@testable import RNPingDeviceClient

/// Unit tests for ``DeviceErrorMapper``.
///
/// Covers every `DeviceError` case, the `DecodingError` fallback, and the
/// generic `Error` fallback to ensure the JS-facing `GenericError` payload
/// is stable across releases.
final class DeviceErrorMapperTests: XCTestCase {

  // MARK: - mapDeviceError

  func testNetworkError() {
    let underlying = NSError(domain: "Test", code: 0, userInfo: [NSLocalizedDescriptionKey: "offline"])
    let mapped = DeviceErrorMapper.mapDeviceError(.networkError(error: underlying))
    XCTAssertEqual(mapped.type, .networkError)
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.network.rawValue)
    XCTAssertEqual(mapped.message, "offline")
  }

  func testRequestFailed401MapsToInvalidToken() {
    let mapped = DeviceErrorMapper.mapDeviceError(.requestFailed(statusCode: 401, message: "expired"))
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.invalidToken.rawValue)
    XCTAssertEqual(mapped.status as? Int, 401)
    XCTAssertTrue(mapped.message?.contains("expired") ?? false)
  }

  func testRequestFailed404MapsToNotFound() {
    let mapped = DeviceErrorMapper.mapDeviceError(.requestFailed(statusCode: 404, message: ""))
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.notFound.rawValue)
    XCTAssertEqual(mapped.status as? Int, 404)
    XCTAssertEqual(mapped.message, "Request failed with status 404")
  }

  func testRequestFailedOtherStatusMapsToRequestFailed() {
    let mapped = DeviceErrorMapper.mapDeviceError(.requestFailed(statusCode: 500, message: "boom"))
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.requestFailed.rawValue)
    XCTAssertEqual(mapped.status as? Int, 500)
    XCTAssertTrue(mapped.message?.contains("500") ?? false)
    XCTAssertTrue(mapped.message?.contains("boom") ?? false)
  }

  func testInvalidUrlMapsToMissingConfig() {
    let mapped = DeviceErrorMapper.mapDeviceError(.invalidUrl(url: "not a url"))
    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.missingConfig.rawValue)
    XCTAssertTrue(mapped.message?.contains("not a url") ?? false)
  }

  func testDecodingFailedMapsToDecodingFailed() {
    let underlying = NSError(domain: "Decode", code: 1, userInfo: [NSLocalizedDescriptionKey: "bad json"])
    let mapped = DeviceErrorMapper.mapDeviceError(.decodingFailed(error: underlying))
    XCTAssertEqual(mapped.type, .parseError)
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.decodingFailed.rawValue)
    XCTAssertEqual(mapped.message, "bad json")
  }

  func testEncodingFailedMapsToDecodingFailed() {
    let mapped = DeviceErrorMapper.mapDeviceError(.encodingFailed(message: "bad payload"))
    XCTAssertEqual(mapped.type, .parseError)
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.decodingFailed.rawValue)
    XCTAssertEqual(mapped.message, "bad payload")
  }

  func testInvalidResponseMapsToDecodingFailed() {
    let mapped = DeviceErrorMapper.mapDeviceError(.invalidResponse(message: "malformed"))
    XCTAssertEqual(mapped.type, .parseError)
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.decodingFailed.rawValue)
    XCTAssertEqual(mapped.message, "malformed")
  }

  func testInvalidTokenMapsToInvalidToken() {
    let mapped = DeviceErrorMapper.mapDeviceError(.invalidToken(message: "expired"))
    XCTAssertEqual(mapped.type, .authError)
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.invalidToken.rawValue)
    XCTAssertEqual(mapped.message, "expired")
  }

  func testMissingConfigurationMapsToMissingConfig() {
    let mapped = DeviceErrorMapper.mapDeviceError(.missingConfiguration(message: "serverUrl missing"))
    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.missingConfig.rawValue)
    XCTAssertEqual(mapped.message, "serverUrl missing")
  }

  // MARK: - mapError fallbacks

  func testMapErrorDelegatesDeviceError() {
    let mapped = DeviceErrorMapper.mapError(DeviceError.invalidToken(message: "nope"))
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.invalidToken.rawValue)
  }

  func testMapErrorWrapsDecodingError() {
    struct Dummy: Decodable { let x: Int }
    var decodeError: Error?
    do {
      _ = try JSONDecoder().decode(Dummy.self, from: Data("{}".utf8))
    } catch {
      decodeError = error
    }
    let mapped = DeviceErrorMapper.mapError(decodeError!)
    XCTAssertEqual(mapped.type, .parseError)
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.decodingFailed.rawValue)
  }

  func testMapErrorFallsBackToUnknown() {
    let generic = NSError(domain: "Anywhere", code: 0, userInfo: [NSLocalizedDescriptionKey: "huh"])
    let mapped = DeviceErrorMapper.mapError(generic)
    XCTAssertEqual(mapped.type, .unknownError)
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.unknown.rawValue)
  }

  // MARK: - factory helpers

  func testHandleNotFoundError() {
    let mapped = DeviceErrorMapper.handleNotFoundError()
    XCTAssertEqual(mapped.type, .stateError)
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.handleNotFound.rawValue)
  }

  func testInvalidDeviceType() {
    let mapped = DeviceErrorMapper.invalidDeviceType("fingerprint")
    XCTAssertEqual(mapped.type, .argumentError)
    XCTAssertEqual(mapped.error, DeviceClientErrorCode.unknown.rawValue)
    XCTAssertTrue(mapped.message?.contains("fingerprint") ?? false)
  }
}
