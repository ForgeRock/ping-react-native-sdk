//
//  OidcResponseMapper.swift
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

/// Serialize native OIDC responses to JS-friendly payloads.
enum OidcResponseMapper {
  /// Convert a token to a JS-facing dictionary.
  ///
  /// - Parameter token: Native token payload.
  /// - Returns: JS-facing token dictionary.
  static func encodeTokens(_ token: Token) -> NSDictionary {
    return TokenMapUtils.buildTokenMap(
      accessToken: token.accessToken,
      idToken: token.idToken,
      refreshToken: token.refreshToken,
      tokenExpiry: token.expiresAt
    )
  }

  /// Convert userinfo to a JS-facing dictionary.
  ///
  /// - Parameter info: Native userinfo payload.
  /// - Returns: JS-facing userinfo dictionary.
  static func encodeUserinfo(_ info: UserInfo) -> NSDictionary {
    return JsonBridgeMapper.encodeJsonObject(info)
  }
}
