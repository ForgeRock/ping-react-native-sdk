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
public class RNPingOidcImpl: NSObject, @unchecked Sendable {

  /// Shared singleton instance.
  @objc public static let shared = RNPingOidcImpl()

  private override init() {
    super.init()
  }

  /// Clean up native resources when the bridge is invalidated.
  public func invalidate() {
    RNPingOidcCommon.cleanup()
  }

  /// Create a native-backed OIDC client.
  ///
  /// - Parameter config: JS client configuration payload.
  /// - Returns: Registered client identifier.
  public func createClient(_ config: NSDictionary) -> String {
    return RNPingOidcCommon.createClient(config)
  }

  /// Create a native-backed OIDC web client.
  ///
  /// - Parameter clientId: Identifier returned by `createClient`.
  /// - Returns: Registered web client identifier.
  public func createWebClient(_ clientId: String) -> String {
    return RNPingOidcCommon.createWebClient(clientId)
  }

  /// Resolve tokens for the current client.
  ///
  /// - Parameters:
  ///   - clientId: Identifier returned by `createClient`.
  ///   - resolver: Resolver called with token payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  public func clientToken(
    _ clientId: String,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.clientToken(clientId, resolver: resolver, rejecter: rejecter)
  }

  /// Refresh tokens for the current client.
  ///
  /// - Parameters:
  ///   - clientId: Identifier returned by `createClient`.
  ///   - resolver: Resolver called with token payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  public func clientRefresh(
    _ clientId: String,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.clientRefresh(clientId, resolver: resolver, rejecter: rejecter)
  }

  /// Fetch user profile data from the userinfo endpoint for the client.
  ///
  /// - Parameters:
  ///   - clientId: Identifier returned by `createClient`.
  ///   - cache: Whether to use cached userinfo when available.
  ///   - resolver: Resolver called with userinfo payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  public func clientUserinfo(
    _ clientId: String,
    cache: Bool,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.clientUserinfo(clientId, cache: cache, resolver: resolver, rejecter: rejecter)
  }

  /// Revoke tokens for the current client.
  ///
  /// - Parameters:
  ///   - clientId: Identifier returned by `createClient`.
  ///   - resolver: Resolver called on success.
  ///   - rejecter: Rejecter called with a `GenericError`.
  public func clientRevoke(
    _ clientId: String,
    resolver: @escaping @Sendable () -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.clientRevoke(clientId, resolver: resolver, rejecter: rejecter)
  }

  /// Logout the current client session.
  ///
  /// - Parameters:
  ///   - clientId: Identifier returned by `createClient`.
  ///   - resolver: Resolver called with end-session status.
  ///   - rejecter: Rejecter called with a `GenericError`.
  public func clientEndSession(
    _ clientId: String,
    resolver: @escaping @Sendable (Bool) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.clientEndSession(clientId, resolver: resolver, rejecter: rejecter)
  }

  /// Launch the authorization flow.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - options: Per-request authorization overrides.
  ///   - resolver: Resolver called with the authorize result payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  public func authorize(
    _ webClientId: String,
    options: NSDictionary,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.authorize(webClientId, options: options, resolver: resolver, rejecter: rejecter)
  }

  /// Check whether a user is available for the given web client.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - resolver: Resolver called with a boolean result.
  ///   - rejecter: Rejecter called with a `GenericError`.
  public func hasUser(
    _ webClientId: String,
    resolver: @escaping @Sendable (Bool) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.hasUser(webClientId, resolver: resolver, rejecter: rejecter)
  }

  /// Resolve tokens for the current user.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - resolver: Resolver called with token payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  public func token(
    _ webClientId: String,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.token(webClientId, resolver: resolver, rejecter: rejecter)
  }

  /// Refresh tokens for the current user.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - resolver: Resolver called with token payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  public func refresh(
    _ webClientId: String,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.refresh(webClientId, resolver: resolver, rejecter: rejecter)
  }

  /// Fetch user profile data from the userinfo endpoint.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - cache: Whether to use cached userinfo when available.
  ///   - resolver: Resolver called with userinfo payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  public func userinfo(
    _ webClientId: String,
    cache: Bool,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.userinfo(webClientId, cache: cache, resolver: resolver, rejecter: rejecter)
  }

  /// Revoke tokens for the current user.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - resolver: Resolver called on success.
  ///   - rejecter: Rejecter called with a `GenericError`.
  public func revoke(
    _ webClientId: String,
    resolver: @escaping @Sendable () -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.revoke(webClientId, resolver: resolver, rejecter: rejecter)
  }

  /// Logout the current user.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - resolver: Resolver called on success.
  ///   - rejecter: Rejecter called with a `GenericError`.
  public func logout(
    _ webClientId: String,
    resolver: @escaping @Sendable () -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.logout(webClientId, resolver: resolver, rejecter: rejecter)
  }

  /// Deregister an OIDC client from CoreRuntime registries.
  public func disposeClient(
    _ clientId: String,
    resolver: @escaping @Sendable () -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.disposeClient(clientId, resolver: resolver, rejecter: rejecter)
  }

  /// Deregister an OIDC web client from CoreRuntime registries.
  public func disposeWebClient(
    _ webClientId: String,
    resolver: @escaping @Sendable () -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    RNPingOidcCommon.disposeWebClient(webClientId, resolver: resolver, rejecter: rejecter)
  }
}
