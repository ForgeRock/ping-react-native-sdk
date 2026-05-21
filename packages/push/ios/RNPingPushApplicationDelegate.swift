/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import UIKit
import UserNotifications

/// Optional base class for apps with no existing APNs integration.
///
/// Subclass this instead of `UIResponder` and call `requestPushAuthorization(application:)`
/// from `application(_:didFinishLaunchingWithOptions:)`:
///
/// ```swift
/// import RNPingPush
///
/// @main
/// class AppDelegate: RNPingPushApplicationDelegate {
///   override func application(_ application: UIApplication,
///     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
///   ) -> Bool {
///     // ... React Native factory setup ...
///     requestPushAuthorization(application: application)
///     return true
///   }
/// }
/// ```
///
/// If you already have your own `AppDelegate`, use `NotificationCenter` posts to
/// `com.pingidentity.rnpush.APNsToken` and `com.pingidentity.rnpush.RemoteNotification` instead.
open class RNPingPushApplicationDelegate: UIResponder, UIApplicationDelegate, @preconcurrency UNUserNotificationCenterDelegate {

    public var window: UIWindow?

    /// Presentation options used when a push notification arrives while the app is foregrounded.
    /// Defaults to `[.banner, .sound, .badge]`. Override in your subclass init or
    /// `didFinishLaunchingWithOptions` to suppress or change the foreground banner behaviour.
    open var foregroundPresentationOptions: UNNotificationPresentationOptions = [.banner, .sound, .badge]

    // Captured in willFinishLaunchingWithOptions (before the subclass didFinishLaunching runs)
    // so requestPushAuthorization can buffer cold-start payloads without requiring launchOptions
    // to be passed explicitly.
    private var _launchOptions: [UIApplication.LaunchOptionsKey: Any]?

    open func application(
        _ application: UIApplication,
        willFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        _launchOptions = launchOptions
        return true
    }

    /// Requests user permission for push alerts, sounds, and badges,
    /// then registers the device with APNs if permission is granted.
    open func requestPushAuthorization(application: UIApplication) {
        // Cold-start tap: the OS won't call didReceiveRemoteNotification when the app is launched
        // by a notification tap. The payload is only in launchOptions, captured before the React
        // Native bridge loaded. Queue it so consumePendingMessages() can drain it.
        if let userInfo = _launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
            let payload = userInfo as? [String: Any] ?? [:]
            RNPingPushCommon.enqueuePendingMessage(payload)
        }

        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound, .badge]
        ) { granted, _ in
            if granted {
                DispatchQueue.main.async { application.registerForRemoteNotifications() }
            }
        }
    }

    /// Show banner, sound, and badge even when the app is foregrounded.
    open func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler(foregroundPresentationOptions)
    }

    /// Forward tapped notifications to the Push SDK so the in-app modal appears.
    open func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let payload = userInfo as? [String: Any] ?? [:]
        NotificationCenter.default.post(
            name: .pingRemoteNotification,
            object: nil,
            userInfo: payload
        )
        completionHandler()
    }

    open func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        NotificationCenter.default.post(
            name: .pingAPNsToken,
            object: nil,
            userInfo: ["token": token]
        )
    }

    open func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {}

    open func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        // Pass the full raw APNs userInfo — processNotification(userInfo:) in the Ping SDK
        // handles extracting aps["data"] → "message" and aps["messageId"] internally.
        let payload = userInfo as? [String: Any] ?? [:]
        NotificationCenter.default.post(
            name: .pingRemoteNotification,
            object: nil,
            userInfo: payload
        )
        completionHandler(.newData)
    }
}
