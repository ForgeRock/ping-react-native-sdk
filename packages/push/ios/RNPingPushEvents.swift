/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Internal DeviceEventEmitter event names used by the RNPingPush bridge.
@objcMembers
public class RNPingPushEvents: NSObject {
    public static let fcmTokenReceived  = "com.pingidentity.rnpush.FCMTokenReceived"
    public static let apnsTokenReceived = "com.pingidentity.rnpush.APNsTokenReceived"
    public static let pushMessageReceived = "com.pingidentity.rnpush.PushMessageReceived"
}

/// NotificationCenter notification names used to forward APNs events to the bridge.
public extension Notification.Name {
    static let pingAPNsToken = Notification.Name("com.pingidentity.rnpush.APNsToken")
    static let pingRemoteNotification = Notification.Name("com.pingidentity.rnpush.RemoteNotification")
}
