import Foundation
import RNPingCore

@available(iOS 16.0.0, *)
@objcMembers
public class RNPingLoggerCommon: NSObject {

  final class LoggerHandle: NativeHandle {
    var level: String
    var role: String?

    init(level: String, role: String?) {
      self.level = level
      self.role = role
    }
  }

  private static let syncQueueKey = DispatchSpecificKey<Void>()
  private static let syncQueue: DispatchQueue = {
    let q = DispatchQueue(label: "com.ping.logger.sync", qos: .userInitiated)
    q.setSpecific(key: syncQueueKey, value: ())
    return q
  }()

  private static var jsIdToRegistryId: [String: String] = [:]

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
  static func _testRegistryId(for id: String) -> String? {
    jsIdToRegistryId[id]
  }

  static func _testReset() {
    jsIdToRegistryId.removeAll()
  }
#endif
}
