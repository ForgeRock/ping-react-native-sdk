/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
 
import Foundation
import PingLogger
import React
import RNPingCore

/// Implementation of the native logger bridge for React Native.
/// Manages logger creation, configuration, and synchronization with the PingLogger framework.
@available(iOS 16.0.0, *)
@objcMembers
public class RNPingLoggerImpl: NSObject {

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
  final class LoggerHandle: NativeHandle {
    /// The native log level for this logger instance.
    var level: NativeLoggerLevel
    
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
    var id = ""
    let semaphore = DispatchSemaphore(value: 0)

    Task {
      let handle = LoggerHandle(level: level)
      id = await CoreRuntime.loggerRegistry.register(handle)
      applyNativeLevel(level)
      semaphore.signal()
    }

    semaphore.wait()
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

    Task {
      guard let handle = await CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandle else {
        print("RNPingLogger: No logger registered for id \(id)")
        return
      }

      handle.level = parsedLevel
      Self.applyNativeLevel(parsedLevel)
    }
  }

  /// Applies a previously registered logger by id.
  /// - Parameter id: The registry ID of the logger to apply.
  /// - Returns: True when the logger was resolved and applied.
  @objc
  public func applyLogger(_ id: String?) -> Bool {
    guard let id, !id.isEmpty else {
      return false
    }

    var applied = false
    let semaphore = DispatchSemaphore(value: 0)

    Task {
      if let handle = await CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandle {
        Self.applyNativeLevel(handle.level)
        applied = true
      } else {
        print("RNPingLogger: No logger registered for id \(id)")
      }
      semaphore.signal()
    }

    semaphore.wait()
    return applied
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

  /// Applies the specified log level to the native LogManager.
  /// - Parameter level: The native logger level to apply.
  private static func applyNativeLevel(_ level: NativeLoggerLevel) {
    switch level {
    case .standard:
      LogManager.logger = LogManager.standard
    case .warn:
      LogManager.logger = LogManager.warning
    case .none:
      LogManager.logger = LogManager.none
    }
  }

#if DEBUG
  /// Test helper to retrieve the current level for a logger.
  /// - Parameter id: The registry ID of the logger.
  /// - Returns: The current log level as a string, or nil if the logger is not found.
  @objc
  public func _testLevel(_ id: String) async -> String? {
    guard let handle = await CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandle else {
      return nil
    }
    return handle.level.rawValue
  }
#endif
}
