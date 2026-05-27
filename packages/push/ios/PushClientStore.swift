/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import PingPush

/// Actor that owns the handle-keyed `PushClient` registry.
///
/// All registry mutations and lookups go through `await PushClientStore.shared.*`, which the
/// Swift runtime serialises automatically. Every call site is already inside
/// `Task { }`, so the `await` is free.
actor PushClientStore {
  static let shared = PushClientStore()

  private var registry: [String: PushClient] = [:]

  func store(_ client: PushClient, id: String) {
    registry[id] = client
  }

  func get(_ id: String) -> PushClient? {
    registry[id]
  }

  func remove(_ id: String) -> PushClient? {
    registry.removeValue(forKey: id)
  }

  func removeAll() -> [PushClient] {
    let clients = Array(registry.values)
    registry.removeAll()
    return clients
  }
}
