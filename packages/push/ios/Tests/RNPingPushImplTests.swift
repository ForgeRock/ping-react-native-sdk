/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
@testable import RNPingPush

@MainActor
final class RNPingPushImplTests: XCTestCase {

  // MARK: - initialize

  func testInitializeResolvesWithClientHandle() async {
    let result = await invokeInitialize(config: [:])
    XCTAssertTrue(result.resolved, "initialize should resolve with a client handle")
    XCTAssertNil(result.code)
  }

  // MARK: - NOT_INITIALIZED guard (unknown handle)

  func testAddCredentialFromUriRejectsWhenClientNotFound() async {
    let result = await invokeAddCredentialFromUri(clientId: "unknown-handle", uri: "pushauth://test")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testGetCredentialsRejectsWhenClientNotFound() async {
    let result = await invokeGetCredentials(clientId: "unknown-handle")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testApproveNotificationRejectsWhenClientNotFound() async {
    let result = await invokeApproveNotification(clientId: "unknown-handle", notificationId: "notif-1")
    XCTAssertEqual(result.code, "not_initialized")
  }

  func testDenyNotificationRejectsWhenClientNotFound() async {
    let result = await invokeDenyNotification(clientId: "unknown-handle", notificationId: "notif-1")
    XCTAssertEqual(result.code, "not_initialized")
  }

  // MARK: - close

  func testCloseResolvesWhenClientNotFound() async {
    let result = await invokeClose(clientId: "unknown-handle")
    XCTAssertTrue(result.resolved)
    XCTAssertNil(result.code)
  }

  // MARK: - Helpers

  private func invokeInitialize(config: NSDictionary) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushImpl.shared.initialize(config) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeAddCredentialFromUri(clientId: String, uri: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushImpl.shared.addCredentialFromUri(clientId, uri: uri) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeGetCredentials(clientId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushImpl.shared.getCredentials(clientId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeApproveNotification(clientId: String, notificationId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushImpl.shared.approveNotification(clientId, notificationId: notificationId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeDenyNotification(clientId: String, notificationId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushImpl.shared.denyNotification(clientId, notificationId: notificationId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }

  private func invokeClose(clientId: String) async -> (resolved: Bool, code: String?) {
    await withCheckedContinuation { continuation in
      RNPingPushImpl.shared.close(clientId) { _ in
        continuation.resume(returning: (true, nil))
      } rejecter: { code, _, _ in
        continuation.resume(returning: (false, code))
      }
    }
  }
}
