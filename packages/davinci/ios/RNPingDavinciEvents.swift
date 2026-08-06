/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// DeviceEventEmitter event names used by the RNPingDavinci bridge.
@objcMembers
public class RNPingDavinciEvents: NSObject {
  public static let pollingStatus = "com.pingidentity.rndavinci.PollingStatus"
}

/// `NotificationCenter` notification used to forward events from the Swift common
/// runtime to whichever architecture-specific bridge module (`RNPingDavinci` or
/// `RNPingDavinciClassic`) currently owns JS event forwarding — see
/// `RNPingDavinciEventEmitterGate`.
public extension Notification.Name {
  static let pingDavinciNativeEmit = Notification.Name("RNPingDavinci_NativeEmit")
}
