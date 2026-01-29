//
//  RNPingOidcCommon.swift
//  RNPingOidc
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation

/// Common iOS implementation for the Ping OIDC React Native module.
@objcMembers
public class RNPingOidcCommon: NSObject {

  private static var clientCounter: Int = 0
  private static var webClientCounter: Int = 0

  /// Create an OIDC client from JavaScript configuration.
  @objc
  public static func createClient(_ config: NSDictionary) -> String {
    clientCounter += 1
    return "oidc-client-\(clientCounter)"
  }

  /// Create an OIDC web client from an existing client handle.
  @objc
  public static func createWebClient(_ clientId: String) -> String {
    webClientCounter += 1
    return "oidc-web-\(webClientCounter)"
  }

  /// Retrieve tokens for the current client.
  @objc
  public static func clientToken(
    _ clientId: String,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    rejecter("OIDC_NOT_IMPLEMENTED", "OIDC native module not implemented", nil)
  }

  /// Refresh tokens for the current client.
  @objc
  public static func clientRefresh(
    _ clientId: String,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    rejecter("OIDC_NOT_IMPLEMENTED", "OIDC native module not implemented", nil)
  }

  /// Fetch userinfo for the current client.
  @objc
  public static func clientUserinfo(
    _ clientId: String,
    cache: Bool,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    rejecter("OIDC_NOT_IMPLEMENTED", "OIDC native module not implemented", nil)
  }

  /// Revoke tokens for the current client.
  @objc
  public static func clientRevoke(
    _ clientId: String,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    resolver(true)
  }

  /// Logout the current client session.
  @objc
  public static func clientEndSession(
    _ clientId: String,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    resolver(true)
  }

  /// Start an OIDC authorization flow.
  @objc
  public static func authorize(
    _ webClientId: String,
    options: NSDictionary,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    resolver(["type": "cancel"])
  }

  /// Check whether a user is available for the given client.
  @objc
  public static func hasUser(
    _ webClientId: String,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    resolver(false)
  }

  /// Retrieve tokens for the current user.
  @objc
  public static func token(
    _ webClientId: String,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    rejecter("OIDC_NOT_IMPLEMENTED", "OIDC native module not implemented", nil)
  }

  /// Fetch user profile data from the userinfo endpoint.
  @objc
  public static func userinfo(
    _ webClientId: String,
    cache: Bool,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    rejecter("OIDC_NOT_IMPLEMENTED", "OIDC native module not implemented", nil)
  }

  /// Revoke tokens for the current user.
  @objc
  public static func revoke(
    _ webClientId: String,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    resolver(true)
  }

  /// Logout the current user.
  @objc
  public static func logout(
    _ webClientId: String,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    resolver(true)
  }
}
