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
final class OidcClientHandle: NativeHandle {
  let payload: OidcClientPayload
  let client: OidcClient
  let user: OidcUser

  init(payload: OidcClientPayload, client: OidcClient, user: OidcUser) {
    self.payload = payload
    self.client = client
    self.user = user
  }
}

/// Handle for storing OIDC web client instances.
final class OidcWebHandle: NativeHandle {
  let clientId: String
  let web: OidcWeb

  init(clientId: String, web: OidcWeb) {
    self.clientId = clientId
    self.web = web
  }
}
