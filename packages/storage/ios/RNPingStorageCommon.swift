import Foundation
import RNPingCore

@available(iOS 16.0.0, *)
@objcMembers
public class RNPingStorageCommon: NSObject {
  
  // MARK: - Nested Types
    
  /**
   Configuration for storage registration.
   Stores platform-specific configuration values without creating actual storage instances.
   The actual storage instances are created lazily by the Core SDK when needed.
   */
  struct StorageConfig {
    let type: String?
    let cacheable: Bool?
    let account: String?
    let encryptor: Bool?
  }

  /**
   A wrapper class for storage configuration that conforms to `NativeHandle`.
   This allows storage configs to be registered in Core's NativeHandle registry.
   */
  final class StorageConfigHandle: NativeHandle {
    let config: StorageConfig
    init(_ config: StorageConfig) { self.config = config }
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
    register: @escaping (StorageConfigHandle) async -> String
  ) -> String {
    precondition(
      DispatchQueue.getSpecific(key: createQueueKey) != nil,
      "RNPingStorageCommon.create must be called on createQueue"
    )

    var id = ""
    let semaphore = DispatchSemaphore(value: 0)

    Task {
      let config = buildStorageConfig(from: config)
      let handle = StorageConfigHandle(config)
      id = await register(handle)
      semaphore.signal()
    }

    semaphore.wait()
    return id
  }
  
  // MARK: - Private Helpers
  
  /**
   Builds storage configuration based on the provided dictionary.
   
   - Parameter config: A dictionary containing storage configuration values (account, encryptor, cacheStrategy, etc.).
   - Returns: A normalized `StorageConfig` for later use by the Core SDK.
   */
  private static func buildStorageConfig(from config: NSDictionary) -> StorageConfig {
    let type = config["type"] as? String
    let cacheStrategy = (config["cacheStrategy"] as? String)?.uppercased()
    let cacheable = resolveCacheable(from: cacheStrategy)
    let account = config["account"] as? String ?? "com.pingidentity.rnsampleapp.keyalias"
    let encryptor = config["encryptor"] as? Bool ?? true

    return StorageConfig(
      type: type,
      cacheable: cacheable,
      account: account,
      encryptor: encryptor
    )
  }

  /**
   Resolves the cacheable flag from the cache strategy string.
   
   - Parameter cacheStrategy: The cache strategy string (NO_CACHE, CACHE, or CACHE_ON_FAILURE).
   - Returns: `false` for NO_CACHE, `true` for CACHE, or `nil` for CACHE_ON_FAILURE or unrecognized values.
   */
  private static func resolveCacheable(from cacheStrategy: String?) -> Bool? {
    switch cacheStrategy {
    case "NO_CACHE":
      return false
    case "CACHE":
      return true
    default:
      return nil
    }
  }
  
  /**
   Registers a session storage config into CoreRuntime.
   
   - Parameter handle: The storage config handle to register.
   - Returns: A unique identifier for the registered storage config.
   */
  private static func registerSessionStorage(_ handle: StorageConfigHandle) async -> String {
    return await CoreRuntime.sessionStorageConfigRegistry.register(handle)
  }

  /**
   Registers an OIDC storage config into CoreRuntime.
   
   - Parameter handle: The storage config handle to register.
   - Returns: A unique identifier for the registered storage config.
   */
  private static func registerOidcStorage(_ handle: StorageConfigHandle) async -> String {
    return await CoreRuntime.oidcStorageConfigRegistry.register(handle)
  }
}
