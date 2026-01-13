import Foundation
import PingStorage
import RNPingCore

@available(iOS 16.0.0, *)
@objcMembers
public class RNPingStorageCommon: NSObject {
  
  // MARK: - Nested Types
    
  /**
   A wrapper class for `Storage<String>` that conforms to `NativeHandle`.
   This allows storage instances to be registered in Core's NativeHandle registry.
   */
  final class StorageHandle: NativeHandle {
    let storage: any Storage<String>
    init(_ storage: any Storage<String>) { self.storage = storage }
  }
  
  // MARK: - Private Properties
  
  /// A dispatch-specific key for identifying the create queue.
  private static let createQueueKey = DispatchSpecificKey<Void>()
  
  /**
   Dedicated serial queue for safe blocking while enforcing a known execution context.
   
   This prevents callers from blocking the main thread or other critical threads
   when waiting synchronously for async registration to complete.
   */
  private static let createQueue: DispatchQueue = {
    let q = DispatchQueue(label: "com.ping.storage.create", qos: .userInitiated)
    q.setSpecific(key: createQueueKey, value: ())
    return q
  }()
  
  // MARK: - Public Methods - Configuration
  
  @objc
  public static func configureSessionStorage(_ config: NSDictionary) -> String {
    return createQueue.sync {
      create(config, register: registerSessionStorage)
    }
  }

  @objc
  public static func configureOidcStorage(_ config: NSDictionary) -> String {
    return createQueue.sync {
      create(config, register: registerOidcStorage)
    }
  }
  
  // MARK: - Private Methods - Configuration
  
  private static func create(
    _ config: NSDictionary,
    register: @escaping (StorageHandle) async -> String
  ) -> String {
    precondition(
      DispatchQueue.getSpecific(key: createQueueKey) != nil,
      "RNPingStorageCommon.create must be called on createQueue"
    )

    var id = ""
    let semaphore = DispatchSemaphore(value: 0)

    Task {
      let instance = await createStorageInstance(from: config)
      let handle = StorageHandle(instance)
      id = await register(handle)
      semaphore.signal()
    }

    semaphore.wait()
    return id
  }
  
  // MARK: - Private Helpers
  
  /**
   Creates a storage instance based on the provided configuration.
   
   - Parameter config: A dictionary containing storage configuration including type, account, cache strategy, and encryptor settings.
   - Returns: A configured `Storage<String>` instance.
   */
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
  
  /**
   Registers a session storage instance into CoreRuntime.
   
   - Parameter handle: The storage handle to register.
   - Returns: A unique identifier for the registered storage.
   */
  private static func registerSessionStorage(_ handle: StorageHandle) async -> String {
    return await CoreRuntime.sessionStorageRegistry.register(handle)
  }

  /**
   Registers an OIDC storage instance into CoreRuntime.
   
   - Parameter handle: The storage handle to register.
   - Returns: A unique identifier for the registered storage.
   */
  private static func registerOidcStorage(_ handle: StorageHandle) async -> String {
    return await CoreRuntime.oidcStorageRegistry.register(handle)
  }
}
