/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
import Foundation
import PingLogger
import RNPingCore

/// Common logger functionality for managing logger instances across the bridge.
/// Handles synchronization of logger configuration from JavaScript to native Swift.
@objcMembers
public class RNPingLoggerCommon: NSObject {
  /// Mutable logger that delegates to the current native logger level.
  ///
  /// Existing SDK clients keep this logger instance, so changing `level`
  /// updates log behavior without recreating those clients.
  private final class DynamicLogger: Logger, @unchecked Sendable {
    private let lock = NSLock()
    private var level: String

    init(level: String) {
      self.level = level
    }

    func setLevel(_ level: String) {
      lock.lock()
      self.level = level
      lock.unlock()
    }

    private func currentLogger() -> Logger {
      lock.lock()
      let currentLevel = level
      lock.unlock()
      return RNPingLoggerCommon.nativeLogger(for: currentLevel)
    }

    func d(_ message: String) {
      currentLogger().d(message)
    }

    func i(_ message: String) {
      currentLogger().i(message)
    }

    func w(_ message: String, error: Error?) {
      currentLogger().w(message, error: error)
    }

    func e(_ message: String, error: Error?) {
      currentLogger().e(message, error: error)
    }
  }

  /// Thread-safe mapping store for JavaScript logger ids to native registry ids.
  ///
  /// - Note: `@unchecked Sendable` is used because this class owns mutable
  ///   dictionary state. `NSLock` guards all map access.
  private final class JsLoggerIdStore: @unchecked Sendable {
    private let lock = NSLock()
    private var map: [String: String] = [:]

    func get(_ id: String) -> String? {
      lock.lock()
      let value = map[id]
      lock.unlock()
      return value
    }

    func set(_ id: String, registryId: String) {
      lock.lock()
      map[id] = registryId
      lock.unlock()
    }

    func clear() {
      lock.lock()
      map.removeAll()
      lock.unlock()
    }
  }

  /// Handle for storing logger configuration in the registry.
  ///
  /// - Note: `@unchecked Sendable` is required because this mutable reference
  ///   type (`level`) crosses actor boundaries through `Registry`.
  ///   Updates are serialized on `syncQueue`.
  final class LoggerHandle: LoggerHandleContract, @unchecked Sendable {
    /// The log level for this logger instance.
    var level: String
    var loggerLevel: String { level }
    private let dynamicLogger: DynamicLogger
    var nativeLogger: Any? { dynamicLogger }
    /// Creates a new logger handle with the specified configuration.
    /// - Parameter level: The log level to use.
    init(level: String) {
      self.level = level
      self.dynamicLogger = DynamicLogger(level: level)
    }

    /// Updates the handle level and propagates it to the live logger.
    /// - Parameter level: New logger level.
    func setLevel(_ level: String) {
      self.level = level
      dynamicLogger.setLevel(level)
    }
  }

  /// Specific key for identifying the sync queue.
  private static let syncQueueKey = DispatchSpecificKey<Void>()
  
  /// Serial queue for synchronizing logger configuration updates.
  private static let syncQueue: DispatchQueue = {
    let q = DispatchQueue(label: "com.ping.logger.sync", qos: .userInitiated)
    q.setSpecific(key: syncQueueKey, value: ())
    return q
  }()

  /// Maps JavaScript logger IDs to native registry IDs.
  private static let jsIdToRegistryIdStore = JsLoggerIdStore()

  /// Synchronizes logger configuration from JavaScript to native.
  ///
  /// - Parameter config: Dictionary containing logger configuration with `id` and `level`.
  /// - Note: When called from JavaScript, this updates the native logger registry.
  @objc
  public static func sync(_ config: NSDictionary) {
    guard
      let id = config["id"] as? String,
      let level = config["level"] as? String
    else {
      return
    }

    syncQueue.async {
      syncInternal(id: id, level: level)
    }
  }

  /// Internal synchronization method that runs on the sync queue.
  /// - Parameters:
  ///   - id: The JavaScript logger ID.
  ///   - level: The log level to apply.
  private static func syncInternal(id: String, level: String) {
    precondition(
      DispatchQueue.getSpecific(key: syncQueueKey) != nil,
      "RNPingLoggerCommon.syncInternal must be called on syncQueue"
    )

    var registryId = jsIdToRegistryIdStore.get(id)
    if let registryId,
       let handle = RegistrySync.resolveSync(
        registryId,
        registry: CoreRuntime.loggerRegistry,
        queueKey: syncQueueKey,
        context: "RNPingLoggerCommon.syncInternal"
       ) as? LoggerHandle {
      handle.setLevel(level)
      jsIdToRegistryIdStore.set(id, registryId: registryId)
      return
    }

    let handle = LoggerHandle(level: level)
    registryId = RegistrySync.registerSync(
      handle,
      registry: CoreRuntime.loggerRegistry,
      queueKey: syncQueueKey,
      context: "RNPingLoggerCommon.syncInternal"
    )

    if let registryId = registryId {
      jsIdToRegistryIdStore.set(id, registryId: registryId)
    }
  }

#if DEBUG
  /// Test helper to retrieve registry ID for a given JavaScript ID.
  /// - Parameter id: The JavaScript logger ID.
  /// - Returns: The corresponding registry ID, or nil if not found.
  static func _testRegistryId(for id: String) -> String? {
    jsIdToRegistryIdStore.get(id)
  }

  /// Test helper to reset the ID mapping.
  static func _testReset() {
    jsIdToRegistryIdStore.clear()
  }
#endif

  /// Maps internal logger levels to concrete native logger instances.
  /// - Parameter level: Native logger level string.
  /// - Returns: Concrete native logger instance.
  private static func nativeLogger(for level: String) -> Logger {
    switch level.uppercased() {
    case "STANDARD":
      return LogManager.standard
    case "WARN":
      return LogManager.warning
    case "NONE":
      return LogManager.none
    default:
      return LogManager.none
    }
  }
}
