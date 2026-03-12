/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Optional OpenID endpoint override settings for Journey OIDC composition.
struct JourneyOpenIdPayload: Sendable {
  let authorizationEndpoint: String
  let tokenEndpoint: String
  let userinfoEndpoint: String
  let endSessionEndpoint: String?
  let pingEndIdpSessionEndpoint: String?
  let revocationEndpoint: String?
}

/// Optional OIDC module configuration parsed from Journey config.
struct JourneyOidcPayload: Sendable {
  /// Optional OIDC client id used for Journey + OIDC composition.
  let clientId: String?
  /// Optional OIDC discovery endpoint URL.
  let discoveryEndpoint: String?
  /// Optional OIDC redirect URI.
  let redirectUri: String?
  /// Optional OIDC scopes requested for token exchanges.
  let scopes: [String]
  /// Optional OpenID endpoint override settings.
  let openId: JourneyOpenIdPayload?
  /// Optional ACR values passed to OIDC authorization.
  let acrValues: String?
  /// Optional sign-out redirect URI for OIDC end-session.
  let signOutRedirectUri: String?
  /// Optional OIDC state parameter.
  let state: String?
  /// Optional OIDC nonce parameter.
  let nonce: String?
  /// Optional OIDC UI locales parameter.
  let uiLocales: String?
  /// Optional token refresh threshold in seconds.
  let refreshThreshold: Int64?
  /// Optional OIDC login hint parameter.
  let loginHint: String?
  /// Optional OIDC display parameter.
  let display: String?
  /// Optional OIDC prompt parameter.
  let prompt: String?
  /// Optional provider-specific OIDC parameters.
  let additionalParameters: [String: String]
  /// Optional OIDC storage handle id from the storage bridge module.
  let storageId: String?
  /// Optional OIDC client handle id from the OIDC bridge module.
  let clientHandleId: String?
}

/// Parsed Journey client payload supplied by JavaScript.
struct JourneyClientPayload: Sendable {
  /// Base AM/Ping server URL.
  let serverUrl: String
  /// Optional network timeout in milliseconds.
  let timeout: Int64?
  /// Optional AM realm path.
  let realm: String?
  /// Optional cookie/session namespace override.
  let cookie: String?
  /// Optional OIDC module configuration.
  let oidc: JourneyOidcPayload?
  /// Optional session storage handle id from the storage bridge module.
  let sessionStorageId: String?
  /// Optional logger handle id from the logger bridge module.
  let loggerId: String?
}

extension JourneyClientPayload {
  /// Backward-compatible initializer used by existing tests/helpers while the
  /// native payload structure transitions to grouped OIDC settings.
  init(
    serverUrl: String,
    timeout: Int64?,
    realm: String?,
    cookie: String?,
    clientId: String?,
    discoveryEndpoint: String?,
    redirectUri: String?,
    scopes: [String],
    openId: JourneyOpenIdPayload?,
    acrValues: String?,
    signOutRedirectUri: String?,
    state: String?,
    nonce: String?,
    uiLocales: String?,
    refreshThreshold: Int64?,
    loginHint: String?,
    display: String?,
    prompt: String?,
    additionalParameters: [String: String],
    sessionStorageId: String?,
    oidcStorageId: String?,
    loggerId: String?,
    oidcClientId: String?
  ) {
    let hasOidcPayload =
      !(clientId?.isEmpty ?? true) ||
      !(discoveryEndpoint?.isEmpty ?? true) ||
      !(redirectUri?.isEmpty ?? true) ||
      openId != nil ||
      !(acrValues?.isEmpty ?? true) ||
      !(signOutRedirectUri?.isEmpty ?? true) ||
      !(state?.isEmpty ?? true) ||
      !(nonce?.isEmpty ?? true) ||
      !(uiLocales?.isEmpty ?? true) ||
      refreshThreshold != nil ||
      !(loginHint?.isEmpty ?? true) ||
      !(display?.isEmpty ?? true) ||
      !(prompt?.isEmpty ?? true) ||
      !additionalParameters.isEmpty ||
      !(oidcStorageId?.isEmpty ?? true) ||
      !(oidcClientId?.isEmpty ?? true)

    self.init(
      serverUrl: serverUrl,
      timeout: timeout,
      realm: realm,
      cookie: cookie,
      oidc: hasOidcPayload
        ? JourneyOidcPayload(
          clientId: clientId,
          discoveryEndpoint: discoveryEndpoint,
          redirectUri: redirectUri,
          scopes: scopes,
          openId: openId,
          acrValues: acrValues,
          signOutRedirectUri: signOutRedirectUri,
          state: state,
          nonce: nonce,
          uiLocales: uiLocales,
          refreshThreshold: refreshThreshold,
          loginHint: loginHint,
          display: display,
          prompt: prompt,
          additionalParameters: additionalParameters,
          storageId: oidcStorageId,
          clientHandleId: oidcClientId
        )
        : nil,
      sessionStorageId: sessionStorageId,
      loggerId: loggerId
    )
  }
}
