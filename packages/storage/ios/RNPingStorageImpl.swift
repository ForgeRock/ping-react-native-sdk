import Foundation
import PingStorage
import React
import RNPingCore

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
  @objc
  public func configure(
    _ config: NSDictionary,
  ) -> String {
    print("RNPingStorage: configure called with config: \(config)")

    let id = StorageRegistry.shared.create(config: config)
    print("✅ RNPingStorage: created storage instance \(id)")
    return id
  }

  // MARK: - Save
  @objc(save:item:resolver:rejecter:)  
  public func save(
    _ id: String,                    
    item: NSDictionary,               
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("RNPingStorage: save called with item: \(item)")

    // lookup instance
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
  @objc(get:resolver:rejecter:)      
  public func get(
    _ id: String,                       
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
  @objc(remove:resolver:rejecter:)    
  public func remove(
    _ id: String,                 
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
