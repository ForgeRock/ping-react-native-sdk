import Foundation
import PingStorage
import RNPingCore

@available(iOS 16.0.0, *)
@objcMembers
public class RNPingStorageCommon: NSObject {
  
  @objc
  public static func create(_ config: NSDictionary) -> String {
    print("RNPingStorage: create called with config: \(config)")

    // Register with Core
    let id = StorageRegistry.shared.create(config: config)

    print("✅ RNPingStorage: registered storage instance \(id)")
    return id
  }

  // MARK: - Configure
  @objc
  public static func configure(_ config: NSDictionary) -> String {
    print("RNPingStorage: configure called with config: \(config)")

    let id = create(config)
    print("✅ RNPingStorage: created storage instance \(id)")
    return id
  }

  // MARK: - Save
  @objc
  public static func save(
    _ id: String,
    item: NSDictionary,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    print("RNPingStorage: save called with item: \(item)")

    guard let storage = StorageRegistry.shared.get(id) else {
      rejecter("E_SAVE_FAILED", "Invalid storage id", nil)
      return
    }

    Task {
      do {
        let data = try JSONSerialization.data(withJSONObject: item, options: [])
        let jsonString = String(data: data, encoding: .utf8) ?? "{}"
        print("RNPingStorage: Saving jsonString: \(jsonString)")
        try await storage.save(item: jsonString)
        print("✅ RNPingStorage: Save successful")
        resolver(true)
      } catch {
        print("❌ RNPingStorage: Error saving item: \(error)")
        rejecter("E_SAVE_FAILED", "Failed to save item", error as NSError)
      }
    }
  }

  // MARK: - Get
  @objc
  public static func get(
    _ id: String,
    resolver: @escaping (NSDictionary?) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    print("RNPingStorage: get called")

    guard let storage = StorageRegistry.shared.get(id) else {
      rejecter("E_GET_FAILED", "Invalid storage id", nil)
      return
    }

    Task {
      do {
        if let json = try await storage.get() {
          print("RNPingStorage: Retrieved json: \(json)")
          if let data = json.data(using: .utf8),
             let item = try JSONSerialization.jsonObject(
              with: data,
              options: []
             )
              as? NSDictionary
          {
            resolver(item)
          } else {
            resolver(nil)
          }
        } else {
          print("RNPingStorage: No data found in storage")
          resolver(nil)
        }
      } catch {
        print("❌ RNPingStorage: Error getting item: \(error)")
        rejecter("E_GET_FAILED", "Failed to get item", error as NSError)
      }
    }
  }

  // MARK: - Remove
  @objc
  public static func remove(
    _ id: String,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
      print("RNPingStorage: remove called")

      guard let raw = StorageRegistry.shared.get(id) else {
          rejecter("E_REMOVE_FAILED", "Invalid storage id", nil)
          return
      }

      Task {
          do {
              // Cast the opaque instance back to Storage<String>
              guard let storage = raw as? any Storage<String> else {
                  throw NSError(domain: "TYPE_ERROR",
                                code: 1,
                                userInfo: [NSLocalizedDescriptionKey: "Instance is not Storage<String>"])
              }

              try await storage.delete()

              print("✅ RNPingStorage: Remove successful")
              resolver(true)

          } catch {
              print("❌ RNPingStorage: Error removing item: \(error)")
              rejecter("E_REMOVE_FAILED", "Failed to remove item", error as NSError)
          }
      }
  }
}
