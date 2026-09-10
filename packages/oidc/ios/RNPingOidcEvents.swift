//
//  RNPingOidcEvents.swift
//  RNPingOidc
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation

/// DeviceEventEmitter event names used by the OIDC bridge.
@objcMembers
public final class RNPingOidcEvents: NSObject {
  /// Device authorization status event.
  public static let deviceFlowStatus = "RNPingOidc_DeviceFlowStatus"
}

/// Internal notification used by architecture-specific bridges to forward events.
public extension Notification.Name {
  static let pingOidcNativeEmit = Notification.Name("RNPingOidc_NativeEmit")
}
