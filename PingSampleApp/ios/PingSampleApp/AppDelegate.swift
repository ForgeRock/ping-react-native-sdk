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
/// UIApplication delegate that bootstraps the React Native sample app.
///
/// **Push SDK integration point (Scenario A):** Inherits `RNPingPushApplicationDelegate` instead of
/// `UIResponder`. The superclass implements `didRegisterForRemoteNotificationsWithDeviceToken` and
/// `didReceiveRemoteNotification` to forward APNs events to the Ping Push SDK automatically.
/// If you already have your own `AppDelegate` superclass, see Scenario B/C in the Push SDK README.
class AppDelegate: RNPingPushApplicationDelegate {

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  /// Configure and launch the React Native runtime.
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

    // Push SDK integration point: requests APNs permission and registers the device for
    // remote notifications. Token and message delivery are handled by the superclass.
    requestPushAuthorization(application: application)

    return true
  }

  /// Routes incoming URL callbacks to native Google Sign-In when the Google IdP pod is available.
  func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    var handled = false
#if canImport(PingExternalIdPFacebook)
    handled = FacebookHandler.handleOpenURL(application, url: url, options: options)
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
