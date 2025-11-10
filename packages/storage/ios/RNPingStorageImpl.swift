import Foundation
import PingStorage
import React

@objcMembers
public class RNPingStorageImpl: NSObject {

  // Singleton instance
  @objc public static let shared = RNPingStorageImpl()
  
  // Private initializer to enforce singleton
  @objc private override init() {
    super.init()
  }

  private var storage: (any Storage<String>)?
  
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
      return .cache //TODO
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
    do {
      let type = config["type"] as? String ?? "encrypted"
      let keyAlias = config["keyAlias"] as? String ?? "com.pingidentity.rnsampleapp.keyalias"
      let cacheStrategy = parseCacheStrategy(from: config["cacheStrategy"] as? String)
      print("RNPingStorage: type=\(type), keyAlias=\(keyAlias), cacheStrategy=\(cacheStrategy)")

      let base: any Storage<String>
      switch type.lowercased() {
      case "memory":
        print("RNPingStorage: Using MemoryStorage")
        base = MemoryStorage<String>()
      case "encrypted", "datastore":
        print("RNPingStorage: Using KeychainStorage")
        base = KeychainStorage<String>(
          account: keyAlias,
          encryptor: NoEncryptor()
        )
      default:
        print("RNPingStorage: Unknown type, defaulting to MemoryStorage")
        base = MemoryStorage<String>()
      }

      switch cacheStrategy {
      case .noCache:
        storage = base
      case .cache:
        print("RNPingStorage: Using StorageDelegate with cacheable true")
        storage = StorageDelegate(delegate: base, cacheable: true)
      }

      print("✅ RNPingStorage: configured successfully")
      resolve(true)
    } catch {
      print("❌ RNPingStorage: Error configuring storage: \(error)")
      reject("E_CONFIGURE_FAILED", "Failed to configure storage", error)
    }
  }

  // MARK: - Save
  @objc(save:resolver:rejecter:)
  public func save(
    _ item: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("RNPingStorage: save called with item: \(item)")
    Task {
      do {
        let data = try JSONSerialization.data(withJSONObject: item, options: [])
        let jsonString = String(data: data, encoding: .utf8) ?? "{}"
        print("RNPingStorage: Saving jsonString: \(jsonString)")
        try await storage?.save(item: jsonString)
        print("✅ RNPingStorage: Save successful")
        resolve(true)
      } catch {
        print("❌ RNPingStorage: Error saving item: \(error)")
        reject("E_SAVE_FAILED", "Failed to save item", error)
      }
    }
  }

  // MARK: - Get
  @objc(get:resolver:rejecter:)
  public func get(
    _ key: NSString?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("RNPingStorage: get called")
    Task {
      do {
        if let json = try await storage?.get() {
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
  @objc(remove:resolver:rejecter:)
  public func remove(
    _ key: NSString?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("RNPingStorage: remove called")
    Task {
      do {
        try await storage?.delete()
        print("✅ RNPingStorage: Remove successful")
        resolve(true)
      } catch {
        print("❌ RNPingStorage: Error removing item: \(error)")
        reject("E_REMOVE_FAILED", "Failed to remove item", error)
      }
    }
  }
}
