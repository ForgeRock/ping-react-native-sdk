import Foundation
import PingLogger
import React
import RNPingCore

@available(iOS 16.0.0, *)
@objcMembers
public class RNPingLoggerImpl: NSObject {

  @objc public static let shared = RNPingLoggerImpl()

  @objc private override init() {
    super.init()
  }

  // MARK: - Native Logger Level

  private enum NativeLoggerLevel: String {
    case standard = "STANDARD"
    case warn = "WARN"
    case none = "NONE"
  }

  // MARK: - Registry Handle

  final class LoggerHandle: NativeHandle {
    var level: NativeLoggerLevel
    init(level: NativeLoggerLevel) { self.level = level }
  }

  // MARK: - Configure

  private static let createQueueKey = DispatchSpecificKey<Void>()

  private static let createQueue: DispatchQueue = {
    let queue = DispatchQueue(label: "com.ping.logger.create", qos: .userInitiated)
    queue.setSpecific(key: createQueueKey, value: ())
    return queue
  }()

  @objc
  public func registerLogger(_ config: NSDictionary) -> String {
    return Self.createQueue.sync {
      Self.create(config)
    }
  }

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

  // MARK: - Helpers

  private static func parseLevel(_ value: Any?) -> NativeLoggerLevel {
    guard let level = value as? String,
          let parsed = NativeLoggerLevel(rawValue: level) else {
      return .none
    }
    return parsed
  }

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
  @objc
  public func _testLevel(_ id: String) async -> String? {
    guard let handle = await CoreRuntime.loggerRegistry.resolve(id) as? LoggerHandle else {
      return nil
    }
    return handle.level.rawValue
  }
#endif
}
