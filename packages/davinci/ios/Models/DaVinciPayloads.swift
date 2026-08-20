/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Parsed Protect lifecycle module configuration supplied by JavaScript.
///
/// Mirrors `DaVinciProtectModuleConfig` in the TypeScript layer and maps to
/// `ProtectLifecycleConfig` in the native PingOneProtect SDK.
struct ProtectLifecyclePayload: Sendable {
  /// PingOne environment ID for the Protect SDK.
  let envId: String?
  /// Whether to enable behavioral data collection. Default: true.
  let isBehavioralDataCollection: Bool
  /// Whether to use lazy metadata loading. Default: false.
  let isLazyMetadata: Bool
  /// Custom host URL for the Protect SDK.
  let customHost: String?
  /// Whether to enable console logging inside the Protect SDK. Default: false.
  let isConsoleLogEnabled: Bool
  /// Device attributes to exclude from signal collection.
  let deviceAttributesToIgnore: [String]
  /// Whether to pause behavioral data collection on successful authentication. Default: false.
  let pauseBehavioralDataOnSuccess: Bool
  /// Whether to resume behavioral data collection when the flow starts. Default: false.
  let resumeBehavioralDataOnStart: Bool
  /// Optional logger handle id from JS for Protect operations.
  let loggerId: String?
}

/// Parsed DaVinci OIDC configuration supplied by JavaScript.
struct DaVinciOidcPayload: Sendable {
  /// OIDC discovery endpoint URL — required.
  let discoveryEndpoint: String
  /// OAuth2 client identifier — required.
  let clientId: String
  /// OAuth2 redirect URI — required.
  let redirectUri: String
  /// OAuth2 scopes to request.
  let scopes: [String]
  /// Optional PAR enablement flag.
  let par: Bool?
  /// Optional OIDC storage handle id.
  let storageId: String?
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

/// Parsed DaVinci client configuration supplied by JavaScript.
///
/// Mirrors the wire format from `NativeDaVinciConfig` in the TypeScript layer,
/// while grouping the supported OIDC fields under `oidc` for native use.
struct DaVinciClientPayload: Sendable {
  /// Parsed OIDC configuration. Always present because DaVinci requires OIDC.
  let oidc: DaVinciOidcPayload
  /// Optional logger handle id.
  let loggerId: String?
  /// Optional network timeout in milliseconds.
  let timeout: Int64?
  /// Optional protect lifecycle module configuration. Present only when modules.protect is provided.
  let protect: ProtectLifecyclePayload?
}
