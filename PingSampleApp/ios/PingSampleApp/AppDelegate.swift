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
import LineSDK
import RNPingExternalIdp
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

  var window: UIWindow?
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  // Capture cold-start payload before the React bridge loads so consumePendingMessages
  // can drain it when the first PushClient is created.
  func application(
    _ application: UIApplication,
    willFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    if let userInfo = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
      RNPingPushCommon.enqueuePendingMessage(userInfo)
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

    // A rejected registration (blank or built-in provider name) is a programming
    // error that must fail at launch, not at the first login attempt.
    registerLineIdpHandler()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "PingSampleApp",
      in: window,
      launchOptions: launchOptions
    )

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

  /// Registers the LINE IdP handler under every provider name the Journey
  /// callback may carry: the AIC instance name verbatim plus, when prefixed,
  /// the `react-native-`-stripped alias. The external IdP registry resolves
  /// handlers by exact match on the callback's provider name, so the prefixed
  /// AIC instance name in use on this tenant ("line" was already taken) must
  /// be registered verbatim for resolution to succeed.
  private func registerLineIdpHandler() {
    let handler = LineIdpHandler()
    let instanceName = "react-native-line"
    try! RNPingExternalIdpCommon.registerIdpHandler(instanceName, handler: handler)
    if let alias = Self.strippedReactNativePrefix(from: instanceName) {
      try! RNPingExternalIdpCommon.registerIdpHandler(alias, handler: handler)
    }
  }

  /// Strips the `react-native-` prefix from an IdP provider name.
  ///
  /// - Parameter providerName: Provider name from the AIC IdP instance.
  /// - Returns: The name without the prefix, or nil when the name carries no
  /// prefix or nothing remains after stripping.
  private static func strippedReactNativePrefix(from providerName: String) -> String? {
    let prefix = "react-native-"
    let stripped = providerName.dropFirst(prefix.count)
    guard providerName.hasPrefix(prefix), !stripped.isEmpty else { return nil }
    return String(stripped)
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
    var handled = LoginManager.shared.application(application, open: url, options: options)
#if canImport(PingExternalIdPFacebook)
    handled = FacebookHandler.handleOpenURL(application, url: url, options: options) || handled
#endif
#if canImport(PingExternalIdPGoogle)
    handled = GoogleHandler.handleOpenURL(application, url: url, options: options) || handled
#endif
    return handled
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
