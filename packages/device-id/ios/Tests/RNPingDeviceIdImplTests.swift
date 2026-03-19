/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingDeviceId


final class RNPingDeviceIdImplTests: XCTestCase {

  private var deviceIdImpl: RNPingDeviceIdImpl!

  override func setUp() async throws {
    try await super.setUp()
    deviceIdImpl = RNPingDeviceIdImpl.shared
  }

  override func tearDown() async throws {
    deviceIdImpl = nil
    try await super.tearDown()
  }

  // MARK: - Singleton Tests

  func testSharedInstanceIsSingleton() {
    let instance1 = RNPingDeviceIdImpl.shared
    let instance2 = RNPingDeviceIdImpl.shared

    XCTAssertTrue(instance1 === instance2, "Shared instance should return the same singleton")
  }

  // MARK: - Device ID Tests

  func testGetDefaultDeviceIdReturnsNonEmptyString() async throws {
    switch await fetchDefaultDeviceIdResult() {
    case .success(let deviceId):
      XCTAssertFalse(deviceId.isEmpty, "Device ID should not be empty")
    case .failure(let error):
      assertExpectedDeviceIdFailure(error)
    }
  }

  func testGetDefaultDeviceIdIsStableWithinProcess() async throws {
    let firstResult = await fetchDefaultDeviceIdResult()
    let secondResult = await fetchDefaultDeviceIdResult()

    switch (firstResult, secondResult) {
    case let (.success(first), .success(second)):
      XCTAssertEqual(first, second, "Device ID should be stable across multiple calls")
    case let (.failure(firstError), .failure(secondError)):
      assertExpectedDeviceIdFailure(firstError)
      assertExpectedDeviceIdFailure(secondError)
    case let (.failure(error), _), let (_, .failure(error)):
      assertExpectedDeviceIdFailure(error)
    }
  }

  private func fetchDefaultDeviceIdResult() async -> Result<String, Error> {
    do {
      let value = try await fetchDefaultDeviceId()
      return .success(value)
    } catch {
      return .failure(error)
    }
  }

  @MainActor
  private func fetchDefaultDeviceId() async throws -> String {
    try await withCheckedThrowingContinuation { continuation in
      deviceIdImpl.getDefaultDeviceId { value in
        if let deviceId = value as? String {
          continuation.resume(returning: deviceId)
        } else {
          continuation.resume(throwing: NSError(
            domain: "RNPingDeviceIdTests",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Device ID resolved with unexpected value."]
          ))
        }
      } rejecter: { code, message, error in
        let userInfo: [String: Any] = [
          NSLocalizedDescriptionKey: message ?? "Device ID rejected with error code \(code ?? "UNKNOWN")"
        ]
        continuation.resume(throwing: error ?? NSError(
          domain: "RNPingDeviceIdTests",
          code: 2,
          userInfo: userInfo
        ))
      }
    }
  }

  private func assertExpectedDeviceIdFailure(_ error: Error) {
    let message = String(describing: error)
    let isExpectedFailure = message.localizedCaseInsensitiveContains("encryptionInitializationFailed") ||
      message.localizedCaseInsensitiveContains("Encryption initialization failed")

    XCTAssertTrue(
      isExpectedFailure,
      "Unexpected device identifier failure: \(message)"
    )
  }
}
