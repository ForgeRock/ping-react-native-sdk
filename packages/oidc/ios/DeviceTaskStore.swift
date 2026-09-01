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
actor DeviceTaskStore {
  private var tasks: [String: Task<Void, Never>] = [:]

  func set(_ task: Task<Void, Never>, for id: String) {
    tasks[id] = task
  }

  func remove(_ id: String) -> Task<Void, Never>? {
    tasks.removeValue(forKey: id)
  }

  func cancelAll() {
    tasks.values.forEach { $0.cancel() }
    tasks.removeAll()
  }
}
