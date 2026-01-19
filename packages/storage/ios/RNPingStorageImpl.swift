/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import Foundation
import React
import RNPingCore

/**
 Implementation class for the RNPingStorage module.
 
 This class provides React Native bridge methods for storage operations,
 delegating to `RNPingStorageCommon` for the actual implementation.
 */
@available(iOS 16.0.0, *)
@objcMembers
public class RNPingStorageImpl: NSObject {

  /// Shared singleton instance.
  @objc public static let shared = RNPingStorageImpl()

  @objc private override init() {
    super.init()
  }
  
  /**
   Registers a session storage configuration.
   
   - Parameter config: Configuration dictionary for the storage.
   - Returns: A unique identifier for the registered configuration.
   */
  @objc
  public func registerSessionStorage(_ config: NSDictionary) -> String {
    return RNPingStorageCommon.registerSessionStorage(config)
  }

  /**
   Registers an OIDC storage configuration.
   
   - Parameter config: Configuration dictionary for the storage.
   - Returns: A unique identifier for the registered configuration.
   */
  @objc
  public func registerOidcStorage(_ config: NSDictionary) -> String {
    return RNPingStorageCommon.registerOidcStorage(config)
  }

  /**
   Resolves a session storage configuration by id.
   
   - Parameter id: Storage configuration identifier.
   - Returns: A serialized storage configuration string.
   */
  @objc
  public func configureSessionStorage(_ id: String) -> String {
    return RNPingStorageCommon.configureSessionStorage(id)
  }

  /**
   Resolves an OIDC storage configuration by id.
   
   - Parameter id: Storage configuration identifier.
   - Returns: A serialized storage configuration string.
   */
  @objc
  public func configureOidcStorage(_ id: String) -> String {
    return RNPingStorageCommon.configureOidcStorage(id)
  }
}
