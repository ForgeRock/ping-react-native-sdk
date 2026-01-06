import Foundation
import PingStorage
import RNPingCore

@available(iOS 16.0.0, *)
@objcMembers
public class RNPingStorageCommon: NSObject {

  // MARK: - Native Handle (POC)
  // Wrapping Storage<String> so it can live in Core's NativeHandle registry.
  final class StorageHandle: NativeHandle {
    let storage: any Storage<String>
    init(_ storage: any Storage<String>) { self.storage = storage }
  }

  // MARK: - Create
  @objc
  public static func create(_ config: NSDictionary) -> String {
    print("RNPingStorage: create called with config: \(config)")

    var id = ""
    // POC bridge: async -> sync via semaphore
    let semaphore = DispatchSemaphore(value: 0)

    Task {
      id = await createAndRegister(config: config)
      semaphore.signal()
    }

    semaphore.wait()
    print("RNPingStorage: registered storage instance \(id)")
    return id
  }

  // MARK: - Configure
  @objc
  public static func configure(_ config: NSDictionary) -> String {
    print("RNPingStorage: configure called with config: \(config)")
    return create(config)
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

    Task {
      guard let storage = await resolveStorage(id: id) else {
        rejecter("E_SAVE_FAILED", "Invalid storage id", nil)
        return
      }

      do {
        let data = try JSONSerialization.data(withJSONObject: item, options: [])
        let jsonString = String(data: data, encoding: .utf8) ?? "{}"
        print("RNPingStorage: Saving jsonString: \(jsonString)")

        try await storage.save(item: jsonString)
        print("RNPingStorage: Save successful")
        resolver(true)
      } catch {
        print("RNPingStorage: Error saving item: \(error)")
        rejecter("E_SAVE_FAILED", "Failed to save item", error as NSError)
      }
    }
  }

  // MARK: - Get
  @objc
  public static func getItem(
    _ id: String,
    resolver: @escaping (NSDictionary?) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    print("RNPingStorage: get called")

    Task {
      guard let storage = await resolveStorage(id: id) else {
        rejecter("E_GET_FAILED", "Invalid storage id", nil)
        return
      }

      do {
        if let json = try await storage.get() {
          print("RNPingStorage: Retrieved json: \(json)")

          if let data = json.data(using: .utf8),
            let item = try JSONSerialization.jsonObject(with: data) as? NSDictionary
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
        print("RNPingStorage: Error getting item: \(error)")
        rejecter("E_GET_FAILED", "Failed to get item", error as NSError)
      }
    }
  }

  // MARK: - Delete
  @objc
  public static func delete(
    _ id: String,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    print("RNPingStorage: delete called")

    Task {
      guard let storage = await resolveStorage(id: id) else {
        rejecter("E_DELETE_FAILED", "Invalid storage id", nil)
        return
      }

      do {
        try await storage.delete()
        await CoreRuntime.storageRegistry.remove(id)  // drop handle after delete
        print("RNPingStorage: Delete successful")
        resolver(true)
      } catch {
        print("RNPingStorage: Error deleting item: \(error)")
        rejecter("E_DELETE_FAILED", "Failed to delete item", error as NSError)
      }
    }
  }
}

// MARK: - Internal helpers (kept inside this file for POC)

@available(iOS 16.0.0, *)
private extension RNPingStorageCommon {

  /// Old StorageRegistry.create(config:) logic, but registers into CoreRuntime.
  static func createAndRegister(config: NSDictionary) async -> String {
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

    // ✅ Core owns ids + lifecycle
    let id = await CoreRuntime.storageRegistry.register(StorageHandle(finalInstance))
    return id
  }

  /// Resolves the Storage<String> instance from CoreRuntime for a given id.
  static func resolveStorage(id: String) async -> (any Storage<String>)? {
    guard let raw = await CoreRuntime.storageRegistry.resolve(id),
      let handle = raw as? StorageHandle
    else {
      return nil
    }
    return handle.storage
  }
}
