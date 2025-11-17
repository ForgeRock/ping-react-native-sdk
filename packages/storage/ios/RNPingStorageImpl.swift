import Foundation
import PingStorage
import React

// 🔥 NEW: Registry for multiple storage instances
@available(iOS 16.0.0, *)
class StorageRegistry {
  static let shared = StorageRegistry()
  private var instances: [String: any Storage<String>] = [:]

  func create(config: NSDictionary) -> String {
    let id = UUID().uuidString

    let type = config["type"] as? String ?? "encrypted"
    let keyAlias = config["keyAlias"] as? String ?? "com.pingidentity.rnsampleapp.keyalias"
    let cacheStrategyRaw = (config["cacheStrategy"] as? String)?.uppercased()

    let base: any Storage<String>
    switch type.lowercased() {
    case "memory":
      base = MemoryStorage<String>()
    case "encrypted", "datastore":
      base = KeychainStorage<String>(
        account: keyAlias,
        encryptor: NoEncryptor()
      )
    default:
      base = MemoryStorage<String>()
    }

    let finalInstance: any Storage<String>
    if cacheStrategyRaw == "CACHE" {
      finalInstance = StorageDelegate(delegate: base, cacheable: true)
    } else {
      finalInstance = base
    }

    instances[id] = finalInstance
    return id
  }

  func get(_ id: String) -> (any Storage<String>)? {
    return instances[id]
  }
}

@available(iOS 16.0.0, *)
@objcMembers
public class RNPingStorageImpl: NSObject {

  // Singleton instance
  @objc public static let shared = RNPingStorageImpl()

  // Private initializer to enforce singleton
  @objc private override init() {
    super.init()
  }

  // MARK: - Cache Strategy Enum
  enum CacheStrategy {
    case noCache
    case cache
  }

  private func parseCacheStrategy(from value: String?) -> CacheStrategy {
    print("RNPingStorage: Parsing cache strategy from value: \(String(describing: value))")
    switch value?.uppercased() {
    case "CACHE":
      return .cache
    case "CACHE_ON_FAILURE":
      return .cache // TODO
    default:
      return .noCache
    }
  }

  // MARK: - Configure
  @objc(configure:resolver:rejecter:)
  public func configure(
    _ config: NSDictionary,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("RNPingStorage: configure called with config: \(config)")

    // 🔥 CHANGE: Create a NEW instance and return its ID
    let id = StorageRegistry.shared.create(config: config)
    print("✅ RNPingStorage: created storage instance \(id)")
    resolve(id)
  }

  // MARK: - Save
  @objc(save:item:resolver:rejecter:)   // 🔥 CHANGE signature
  public func save(
    _ id: String,                        // 🔥 CHANGE
    item: NSDictionary,                  // 🔥 CHANGE
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("RNPingStorage: save called with item: \(item)")

    // 🔥 CHANGE: lookup instance
    guard let storage = StorageRegistry.shared.get(id) else {
      reject("E_SAVE_FAILED", "Invalid storage id", nil)
      return
    }

    Task {
      do {
        let data = try JSONSerialization.data(withJSONObject: item, options: [])
        let jsonString = String(data: data, encoding: .utf8) ?? "{}"
        print("RNPingStorage: Saving jsonString: \(jsonString)")
        try await storage.save(item: jsonString)
        print("✅ RNPingStorage: Save successful")
        resolve(true)
      } catch {
        print("❌ RNPingStorage: Error saving item: \(error)")
        reject("E_SAVE_FAILED", "Failed to save item", error)
      }
    }
  }

  // MARK: - Get
  @objc(get:resolver:rejecter:)        // 🔥 CHANGE signature
  public func get(
    _ id: String,                        // 🔥 CHANGE
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("RNPingStorage: get called")

    guard let storage = StorageRegistry.shared.get(id) else {
      reject("E_GET_FAILED", "Invalid storage id", nil)
      return
    }

    Task {
      do {
        if let json = try await storage.get() {
          print("RNPingStorage: Retrieved json: \(json)")
          if let data = json.data(using: .utf8),
             let item = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
            resolve(item)
          } else {
            resolve(nil)
          }
        } else {
          print("RNPingStorage: No data found in storage")
          resolve(nil)
        }
      } catch {
        print("❌ RNPingStorage: Error getting item: \(error)")
        reject("E_GET_FAILED", "Failed to get item", error)
      }
    }
  }

  // MARK: - Remove
  @objc(remove:resolver:rejecter:)     // 🔥 CHANGE signature
  public func remove(
    _ id: String,                        // 🔥 CHANGE
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("RNPingStorage: remove called")

    guard let storage = StorageRegistry.shared.get(id) else {
      reject("E_REMOVE_FAILED", "Invalid storage id", nil)
      return
    }

    Task {
      do {
        try await storage.delete()
        print("✅ RNPingStorage: Remove successful")
        resolve(true)
      } catch {
        print("❌ RNPingStorage: Error removing item: \(error)")
        reject("E_REMOVE_FAILED", "Failed to remove item", error)
      }
    }
  }
}
