/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Parsed DaVinci client configuration supplied by JavaScript.
///
/// Mirrors the wire format from `NativeDaVinciConfig` in the TypeScript layer
/// (all OIDC fields are flat under the top-level payload, not nested).
struct DaVinciClientPayload: Sendable {
  /// OIDC discovery endpoint URL — required.
  let discoveryEndpoint: String
  /// OAuth2 client identifier — required.
  let clientId: String
  /// OAuth2 redirect URI — required.
  let redirectUri: String
  /// OAuth2 scopes to request.
  let scopes: [String]
  /// Optional OIDC storage handle id.
  let storageId: String?
  /// Optional logger handle id.
  let loggerId: String?
  /// Optional network timeout in milliseconds.
  let timeout: Int64?
  /// Optional sign-out redirect URI (TODO-SDK-PARITY: Android only in 2.0.1 — iOS silently ignores).
  let signOutRedirectUri: String?
  /// Optional login hint.
  let loginHint: String?
  /// Optional nonce parameter.
  let nonce: String?
  /// Optional state parameter.
  let state: String?
  /// Optional prompt parameter.
  let prompt: String?
  /// Optional display parameter.
  let display: String?
  /// Optional UI locales.
  let uiLocales: String?
  /// Optional ACR values.
  let acrValues: String?
  /// Optional proactive token refresh threshold in seconds.
  let refreshThreshold: Int64?
  /// Optional additional authorization request parameters.
  let additionalParameters: [String: String]
}
