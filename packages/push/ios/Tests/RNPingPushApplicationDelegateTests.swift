/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import UserNotifications
@testable import RNPingPush

final class RNPingPushApplicationDelegateTests: XCTestCase {

  // MARK: - foregroundPresentationOptions default

  func testForegroundPresentationOptionsDefaultToBannerSoundBadge() {
    let delegate = RNPingPushApplicationDelegate()
    let expected: UNNotificationPresentationOptions = [.banner, .sound, .badge]
    XCTAssertEqual(delegate.foregroundPresentationOptions, expected)
  }

  // MARK: - foregroundPresentationOptions mutability

  func testForegroundPresentationOptionsCanBeChangedAfterInit() {
    let delegate = RNPingPushApplicationDelegate()
    XCTAssertEqual(delegate.foregroundPresentationOptions, [.banner, .sound, .badge])
    delegate.foregroundPresentationOptions = [.badge]
    XCTAssertEqual(delegate.foregroundPresentationOptions, [.badge])
  }

  func testForegroundPresentationOptionsCanBeSetToSoundOnly() {
    let delegate = RNPingPushApplicationDelegate()
    delegate.foregroundPresentationOptions = [.sound]
    XCTAssertEqual(delegate.foregroundPresentationOptions, [.sound])
  }

  func testForegroundPresentationOptionsCanBeSetToEmpty() {
    let delegate = RNPingPushApplicationDelegate()
    delegate.foregroundPresentationOptions = []
    XCTAssertEqual(delegate.foregroundPresentationOptions, [])
  }

  // MARK: - Subclass override

  func testSubclassCanOverrideForegroundPresentationOptionsInInit() {
    class SoundOnlyDelegate: RNPingPushApplicationDelegate {
      override init() {
        super.init()
        foregroundPresentationOptions = [.sound]
      }
    }
    let delegate = SoundOnlyDelegate()
    XCTAssertEqual(delegate.foregroundPresentationOptions, [.sound])
  }

  func testSubclassCanSuppressForegroundPresentationEntirely() {
    class SilentDelegate: RNPingPushApplicationDelegate {
      override init() {
        super.init()
        foregroundPresentationOptions = []
      }
    }
    let delegate = SilentDelegate()
    XCTAssertEqual(delegate.foregroundPresentationOptions, [])
  }
}
