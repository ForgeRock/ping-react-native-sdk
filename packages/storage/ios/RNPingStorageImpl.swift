import Foundation
import PingStorage
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

  // MARK: - Configure
  
  /**
   Configures a session storage instance.
   
   - Parameter config: Configuration dictionary for the storage.
   - Returns: A unique identifier for the configured storage.
   */
  @objc
  public func configureSessionStorage(_ config: NSDictionary) -> String {
    let id = RNPingStorageCommon.configureSessionStorage(config)
    return id
  }

  /**
   Configures an OIDC storage instance.
   
   - Parameter config: Configuration dictionary for the storage.
   - Returns: A unique identifier for the configured storage.
   */
  @objc
  public func configureOidcStorage(_ config: NSDictionary) -> String {
    let id = RNPingStorageCommon.configureOidcStorage(config)
    return id
  }
}
