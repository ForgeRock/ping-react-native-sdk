//
//  DeviceTaskStore.swift
//  RNPingOidc
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation

/// Actor-isolated task storage for active OIDC device flows.
///
/// Each subscription also records the device client that owns it so callers
/// can verify ownership before cancelling, mirroring the Android
/// `deviceJobs` map.
actor DeviceTaskStore {
  private var tasks: [String: Task<Void, Never>] = [:]
  private var owners: [String: String] = [:]

  /// Store a task for a subscription id and record its owning device client.
  ///
  /// - Parameters:
  ///   - task: Polling task for the device flow.
  ///   - id: Subscription id returned to JS.
  ///   - deviceClientId: Identifier of the device client that started the flow.
  func set(_ task: Task<Void, Never>, for id: String, deviceClientId: String) {
    tasks[id] = task
    owners[id] = deviceClientId
  }

  /// Remove a task and its owner mapping, returning the task if present.
  ///
  /// - Parameter id: Subscription id.
  /// - Returns: The stored task, or nil when the subscription is unknown.
  func remove(_ id: String) -> Task<Void, Never>? {
    owners.removeValue(forKey: id)
    return tasks.removeValue(forKey: id)
  }

  /// Remove a task only when it is owned by the given device client.
  ///
  /// Mirrors the Android `cancelDeviceAuthorization` ownership check: the
  /// returned task is cancelled by the caller only when the stored owner
  /// matches, so one client cannot cancel another client's flow.
  ///
  /// - Parameters:
  ///   - id: Subscription id.
  ///   - deviceClientId: Owner device client id to match.
  /// - Returns: The stored task when ownership matches, otherwise nil.
  func remove(_ id: String, ownedBy deviceClientId: String) -> Task<Void, Never>? {
    guard owners[id] == deviceClientId else {
      return nil
    }
    owners.removeValue(forKey: id)
    return tasks.removeValue(forKey: id)
  }

  /// Cancel every task owned by the given device client and drop its entries.
  ///
  /// - Parameter deviceClientId: Owner device client id to match.
  func cancelAll(for deviceClientId: String) {
    for (id, owner) in owners where owner == deviceClientId {
      tasks.removeValue(forKey: id)?.cancel()
      owners.removeValue(forKey: id)
    }
  }

  /// Cancel every stored task and drop all entries.
  func cancelAll() {
    tasks.values.forEach { $0.cancel() }
    tasks.removeAll()
    owners.removeAll()
  }
}
