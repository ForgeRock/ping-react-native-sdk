/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
import Foundation
import PingLogger
import RNPingCore

/// Implementation of the native logger bridge for React Native.
/// Manages logger creation, configuration, and synchronization with the PingLogger framework.
///
/// - Note: `@unchecked Sendable` is used because this Objective-C bridge class
///   is shared across threads by React Native. Internal mutable operations are
///   serialized through dedicated dispatch queues.
@available(iOS 16.0.0, *)
@objcMembers
public class RNPingLoggerImpl: NSObject, @unchecked Sendable {

  /// Shared singleton instance.
  @objc public static let shared = RNPingLoggerImpl()

  @objc private override init() {
    super.init()
  }

  // MARK: - Native Logger Level

  /// Supported native logger levels.
  enum NativeLoggerLevel: String {
    case standard = "STANDARD"
    case warn = "WARN"
    case none = "NONE"
  }

  // MARK: - Registry Handle

  /// Handle for storing logger configuration in the registry.
  ///
  /// - Note: `@unchecked Sendable` is required because this is a mutable
  ///   reference type (`level`) passed through actor-based registries.
  ///   Mutations are constrained to `createQueue`.
  final class LoggerHandle: LoggerHandleContract, @unchecked Sendable {
    /// The native log level for this logger instance.
    var level: NativeLoggerLevel
    var loggerLevel: String { level.rawValue }
    
    /// Creates a new logger handle with the specified level.
    /// - Parameter level: The native log level to use.
    init(level: NativeLoggerLevel) { self.level = level }
  }

  // MARK: - Configure

  /// Specific key for identifying the create queue.
  private static let createQueueKey = DispatchSpecificKey<Void>()

  /// Serial queue for synchronizing logger creation.
  private static let createQueue: DispatchQueue = {
    let queue = DispatchQueue(label: "com.ping.logger.create", qos: .userInitiated)
    queue.setSpecific(key: createQueueKey, value: ())
    return queue
  }()

  /// Registers a new logger instance with the specified configuration.
  /// - Parameter config: Dictionary containing logger configuration, including "level".
  /// - Returns: The registry ID for the newly created logger.
  @objc
  public func registerLogger(_ config: NSDictionary) -> String {
    return Self.createQueue.sync {
      Self.create(config)
    }
  }

  /// Internal method for creating a logger on the create queue.
  /// - Parameter config: Dictionary containing logger configuration.
  /// - Returns: The registry ID for the created logger.
  private static func create(_ config: NSDictionary) -> String {
    precondition(
      DispatchQueue.getSpecific(key: createQueueKey) != nil,
      "RNPingLoggerImpl.create must be called on createQueue"
    )

    let level = parseLevel(config["level"])
    let handle = LoggerHandle(level: level)
    let id = RegistrySync.registerSync(
      handle,
      registry: CoreRuntime.loggerRegistry,
      queueKey: createQueueKey,
      context: "RNPingLoggerImpl.create"
    )
    return id
  }

  // MARK: - Sync

  /// Synchronizes the logger configuration by updating its level.
  /// - Parameters:
  ///   - id: The registry ID of the logger to update.
  ///   - level: The new log level as a string.
  @objc
  public func syncLogger(_ id: String, level: String) {
    guard let parsedLevel = NativeLoggerLevel(rawValue: level) else {
      print("RNPingLogger: Invalid level '\(level)'")
      return
    }

    Self.createQueue.async {
      guard let handle = RegistrySync.resolveSync(
        id,
        registry: CoreRuntime.loggerRegistry,
        queueKey: Self.createQueueKey,
        context: "RNPingLoggerImpl.syncLogger"
      ) as? LoggerHandle else {
        print("RNPingLogger: No logger registered for id \(id)")
        return
      }

      handle.level = parsedLevel
    }
  }

  /// Resolves a native logger instance for a registered logger id.
  /// - Parameter id: The registry ID of the logger to resolve.
  /// - Returns: Native logger instance, or `nil` if not found.
  @nonobjc
  public func resolveLogger(_ id: String?) -> Logger? {
    guard let id, !id.isEmpty else {
      return nil
    }

    return Self.createQueue.sync {
      guard let handle = RegistrySync.resolveSync(
        id,
        registry: CoreRuntime.loggerRegistry,
        queueKey: Self.createQueueKey,
        context: "RNPingLoggerImpl.resolveLogger"
      ) as? LoggerHandle else {
        print("RNPingLogger: No logger registered for id \(id)")
        return nil
      }

      return Self.nativeLogger(for: handle.loggerLevel)
    }
  }

  // MARK: - Helpers

  /// Parses a log level value from configuration.
  /// - Parameter value: The value to parse, expected to be a string.
  /// - Returns: The parsed native logger level, or `.none` if parsing fails.
  private static func parseLevel(_ value: Any?) -> NativeLoggerLevel {
    guard let level = value as? String,
          let parsed = NativeLoggerLevel(rawValue: level) else {
      return .none
    }
    return parsed
  }

  /// Maps internal logger levels to concrete native logger instances.
  /// - Parameter level: The native logger level to map.
  /// - Returns: Concrete native logger instance.
  private static func nativeLogger(for level: String) -> Logger {
    switch level {
    case NativeLoggerLevel.standard.rawValue:
      return LogManager.standard
    case NativeLoggerLevel.warn.rawValue:
      return LogManager.warning
    case NativeLoggerLevel.none.rawValue:
      return LogManager.none
    default:
      return LogManager.none
    }
  }

#if DEBUG
  /// Test helper to retrieve the current level for a logger.
  /// - Parameter id: The registry ID of the logger.
  /// - Returns: The current log level as a string, or nil if the logger is not found.
  @nonobjc
  public func _testLevel(_ id: String) async -> String? {
    guard let handle = await CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandle else {
      return nil
    }
    return handle.level.rawValue
  }
#endif
}
