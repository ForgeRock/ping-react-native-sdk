//
//  OidcPayloads.swift
//  RNPingOidc
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation

/// OpenID configuration override payload parsed from JS.
struct OpenIdPayload {
  let authorizationEndpoint: String
  let tokenEndpoint: String
  let userinfoEndpoint: String
  let endSessionEndpoint: String?
  let pingEndIdpSessionEndpoint: String?
  let revocationEndpoint: String?
}

/// OIDC client configuration payload parsed from JS.
struct OidcClientPayload {
  let clientId: String
  let discoveryEndpoint: String?
  let openId: OpenIdPayload?
  let redirectUri: String
  let scopes: [String]
  let storageId: String?
  let loggerId: String?
  let browserType: String?
  let browserMode: String?
  let acrValues: String?
  // TODO(iOS SDK 2.x): Wire signOutRedirectUri into native config once the new SDK supports it.
  let signOutRedirectUri: String?
  let state: String?
  let nonce: String?
  let uiLocales: String?
  let refreshThreshold: Int64?
  let loginHint: String?
  let display: String?
  let prompt: String?
  let additionalParameters: [String: String]
}
