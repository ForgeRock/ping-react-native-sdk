//
//  RNPingOidcImpl.swift
//  RNPingOidc
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation

/// Swift entry point used by the Obj-C++ bridges.
@objcMembers
public class RNPingOidcImpl: NSObject {

  /// Shared singleton instance.
  public static let shared = RNPingOidcImpl()

  private override init() {
    super.init()
  }

  /// Create a native-backed OIDC client.
  public func createClient(_ config: NSDictionary) -> String {
    return RNPingOidcCommon.createClient(config)
  }

  /// Create a native-backed OIDC web client.
  public func createWebClient(_ clientId: String) -> String {
    return RNPingOidcCommon.createWebClient(clientId)
  }

  /// Launch the authorization flow.
  public func authorize(
    _ webClientId: String,
    options: NSDictionary,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.authorize(webClientId, options: options, resolver: resolver, rejecter: rejecter)
  }

  /// Check whether a user is available for the given web client.
  public func hasUser(
    _ webClientId: String,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.hasUser(webClientId, resolver: resolver, rejecter: rejecter)
  }

  /// Resolve tokens for the current user.
  public func token(
    _ webClientId: String,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.token(webClientId, resolver: resolver, rejecter: rejecter)
  }

  /// Fetch user profile data from the userinfo endpoint.
  public func userinfo(
    _ webClientId: String,
    cache: Bool,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.userinfo(webClientId, cache: cache, resolver: resolver, rejecter: rejecter)
  }

  /// Revoke tokens for the current user.
  public func revoke(
    _ webClientId: String,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.revoke(webClientId, resolver: resolver, rejecter: rejecter)
  }

  /// Logout the current user.
  public func logout(
    _ webClientId: String,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.logout(webClientId, resolver: resolver, rejecter: rejecter)
  }
}
