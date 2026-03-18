/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// OpenID endpoint override values exposed by the native OIDC module.
public struct OidcOpenIdConfig: Sendable {
  /// Authorization endpoint URL.
  public let authorizationEndpoint: String
  /// Token endpoint URL.
  public let tokenEndpoint: String
  /// Userinfo endpoint URL.
  public let userinfoEndpoint: String
  /// Optional end-session endpoint URL.
  public let endSessionEndpoint: String?
  /// Optional Ping end-session endpoint URL.
  public let pingEndIdpSessionEndpoint: String?
  /// Optional token revocation endpoint URL.
  public let revocationEndpoint: String?

  public init(
    authorizationEndpoint: String,
    tokenEndpoint: String,
    userinfoEndpoint: String,
    endSessionEndpoint: String?,
    pingEndIdpSessionEndpoint: String?,
    revocationEndpoint: String?
  ) {
    self.authorizationEndpoint = authorizationEndpoint
    self.tokenEndpoint = tokenEndpoint
    self.userinfoEndpoint = userinfoEndpoint
    self.endSessionEndpoint = endSessionEndpoint
    self.pingEndIdpSessionEndpoint = pingEndIdpSessionEndpoint
    self.revocationEndpoint = revocationEndpoint
  }
}

/// Shared native handle contract that exposes OIDC client configuration values.
///
/// Modules that compose with OIDC (for example Journey) should resolve this
/// handle from ``CoreRuntime/oidcClientRegistry`` rather than depending on
/// OIDC package internals.
public protocol OidcClientConfigHandle: NativeHandle {
  /// OIDC client identifier registered on the authorization server.
  var clientId: String { get }

  /// OIDC discovery endpoint URL, if configured.
  var discoveryEndpoint: String? { get }

  /// OIDC redirect URI used by the native client.
  var redirectUri: String { get }

  /// OIDC scopes configured for this client.
  var scopes: [String] { get }

  /// Optional OpenID endpoint override configuration.
  var openId: OidcOpenIdConfig? { get }

  /// Optional ACR values.
  var acrValues: String? { get }

  /// Optional sign-out redirect URI.
  var signOutRedirectUri: String? { get }

  /// Optional OIDC state parameter.
  var state: String? { get }

  /// Optional OIDC nonce parameter.
  var nonce: String? { get }

  /// Optional OIDC UI locales parameter.
  var uiLocales: String? { get }

  /// Optional token refresh threshold in seconds.
  var refreshThreshold: Int64? { get }

  /// Optional OIDC login hint.
  var loginHint: String? { get }

  /// Optional OIDC display parameter.
  var display: String? { get }

  /// Optional OIDC prompt parameter.
  var prompt: String? { get }

  /// Optional provider-specific parameters.
  var additionalParameters: [String: String] { get }
}
