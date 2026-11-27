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

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

  var window: UIWindow?
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }

    // Cold-start push payload arrives through scene connection options under
    // the UIScene lifecycle, not through didFinishLaunching launchOptions.
    if let userInfo = connectionOptions.notificationResponse?.notification.request.content
      .userInfo {
      AppDelegate.enqueueColdStartPush(userInfo)
    }

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(windowScene: windowScene)

    // Keep UIApplicationDelegate.window in sync for modules that message it
    // (RCTDeviceInfo dimension broadcast, RCTLogBoxView).
    (UIApplication.shared.delegate as? AppDelegate)?.window = window

    factory.startReactNative(
      withModuleName: "PingSampleApp",
      in: window,
      launchOptions: nil
    )
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for urlContext in URLContexts {
      let opts = urlContext.options
      var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
      if let sourceApplication = opts.sourceApplication {
        options[.sourceApplication] = sourceApplication
      }
      if let annotation = opts.annotation {
        options[.annotation] = annotation
      }
      AppDelegate.handleOpenURL(url: urlContext.url, options: options)
    }
  }
}
