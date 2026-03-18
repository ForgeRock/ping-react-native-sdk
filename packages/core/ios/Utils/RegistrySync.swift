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
  /// Sendable synchronization box used to bridge async work into blocking APIs.
  ///
  /// - Note: `@unchecked Sendable` is used because `value` is mutable.
  ///   All reads/writes are guarded by `NSLock`, and synchronization uses
  ///   `DispatchSemaphore`, so concurrent access remains serialized.
  private final class SyncResultBox<T>: @unchecked Sendable {
    private let lock = NSLock()
    private var value: T
    let semaphore = DispatchSemaphore(value: 0)

    init(_ value: T) {
      self.value = value
    }

    func set(_ value: T) {
      lock.lock()
      self.value = value
      lock.unlock()
    }

    func get() -> T {
      lock.lock()
      let current = value
      lock.unlock()
      return current
    }
  }

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
    let box = SyncResultBox<String>("")
    Task { [box, handle, registry] in
      let id = await registry.register(handle)
      box.set(id)
      box.semaphore.signal()
    }
    box.semaphore.wait()
    return box.get()
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
    let box = SyncResultBox<NativeHandle?>(nil)
    Task { [box, id, registry] in
      let resolved = await registry.resolve(id)
      box.set(resolved)
      box.semaphore.signal()
    }
    box.semaphore.wait()
    return box.get()
  }

  /// Resolve a handle asynchronously by id.
  public static func resolve(
    _ id: String,
    registry: Registry
  ) async -> NativeHandle? {
    return await registry.resolve(id)
  }
}
