/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import Foundation
import PingBinding
import React

/// JS event emitted when a PIN is needed for app-pin authentication.
let pinRequiredEvent = "RNPingBinding_PinRequired"

/// JS event emitted when the user must select a device key for signing.
let userKeyRequiredEvent = "RNPingBinding_UserKeyRequired"

/// `NotificationCenter` name used to forward events from Swift to the ObjC emitter gate.
let nativeEmitNotification = Notification.Name("RNPingBinding_NativeEmit")

/// `PinCollector` implementation that routes PIN collection through the JS `DeviceEventEmitter` bridge.
///
/// Emits `RNPingBinding_PinRequired` with a `requestId` and prompt strings, then suspends until
/// JS calls `resolvePin` or `cancelPin` with the matching `requestId`.
class BridgePinCollector: PinCollector {
  func collectPin(prompt: Prompt, completion: @escaping @Sendable (String?) -> Void) {
    let requestId = UUID().uuidString
    RNPingBindingCommon.storePinCompletion(requestId: requestId, completion: completion)
    RNPingBindingCommon.emitEvent(pinRequiredEvent, body: [
      "requestId": requestId,
      "title": prompt.title,
      "subtitle": prompt.subtitle,
      "description": prompt.description,
    ])
  }
}

/// `UserKeySelector` implementation that routes key selection through the JS `DeviceEventEmitter` bridge.
///
/// Emits `RNPingBinding_UserKeyRequired` with a `requestId` and serialised key list, then suspends
/// until JS calls `selectUserKey` or `cancelUserKey` with the matching `requestId`.
struct BridgeUserKeySelector: UserKeySelector {
  func selectKey(userKeys: [UserKey], prompt: Prompt) async -> UserKey? {
    let requestId = UUID().uuidString
    return await withCheckedContinuation { continuation in
      RNPingBindingCommon.storeUserKeyCompletion(requestId: requestId) { selectedId in
        guard let selectedId else {
          continuation.resume(returning: nil)
          return
        }
        continuation.resume(returning: userKeys.first { $0.id == selectedId })
      }
      RNPingBindingCommon.emitEvent(userKeyRequiredEvent, body: [
        "requestId": requestId,
        "userKeys": userKeys.map { key in
          [
            "id": key.id,
            "userId": key.userId,
            "username": key.username,
            "authenticationType": key.authType.rawValue,
          ]
        },
      ])
    }
  }
}
