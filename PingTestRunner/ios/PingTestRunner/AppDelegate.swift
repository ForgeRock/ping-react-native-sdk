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
import WebKit

@main
/// UIApplication delegate that bootstraps the React Native sample app.
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  /// Configure and launch the React Native runtime.
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    let window = UIWindow(frame: UIScreen.main.bounds)
    self.window = window

    // With -PING_CLEAR_STORAGE YES, wipe browser/system cookie stores and the
    // app keychain before RN starts. The SDK persists ST/SSO cookies and OIDC
    // tokens in keychain-backed storage (PingOrchestrate CookieModule /
    // PingOidc config storage); those cookies ride along on every authorize
    // request and let the server resume a previous SSO interaction, returning
    // SuccessNode instead of the login form. The sign-off path only clears its
    // own entries, and uninstalling does not reliably purge keychain items on
    // simulators, so test harnesses pass this arg to guarantee each launch
    // starts without a live auth session. RN boot is deferred until the wipe
    // completes: WKWebsiteDataStore removal is async, and booting first would
    // let start() fire while a stale SSO record still exists.
    if ProcessInfo.processInfo.arguments.contains("-PING_CLEAR_STORAGE") {
      Self.clearAuthStorage {
        DispatchQueue.main.async {
          factory.startReactNative(
            withModuleName: "PingTestRunner",
            in: window,
            launchOptions: launchOptions
          )
        }
      }
    } else {
      factory.startReactNative(
        withModuleName: "PingTestRunner",
        in: window,
        launchOptions: launchOptions
      )
    }

    return true
  }

  /// Wipes cookie stores and keychain items, invoking `completion` after every
  /// store is cleared. HTTPCookieStorage and keychain deletion are synchronous;
  /// WKWebsiteDataStore removal is asynchronous and gates the completion.
  private static func clearAuthStorage(completion: @escaping () -> Void) {
    HTTPCookieStorage.shared.removeCookies(since: Date.distantPast)
    for itemClass in [
      kSecClassGenericPassword,
      kSecClassInternetPassword,
      kSecClassCertificate,
      kSecClassKey,
    ] {
      SecItemDelete([kSecClass: itemClass] as CFDictionary)
    }
    WKWebsiteDataStore.default().fetchDataRecords(
      ofTypes: WKWebsiteDataStore.allWebsiteDataTypes()
    ) { records in
      guard !records.isEmpty else {
        completion()
        return
      }
      WKWebsiteDataStore.default().removeData(
        ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
        for: records,
        completionHandler: completion
      )
    }
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
