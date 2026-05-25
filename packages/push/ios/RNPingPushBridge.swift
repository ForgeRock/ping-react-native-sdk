/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Public API for wiring an existing APNs delegate or JS push library into the Ping Push SDK.
///
/// **Scenario A** (JS push library): call `forwardToken` and `forwardNotification` from your
/// library's native token/message callbacks.
///
/// **Scenario B** (existing native APNs delegate): add two lines to your `AppDelegate`:
///
/// ```swift
/// func application(_ application: UIApplication,
///     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
///     existingSdk.register(deviceToken)
///     RNPingPushBridge.forwardToken(deviceToken) // ← add
/// }
///
/// func application(_ application: UIApplication,
///     didReceiveRemoteNotification userInfo: [AnyHashable: Any],
///     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
///     existingSdk.handleNotification(userInfo)
///     RNPingPushBridge.forwardNotification(userInfo) // ← add
///     completionHandler(.newData)
/// }
/// ```
@objcMembers
public class RNPingPushBridge: NSObject {

    /// Forwards an APNs device token to the Ping Push SDK bridge.
    ///
    /// Posts to `Notification.Name.pingAPNsToken` on `NotificationCenter.default`.
    public static func forwardToken(_ deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        NotificationCenter.default.post(
            name: .pingAPNsToken,
            object: nil,
            userInfo: ["token": token]
        )
    }

    /// Forwards an incoming remote notification payload to the Ping Push SDK bridge.
    ///
    /// Posts to `Notification.Name.pingRemoteNotification` on `NotificationCenter.default`.
    public static func forwardNotification(_ userInfo: [AnyHashable: Any]) {
        let payload = userInfo as? [String: Any] ?? [:]
        NotificationCenter.default.post(
            name: .pingRemoteNotification,
            object: nil,
            userInfo: payload
        )
    }
}
