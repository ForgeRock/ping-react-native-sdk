import Foundation
import RNPingCore

/// Common logger functionality for managing logger instances across the bridge.
/// Handles synchronization of logger configuration from JavaScript to native Swift.
@available(iOS 16.0.0, *)
@objcMembers
public class RNPingLoggerCommon: NSObject {

  /// Handle for storing logger configuration in the registry.
  final class LoggerHandle: NativeHandle {
    /// The log level for this logger instance.
    var level: String
    /// Optional role identifier for the logger.
    var role: String?

    /// Creates a new logger handle with the specified configuration.
    /// - Parameters:
    ///   - level: The log level to use.
    ///   - role: Optional role identifier for the logger.
    init(level: String, role: String?) {
      self.level = level
      self.role = role
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
  private static var jsIdToRegistryId: [String: String] = [:]

  /// Synchronizes logger configuration from JavaScript to native.
  /// - Parameter config: Dictionary containing logger configuration with "id", "level", and optional "role".
  @objc
  public static func sync(_ config: NSDictionary) {
    guard
      let id = config["id"] as? String,
      let level = config["level"] as? String
    else {
      return
    }

    let role = config["role"] as? String
    syncQueue.async {
      syncInternal(id: id, level: level, role: role)
    }
  }

  /// Internal synchronization method that runs on the sync queue.
  /// - Parameters:
  ///   - id: The JavaScript logger ID.
  ///   - level: The log level to apply.
  ///   - role: Optional role identifier.
  private static func syncInternal(id: String, level: String, role: String?) {
    precondition(
      DispatchQueue.getSpecific(key: syncQueueKey) != nil,
      "RNPingLoggerCommon.syncInternal must be called on syncQueue"
    )

    var registryId = jsIdToRegistryId[id]
    let semaphore = DispatchSemaphore(value: 0)

    Task {
      if let registryId = registryId,
         let handle = await CoreRuntime.loggerRegistry.resolve(registryId) as? LoggerHandle {
        handle.level = level
        if let role = role {
          handle.role = role
        }
        semaphore.signal()
        return
      }

      let handle = LoggerHandle(level: level, role: role)
      let newId = await CoreRuntime.loggerRegistry.register(handle)
      registryId = newId
      semaphore.signal()
    }

    semaphore.wait()

    if let registryId = registryId {
      jsIdToRegistryId[id] = registryId
    }
  }

#if DEBUG
  /// Test helper to retrieve registry ID for a given JavaScript ID.
  /// - Parameter id: The JavaScript logger ID.
  /// - Returns: The corresponding registry ID, or nil if not found.
  static func _testRegistryId(for id: String) -> String? {
    jsIdToRegistryId[id]
  }

  /// Test helper to reset the ID mapping.
  static func _testReset() {
    jsIdToRegistryId.removeAll()
  }
#endif
}
