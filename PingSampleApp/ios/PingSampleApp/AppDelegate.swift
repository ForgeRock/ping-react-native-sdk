/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNPingPush
import UserNotifications
#if canImport(FBSDKCoreKit)
import FBSDKCoreKit
#endif
#if canImport(PingExternalIdPFacebook)
import PingExternalIdPFacebook
#endif
#if canImport(PingExternalIdPGoogle)
import PingExternalIdPGoogle
#endif

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

  // Mirror of the scene's key window. React Native core modules message
  // `application.delegate.window` (RCTDeviceInfo, RCTLogBoxView); SceneDelegate
  // keeps this reference current.
  var window: UIWindow?

  func application(
    _ application: UIApplication,
    willFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Background relaunch (app killed, push arrives): payload comes through
    // didFinishLaunching; scene cold start is handled in SceneDelegate.
    if let userInfo = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
      Self.enqueueColdStartPush(userInfo)
    }
    return true
  }

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
#if canImport(FBSDKCoreKit)
    ApplicationDelegate.shared.application(
      application,
      didFinishLaunchingWithOptions: launchOptions,
    )
#endif

    UNUserNotificationCenter.current().delegate = self
    UNUserNotificationCenter.current().requestAuthorization(
      options: [.alert, .sound, .badge]
    ) { granted, _ in
      if granted {
        DispatchQueue.main.async { application.registerForRemoteNotifications() }
      }
    }

    return true
  }

  func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    RNPingPushBridge.forwardToken(deviceToken)
  }

  func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {}

  func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    RNPingPushBridge.forwardNotification(userInfo)
    completionHandler(.newData)
  }

  // Show banner, sound, and badge even when the app is foregrounded.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound, .badge])
  }

  // Forward banner taps to the Ping Push SDK.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    RNPingPushBridge.forwardNotification(response.notification.request.content.userInfo)
    completionHandler()
  }

  func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    Self.handleOpenURL(url: url, options: options)
    return true
  }

  private static let enqueuedPushLock = NSLock()
  private nonisolated(unsafe) static var enqueuedPushMessageIds = Set<String>()

  /// Forwards a cold-start push payload to the bridge once per `messageId`, since the bridge
  /// buffer is append-only and both launch paths can report the same notification.
  static func enqueueColdStartPush(_ userInfo: [AnyHashable: Any]) {
    let aps = userInfo["aps"] as? [AnyHashable: Any]
    let messageId = (aps?["messageId"] as? String) ?? (userInfo["messageId"] as? String)
    if let messageId, !messageId.isEmpty {
      enqueuedPushLock.lock()
      let isNew = enqueuedPushMessageIds.insert(messageId).inserted
      enqueuedPushLock.unlock()
      if !isNew {
        NSLog("Skipping duplicate cold-start push with messageId %@", messageId)
        return
      }
    }
    RNPingPushCommon.enqueuePendingMessage(userInfo)
  }

  static func handleOpenURL(url: URL, options: [UIApplication.OpenURLOptionsKey: Any]) {
    // Only registered provider callbacks reach the IdP SDKs: Facebook uses the
    // `fb<app-id>` scheme, Google the reversed client ID. Unrelated deep links
    // must not be forwarded.
    let scheme = url.scheme?.lowercased()
#if canImport(PingExternalIdPFacebook)
    if scheme?.hasPrefix("fb") == true {
      FacebookHandler.handleOpenURL(UIApplication.shared, url: url, options: options)
    }
#endif
#if canImport(PingExternalIdPGoogle)
    if scheme?.hasPrefix("com.googleusercontent.apps.") == true {
      GoogleHandler.handleOpenURL(UIApplication.shared, url: url, options: options)
    }
#endif
  }
}

/// React Native factory delegate that resolves JS bundle locations.
class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  /// Provide the bridge source URL for the active build configuration.
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  /// Resolve the JavaScript bundle URL for debug and release builds.
  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
