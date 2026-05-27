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

   - Note: `@unchecked Sendable` is used because this is a reference type
   crossing actor boundaries through `Registry`. The wrapped `StorageConfig`
   is immutable (`let`) and `Sendable`, so the handle is effectively immutable.
   */
  final class StorageConfigHandle: StorageConfigHandleContract, @unchecked Sendable {
    /// The wrapped storage configuration
    let config: StorageConfig
    var cacheable: Bool? { config.cacheable }
    var account: String? { config.account }
    var encryptor: Bool? { config.encryptor }
    
    /// Creates a new storage config handle.
    /// - Parameter config: The storage configuration to wrap
    init(_ config: StorageConfig) { self.config = config }
  }

  // MARK: - Nested Types (OATH)

  /**
   Configuration for OATH keychain storage registration.

   OATH uses `OathKeychainStorage(service:logger:securityOptions:)` whose
   parameters (`service`, `requireBiometrics`, `requireDevicePasscode`,
   `biometricPrompt`, `accessGroup`) are entirely different from the
   `cacheable`/`account`/`encryptor` fields used by session/OIDC/binding
   storage. A separate struct prevents field conflation.
   */
  struct OathStorageConfig: Codable, Sendable {
    /// Keychain service identifier for the OATH credential store.
    let service: String?
    /// Whether biometric authentication is required to access stored OATH tokens.
    let requireBiometrics: Bool?
    /// Whether a device passcode is required to access stored OATH tokens.
    let requireDevicePasscode: Bool?
    /// Localized prompt shown to the user during biometric authentication.
    let biometricPrompt: String?
    /// Keychain access group for sharing OATH credentials across app extensions.
    let accessGroup: String?
  }

  /**
   A wrapper class for OATH storage configuration that conforms to `OathStorageConfigHandleContract`.

   This allows OATH storage configs to be registered in Core's NativeHandle registry.

   - Note: `@unchecked Sendable` is used because this is a reference type
     crossing actor boundaries through `Registry`. The wrapped `OathStorageConfig`
     is immutable (`let`) and `Sendable`, so the handle is effectively immutable.
     All mutable access is guarded by the caller's `createQueue`.
   */
  final class OathStorageConfigHandle: OathStorageConfigHandleContract, @unchecked Sendable {
    /// The wrapped OATH storage configuration.
    let config: OathStorageConfig
    var service: String? { config.service }
    var requireBiometrics: Bool? { config.requireBiometrics }
    var requireDevicePasscode: Bool? { config.requireDevicePasscode }
    var biometricPrompt: String? { config.biometricPrompt }
    var accessGroup: String? { config.accessGroup }

    /// Creates a new OATH storage config handle.
    /// - Parameter config: The OATH storage configuration to wrap.
    init(_ config: OathStorageConfig) { self.config = config }
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
      // TODO: Resolve and apply native logger from `loggerId` once storage logger wiring is implemented.
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
      // TODO: Resolve and apply native logger from `loggerId` once storage logger wiring is implemented.
      registerConfig(config, registry: CoreRuntime.oidcStorageConfigRegistry)
    }
  }

  /// Registers a binding user-key storage configuration.
  ///
  /// - Parameter config: Dictionary containing storage configuration (cacheable, account, encryptor)
  /// - Returns: A unique identifier for the registered storage configuration
  @objc
  public static func registerBindingUserKeyStorage(_ config: NSDictionary) -> String {
    return createQueue.sync {
      registerConfig(config, registry: CoreRuntime.bindingUserKeyStorageConfigRegistry)
    }
  }

  /// Registers a push MFA storage configuration.
  ///
  /// - Parameter config: Dictionary containing storage configuration (cacheable, account, encryptor)
  /// - Returns: A unique identifier for the registered storage configuration
  @objc
  public static func registerPushStorage(_ config: NSDictionary) -> String {
    return createQueue.sync {
      registerConfig(config, registry: CoreRuntime.pushStorageConfigRegistry)
    }
  }

  /// Registers an OATH storage configuration.
  ///
  /// OATH uses a different keychain model from session/OIDC/binding storage, so
  /// configuration is registered via a dedicated `OathStorageConfigHandle` rather
  /// than the shared `StorageConfigHandle`.
  ///
  /// - Parameter config: Dictionary containing OATH storage configuration.
  ///   Recognized keys: `service` (String), `requireBiometrics` (Bool),
  ///   `requireDevicePasscode` (Bool), `biometricPrompt` (String),
  ///   `accessGroup` (String).
  /// - Returns: A unique identifier for the registered OATH storage configuration.
  @objc
  public static func registerOathStorage(_ config: NSDictionary) -> String {
    return createQueue.sync {
      registerOathConfig(config, registry: CoreRuntime.oathStorageConfigRegistry)
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

  /// Retrieves and encodes a previously registered binding user-key storage configuration.
  ///
  /// - Parameter id: The unique identifier of the storage configuration to retrieve
  /// - Returns: A dictionary representation of the storage configuration
  @objc
  public static func configureBindingUserKeyStorage(_ id: String) -> NSDictionary {
    return createQueue.sync {
      let resolvedConfig = resolveConfig(id, registry: CoreRuntime.bindingUserKeyStorageConfigRegistry)
      return encodeConfig(resolvedConfig)
    }
  }

  /// Retrieves and encodes a previously registered push MFA storage configuration.
  ///
  /// - Parameter id: The unique identifier of the storage configuration to retrieve
  /// - Returns: A dictionary representation of the storage configuration
  @objc
  public static func configurePushStorage(_ id: String) -> NSDictionary {
    return createQueue.sync {
      let resolvedConfig = resolveConfig(id, registry: CoreRuntime.pushStorageConfigRegistry)
      return encodeConfig(resolvedConfig)
    }
  }

  /// Retrieves and encodes a previously registered OATH storage configuration.
  ///
  /// - Parameter id: The unique identifier of the OATH storage configuration to retrieve.
  /// - Returns: A dictionary representation of the OATH storage configuration.
  @objc
  public static func configureOathStorage(_ id: String) -> NSDictionary {
    return createQueue.sync {
      let resolvedConfig = resolveOathConfig(id, registry: CoreRuntime.oathStorageConfigRegistry)
      return encodeOathConfig(resolvedConfig)
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
  
  // MARK: - Private Methods - OATH Configuration

  /// Registers an OATH storage configuration by converting it to an `OathStorageConfigHandle`
  /// and storing it in the provided registry.
  ///
  /// This method must be called on `createQueue` to prevent blocking critical threads.
  /// - Parameters:
  ///   - config: The OATH storage configuration dictionary.
  ///   - registry: The target registry used to store the configuration handle.
  /// - Returns: A unique identifier for the registered OATH storage configuration.
  private static func registerOathConfig(
    _ config: NSDictionary,
    registry: Registry
  ) -> String {
    precondition(
      DispatchQueue.getSpecific(key: createQueueKey) != nil,
      "RNPingStorageCommon.registerOathConfig must be called on createQueue"
    )

    let oathConfig = buildOathStorageConfig(from: config)
    let handle = OathStorageConfigHandle(oathConfig)
    return RegistrySync.registerSync(
      handle,
      registry: registry,
      queueKey: createQueueKey,
      context: "RNPingStorageCommon.registerOathConfig"
    )
  }

  /// Resolves an OATH storage configuration by ID using the provided registry.
  ///
  /// This method must be called on `createQueue` to prevent blocking critical threads.
  /// - Parameters:
  ///   - id: The unique identifier of the OATH storage configuration to resolve.
  ///   - registry: The source registry that stores OATH configuration handles.
  /// - Returns: The resolved OATH storage configuration, or `nil` on failure.
  /// - Note: Raises an `NSException` when no OATH configuration is registered for the id.
  private static func resolveOathConfig(
    _ id: String,
    registry: Registry
  ) -> OathStorageConfig? {
    precondition(
      DispatchQueue.getSpecific(key: createQueueKey) != nil,
      "RNPingStorageCommon.resolveOathConfig must be called on createQueue"
    )

    let resolvedConfig = (
      RegistrySync.resolveSync(
        id,
        registry: registry,
        queueKey: createQueueKey,
        context: "RNPingStorageCommon.resolveOathConfig"
      ) as? OathStorageConfigHandle
    )?.config
    guard let resolvedConfig else {
      NSException(
        name: .invalidArgumentException,
        reason: "No OATH storage config registered for id=\(id)",
        userInfo: nil
      ).raise()
      return nil
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
    let account = config["account"] as? String ?? "com.pingidentity.rnstorage.storage"
    let encryptor = config["encryptor"] as? Bool ?? true

    return StorageConfig(
      cacheable: cacheable,
      account: account,
      encryptor: encryptor
    )
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

  /// Resolves a session storage configuration from CoreRuntime by ID.
  ///
  /// - Parameter id: The unique identifier of the storage configuration
  /// - Returns: The resolved storage configuration, or nil if not found
  private static func resolveSessionStorage(_ id: String) async -> StorageConfig? {
    let handle = await CoreRuntime.sessionStorageConfigRegistry.resolve(id)
    let configHandle = handle as? StorageConfigHandle
    return configHandle?.config
  }

  /// Resolves an OIDC storage configuration from CoreRuntime by ID.
  ///
  /// - Parameter id: The unique identifier of the storage configuration
  /// - Returns: The resolved storage configuration, or nil if not found
  private static func resolveOidcStorage(_ id: String) async -> StorageConfig? {
    let handle = await CoreRuntime.oidcStorageConfigRegistry.resolve(id)
    let configHandle = handle as? StorageConfigHandle
    return configHandle?.config
  }

  // MARK: - Private Helpers - OATH

  /// Builds an OATH storage configuration from the provided dictionary.
  ///
  /// Reads OATH-specific fields using oath-prefixed keys to avoid conflation with
  /// the `account`/`cacheable`/`encryptor` fields used by session/OIDC/binding storage.
  /// The TurboModule bridge (`RNPingStorage.mm`) forwards these keys from the extended
  /// `NativeStorageConfig`; the classic bridge forwards the raw `NSDictionary` unchanged.
  ///
  /// - Parameter config: A dictionary containing OATH storage configuration values.
  ///   Recognized keys: `oathService` (String), `oathRequireBiometrics` (Bool),
  ///   `oathRequireDevicePasscode` (Bool), `oathBiometricPrompt` (String),
  ///   `oathAccessGroup` (String).
  /// - Returns: A normalized `OathStorageConfig` for later use by the Core SDK.
  private static func buildOathStorageConfig(from config: NSDictionary) -> OathStorageConfig {
    let service = config["oathService"] as? String
    let requireBiometrics = config["oathRequireBiometrics"] as? Bool
    let requireDevicePasscode = config["oathRequireDevicePasscode"] as? Bool
    let biometricPrompt = config["oathBiometricPrompt"] as? String
    let accessGroup = config["oathAccessGroup"] as? String

    return OathStorageConfig(
      service: service,
      requireBiometrics: requireBiometrics,
      requireDevicePasscode: requireDevicePasscode,
      biometricPrompt: biometricPrompt,
      accessGroup: accessGroup
    )
  }

  /// Encodes an OATH storage configuration to a dictionary for bridge consumption.
  ///
  /// - Parameter config: The OATH storage configuration to encode, or `nil`.
  /// - Returns: A dictionary representation of the config, or an empty dictionary if config is `nil`.
  private static func encodeOathConfig(_ config: OathStorageConfig?) -> NSDictionary {
    guard let config else {
      return [:]
    }

    var dict: [String: Any] = [:]
    if let service = config.service {
      dict["service"] = service
    }
    if let requireBiometrics = config.requireBiometrics {
      dict["requireBiometrics"] = requireBiometrics
    }
    if let requireDevicePasscode = config.requireDevicePasscode {
      dict["requireDevicePasscode"] = requireDevicePasscode
    }
    if let biometricPrompt = config.biometricPrompt {
      dict["biometricPrompt"] = biometricPrompt
    }
    if let accessGroup = config.accessGroup {
      dict["accessGroup"] = accessGroup
    }
    return dict as NSDictionary
  }

}
