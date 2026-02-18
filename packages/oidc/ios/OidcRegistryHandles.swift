//
//  OidcRegistryHandles.swift
//  RNPingOidc
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation
import PingOidc
import RNPingCore

/// Handle for storing OIDC client instances.
final class OidcClientHandle: OidcClientConfigHandle, @unchecked Sendable {
  let payload: OidcClientPayload
  let client: OidcClient
  let user: OidcUser

  init(payload: OidcClientPayload, client: OidcClient, user: OidcUser) {
    self.payload = payload
    self.client = client
    self.user = user
  }

  var clientId: String { payload.clientId }
  var discoveryEndpoint: String? { payload.discoveryEndpoint }
  var redirectUri: String { payload.redirectUri }
  var scopes: [String] { payload.scopes }
  var openId: OidcOpenIdConfig? {
    guard let openId = payload.openId else {
      return nil
    }
    return OidcOpenIdConfig(
      authorizationEndpoint: openId.authorizationEndpoint,
      tokenEndpoint: openId.tokenEndpoint,
      userinfoEndpoint: openId.userinfoEndpoint,
      endSessionEndpoint: openId.endSessionEndpoint,
      pingEndIdpSessionEndpoint: openId.pingEndIdpSessionEndpoint,
      revocationEndpoint: openId.revocationEndpoint
    )
  }
  var acrValues: String? { payload.acrValues }
  var signOutRedirectUri: String? { payload.signOutRedirectUri }
  var state: String? { payload.state }
  var nonce: String? { payload.nonce }
  var uiLocales: String? { payload.uiLocales }
  var refreshThreshold: Int64? { payload.refreshThreshold }
  var loginHint: String? { payload.loginHint }
  var display: String? { payload.display }
  var prompt: String? { payload.prompt }
  var additionalParameters: [String: String] { payload.additionalParameters }
}

/// Handle for storing OIDC web client instances.
final class OidcWebHandle: NativeHandle, @unchecked Sendable {
  let clientId: String
  let web: OidcWeb

  init(clientId: String, web: OidcWeb) {
    self.clientId = clientId
    self.web = web
  }
}
