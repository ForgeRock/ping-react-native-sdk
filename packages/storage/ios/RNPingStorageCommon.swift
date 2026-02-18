/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import Foundation
import RNPingCore

/// A common utility class for managing storage configurations in React Native Ping SDK.
///
/// This class provides methods to register and configure both session and OIDC storage,
/// using a lazy initialization pattern where configs are registered first and actual
/// storage instances are created later by the Core SDK when needed.
@available(iOS 16.0.0, *)
@objcMembers
public class RNPingStorageCommon: NSObject {
  
  // MARK: - Nested Types
    
  /**
   Configuration for storage registration.
   Stores platform-specific configuration values without creating actual storage instances.
   The actual storage instances are created lazily by the Core SDK when needed.
   */
  struct StorageConfig: Codable, Sendable {
    /// Whether the storage should be cacheable
    let cacheable: Bool?
    /// The account identifier for keychain storage
    let account: String?
    /// Whether to use encryption for the storage
    let encryptor: Bool?
  }

  /**
   A wrapper class for storage configuration that conforms to `NativeHandle`.
   This allows storage configs to be registered in Core's NativeHandle registry.
   */
  final class StorageConfigHandle: NativeHandle, @unchecked Sendable {
    /// The wrapped storage configuration
    let config: StorageConfig
    
    /// Creates a new storage config handle.
    /// - Parameter config: The storage configuration to wrap
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
  
  /// Registers a session storage configuration.
  ///
  /// - Parameter config: Dictionary containing storage configuration (cacheable, account, encryptor)
  /// - Returns: A unique identifier for the registered storage configuration
  @objc
  public static func registerSessionStorage(_ config: NSDictionary) -> String {
    return createQueue.sync {
      registerConfig(config, registry: CoreRuntime.sessionStorageConfigRegistry)
    }
  }

  /// Registers an OIDC storage configuration.
  ///
  /// - Parameter config: Dictionary containing storage configuration (cacheable, account, encryptor)
  /// - Returns: A unique identifier for the registered storage configuration
  @objc
  public static func registerOidcStorage(_ config: NSDictionary) -> String {
    return createQueue.sync {
      registerConfig(config, registry: CoreRuntime.oidcStorageConfigRegistry)
    }
  }

  /// Retrieves and encodes a previously registered session storage configuration.
  ///
  /// - Parameter id: The unique identifier of the storage configuration to retrieve
  /// - Returns: A dictionary representation of the storage configuration
  @objc
  public static func configureSessionStorage(_ id: String) -> NSDictionary {
    return createQueue.sync {
      let resolvedConfig = resolveConfig(id, registry: CoreRuntime.sessionStorageConfigRegistry)
      return encodeConfig(resolvedConfig)
    }
  }

  /// Retrieves and encodes a previously registered OIDC storage configuration.
  ///
  /// - Parameter id: The unique identifier of the storage configuration to retrieve
  /// - Returns: A dictionary representation of the storage configuration
  @objc
  public static func configureOidcStorage(_ id: String) -> NSDictionary {
    return createQueue.sync {
      let resolvedConfig = resolveConfig(id, registry: CoreRuntime.oidcStorageConfigRegistry)
      return encodeConfig(resolvedConfig)
    }
  }

  // MARK: - Private Methods - Configuration

  /// Registers a storage configuration by converting it to a StorageConfig and storing it in the provided registry.
  ///
  /// This method must be called on the createQueue to prevent blocking critical threads.
  /// - Parameters:
  ///   - config: The storage configuration dictionary
  ///   - registry: The target registry used to store the configuration handle
  /// - Returns: A unique identifier for the registered storage configuration
  private static func registerConfig(
    _ config: NSDictionary,
    registry: Registry
  ) -> String {
    precondition(
      DispatchQueue.getSpecific(key: createQueueKey) != nil,
      "RNPingStorageCommon.registerConfig must be called on createQueue"
    )

    let storageConfig = buildStorageConfig(from: config)
    let handle = StorageConfigHandle(storageConfig)
    return RegistrySync.registerSync(
      handle,
      registry: registry,
      queueKey: createQueueKey,
      context: "RNPingStorageCommon.registerConfig"
    )
  }

  /// Resolves a storage configuration by ID using the provided registry.
  ///
  /// This method must be called on the createQueue to prevent blocking critical threads.
  /// - Parameters:
  ///   - id: The unique identifier of the storage configuration to resolve
  ///   - registry: The source registry that stores configuration handles
  /// - Returns: The resolved storage configuration
  /// - Throws: Raises an exception when no configuration is registered for the id
  private static func resolveConfig(
    _ id: String,
    registry: Registry
  ) -> StorageConfig {
    precondition(
      DispatchQueue.getSpecific(key: createQueueKey) != nil,
      "RNPingStorageCommon.resolveConfig must be called on createQueue"
    )

    let resolvedConfig = (
      RegistrySync.resolveSync(
        id,
        registry: registry,
        queueKey: createQueueKey,
        context: "RNPingStorageCommon.resolveConfig"
      ) as? StorageConfigHandle
    )?.config
    guard let resolvedConfig else {
      NSException(
        name: .invalidArgumentException,
        reason: "No storage config registered for id=\(id)",
        userInfo: nil
      ).raise()
      return StorageConfig(cacheable: nil, account: nil, encryptor: nil)
    }
    return resolvedConfig
  }
  
  // MARK: - Private Helpers
  
  /// Encodes a storage configuration to a dictionary.
  ///
  /// - Parameter config: The storage configuration to encode, or nil
  /// - Returns: A dictionary representation of the config, or an empty dictionary if config is nil
  private static func encodeConfig(_ config: StorageConfig?) -> NSDictionary {
    guard let config else {
      return [:]
    }

    var dict: [String: Any] = [:]
    if let cacheable = config.cacheable {
      dict["cacheable"] = cacheable
    }
    if let account = config.account {
      dict["account"] = account
    }
    if let encryptor = config.encryptor {
      dict["encryptor"] = encryptor
    }

    return dict as NSDictionary
  }

  /**
   Builds storage configuration based on the provided dictionary.
   
   - Parameter config: A dictionary containing storage configuration values (account, encryptor, cacheable, etc.).
   - Returns: A normalized `StorageConfig` for later use by the Core SDK.
   */
  private static func buildStorageConfig(from config: NSDictionary) -> StorageConfig {
    let cacheable = config["cacheable"] as? Bool
    let account = config["account"] as? String ?? "com.pingidentity.rnsampleapp.keyalias"
    let encryptor = config["encryptor"] as? Bool ?? true

    return StorageConfig(
      cacheable: cacheable,
      account: account,
      encryptor: encryptor
    )
  }

}
