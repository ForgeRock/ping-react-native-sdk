/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Synchronous helpers for working with Core registries from legacy blocking APIs.
///
/// These utilities enforce a caller-provided queue key to avoid blocking
/// the main thread while waiting for async registry operations.
public enum RegistrySync {
  /// Register a handle synchronously using a registry.
  public static func registerSync(
    _ handle: NativeHandle,
    registry: Registry,
    queueKey: DispatchSpecificKey<Void>,
    context: String
  ) -> String {
    precondition(
      DispatchQueue.getSpecific(key: queueKey) != nil,
      "\(context) must be called on its create queue"
    )
    var id = ""
    let semaphore = DispatchSemaphore(value: 0)
    Task {
      id = await registry.register(handle)
      semaphore.signal()
    }
    semaphore.wait()
    return id
  }

  /// Resolve a handle synchronously by id.
  public static func resolveSync(
    _ id: String,
    registry: Registry,
    queueKey: DispatchSpecificKey<Void>,
    context: String
  ) -> NativeHandle? {
    precondition(
      DispatchQueue.getSpecific(key: queueKey) != nil,
      "\(context) must be called on its create queue"
    )
    var resolved: NativeHandle?
    let semaphore = DispatchSemaphore(value: 0)
    Task {
      resolved = await registry.resolve(id)
      semaphore.signal()
    }
    semaphore.wait()
    return resolved
  }

  /// Resolve a handle asynchronously by id.
  public static func resolve(
    _ id: String,
    registry: Registry
  ) async -> NativeHandle? {
    return await registry.resolve(id)
  }
}
