import Foundation
import PingStorage
import RNPingCore

@available(iOS 16.0.0, *)
@objcMembers
public class RNPingStorageCommon: NSObject {
  
  // MARK: - Nested Types
  
  /// Wrapping Storage<String> so it can live in Core's NativeHandle registry.
  final class StorageHandle: NativeHandle {
    let storage: any Storage<String>
    init(_ storage: any Storage<String>) { self.storage = storage }
  }
  
  // MARK: - Private Properties
  
  private static let createQueueKey = DispatchSpecificKey<Void>()
  
  /// Dedicated serial queue so we can safely block while still enforcing a known execution context.
  /// A one-off dispatch around create wouldn't prevent callers from blocking main or
  /// other critical threads when waiting synchronously for the async register to finish.
  private static let createQueue: DispatchQueue = {
    let q = DispatchQueue(label: "com.ping.storage.create", qos: .userInitiated)
    q.setSpecific(key: createQueueKey, value: ())
    return q
  }()
  
  // MARK: - Public Methods - Configuration
  
  @objc
  public static func configure(_ config: NSDictionary) -> String {
    return createQueue.sync {
      create(config)
    }
  }
  
  // MARK: - Private Methods - Configuration
  
  private static func create(_ config: NSDictionary) -> String {
    precondition(
      DispatchQueue.getSpecific(key: createQueueKey) != nil,
      "RNPingStorageCommon.create must be called on createQueue"
    )

    var id = ""
    let semaphore = DispatchSemaphore(value: 0)

    Task {
      let instance = await createStorageInstance(from: config)
      id = await registerStorage(instance)
      semaphore.signal()
    }

    semaphore.wait()
    return id
  }
  
  // MARK: - Public Methods - CRUD Operations
  
  @objc
  public static func save(
    _ id: String,
    item: NSDictionary,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let storage = await resolveStorage(id: id) else {
        rejecter("E_SAVE_FAILED", "Invalid storage id", nil)
        return
      }

      do {
        let data = try JSONSerialization.data(withJSONObject: item, options: [])
        guard let jsonString = String(data: data, encoding: .utf8) else {
          throw NSError(domain: "RNPingStorage", code: 0, userInfo: [NSLocalizedDescriptionKey: "Failed to convert JSON data to UTF-8 string"])
        }

        try await storage.save(item: jsonString)
        resolver(true)
      } catch {
        print("RNPingStorage: Error saving item: \(error)")
        rejecter("E_SAVE_FAILED", "Failed to save item", error as NSError)
      }
    }
  }
  
  @objc
  public static func getItem(
    _ id: String,
    resolver: @escaping (NSDictionary?) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let storage = await resolveStorage(id: id) else {
        rejecter("E_GET_FAILED", "Invalid storage id", nil)
        return
      }

      do {
        if let json = try await storage.get() {
          if let data = json.data(using: .utf8),
            let item = try JSONSerialization.jsonObject(with: data) as? NSDictionary
          {
            resolver(item)
          } else {
            resolver(nil)
          }
        } else {
          resolver(nil)
        }
      } catch {
        print("RNPingStorage: Error getting item: \(error)")
        rejecter("E_GET_FAILED", "Failed to get item", error as NSError)
      }
    }
  }
  
  @objc
  public static func deleteItem(
    _ id: String,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let storage = await resolveStorage(id: id) else {
        rejecter("E_DELETE_FAILED", "Invalid storage id", nil)
        return
      }

      do {
        try await storage.delete()
        await CoreRuntime.storageRegistry.remove(id)  // drop handle after delete
        resolver(true)
      } catch {
        print("RNPingStorage: Error deleting item: \(error)")
        rejecter("E_DELETE_FAILED", "Failed to delete item", error as NSError)
      }
    }
  }
  
  // MARK: - Private Helpers
  
  /// Creates a storage instance based on the provided configuration.
  private static func createStorageInstance(from config: NSDictionary) -> any Storage<String> {
    guard let type = config["type"] as? String else {
      fatalError("RNPingStorage: Missing required 'type' parameter in configuration")
    }
    let account = config["account"] as? String ?? "com.pingidentity.rnsampleapp.keyalias"
    let cacheStrategyRaw = (config["cacheStrategy"] as? String)?.uppercased()
    let shouldUseEncryptor = config["encryptor"] as? Bool ?? true

    let base: any Storage<String>
    switch type.lowercased() {
    case "memory":
      base = MemoryStorage<String>()

    case "encrypted", "datastore":
      let encryptor: any Encryptor
      if shouldUseEncryptor, let securedEncryptor = SecuredKeyEncryptor() {
        encryptor = securedEncryptor
      } else {
        if shouldUseEncryptor {
          print(
            "RNPingStorage: Failed to initialize SecuredKeyEncryptor; " +
              "falling back to NoEncryptor. Set encryptor=false to suppress this warning."
          )
        }
        encryptor = NoEncryptor()
      }

      base = KeychainStorage<String>(
        account: account,
        encryptor: encryptor
      )

    default:
      fatalError("RNPingStorage: Invalid storage type '\(type)'. Must be 'memory', 'encrypted', or 'datastore'")
    }

    let finalInstance: any Storage<String>
    if cacheStrategyRaw == "CACHE" {
      finalInstance = StorageDelegate(delegate: base, cacheable: true)
    } else {
      finalInstance = base
    }

    return finalInstance
  }
  
  /// Registers a storage instance into CoreRuntime and returns its id.
  private static func registerStorage(_ instance: any Storage<String>) async -> String {
    let id = await CoreRuntime.storageRegistry.register(StorageHandle(instance))
    return id
  }
  
  /// Resolves the Storage<String> instance from CoreRuntime for a given id.
  private static func resolveStorage(id: String) async -> (any Storage<String>)? {
    guard let raw = await CoreRuntime.storageRegistry.resolve(id),
      let handle = raw as? StorageHandle
    else {
      return nil
    }
    return handle.storage
  }
}
