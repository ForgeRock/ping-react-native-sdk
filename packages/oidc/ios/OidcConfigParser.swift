//
//  OidcConfigParser.swift
//  RNPingOidc
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation
import RNPingCore

/// Helpers for parsing JS configuration payloads into native structs.
enum OidcConfigParser {
  /// Parse a JS dictionary into a payload object.
  ///
  /// - Parameter config: Raw JS configuration dictionary.
  /// - Returns: Parsed OIDC client payload.
  /// - Throws: NSError when required configuration is missing.
  static func parseClientConfig(_ config: NSDictionary) throws -> OidcClientPayload {
    let clientId = try ReadableMapUtils.requireString(config, key: "clientId")
    let discoveryEndpoint = config["discoveryEndpoint"] as? String
    let openIdPayload = parseOpenId(config["openId"])
    let iosConfig = config["ios"] as? NSDictionary
    if (discoveryEndpoint == nil || discoveryEndpoint?.isEmpty == true), openIdPayload == nil {
      throw NSError(domain: "RNPingOidc", code: 400, userInfo: [NSLocalizedDescriptionKey: "Missing discoveryEndpoint or openId"])
    }
    let redirectUri = try ReadableMapUtils.requireString(config, key: "redirectUri")
    let scopes = try ReadableMapUtils.requireStringArray(config, key: "scopes")

    return OidcClientPayload(
      clientId: clientId,
      discoveryEndpoint: discoveryEndpoint,
      openId: openIdPayload,
      redirectUri: redirectUri,
      scopes: scopes,
      storageId: config["storageId"] as? String,
      loggerId: config["loggerId"] as? String,
      browserType: iosConfig?["browserType"] as? String,
      browserMode: iosConfig?["browserMode"] as? String,
      acrValues: config["acrValues"] as? String,
      signOutRedirectUri: config["signOutRedirectUri"] as? String,
      state: config["state"] as? String,
      nonce: config["nonce"] as? String,
      uiLocales: config["uiLocales"] as? String,
      refreshThreshold: parseRefreshThreshold(config["refreshThreshold"]),
      loginHint: config["loginHint"] as? String,
      display: config["display"] as? String,
      prompt: config["prompt"] as? String,
      additionalParameters: ReadableMapUtils.readStringMap(config["additionalParameters"] as? NSDictionary)
    )
  }

  /// Parse an OpenID override payload from JS.
  ///
  /// - Parameter value: Raw OpenID override payload.
  /// - Returns: Parsed OpenID payload or nil when invalid.
  static func parseOpenId(_ value: Any?) -> OpenIdPayload? {
    guard let map = value as? NSDictionary else {
      return nil
    }
    guard let authorizationEndpoint = map["authorizationEndpoint"] as? String, !authorizationEndpoint.isEmpty,
          let tokenEndpoint = map["tokenEndpoint"] as? String, !tokenEndpoint.isEmpty,
          let userinfoEndpoint = map["userinfoEndpoint"] as? String, !userinfoEndpoint.isEmpty else {
      return nil
    }
    return OpenIdPayload(
      authorizationEndpoint: authorizationEndpoint,
      tokenEndpoint: tokenEndpoint,
      userinfoEndpoint: userinfoEndpoint,
      endSessionEndpoint: map["endSessionEndpoint"] as? String,
      pingEndIdpSessionEndpoint: map["pingEndIdpSessionEndpoint"] as? String,
      revocationEndpoint: map["revocationEndpoint"] as? String
    )
  }

  /// Build per-request authorization parameters.
  ///
  /// - Parameter options: Raw JS authorization options.
  /// - Returns: Normalized authorization parameters.
  static func buildAuthorizeParams(from options: NSDictionary) -> [String: String] {
    var params = [String: String]()
    if let acr = options["acrValues"] as? String { params["acr_values"] = acr }
    if let state = options["state"] as? String { params["state"] = state }
    if let nonce = options["nonce"] as? String { params["nonce"] = nonce }
    if let uiLocales = options["uiLocales"] as? String { params["ui_locales"] = uiLocales }
    if let loginHint = options["loginHint"] as? String { params["login_hint"] = loginHint }
    if let display = options["display"] as? String { params["display"] = display }
    if let prompt = options["prompt"] as? String { params["prompt"] = prompt }
    let additional = ReadableMapUtils.readStringMap(options["additionalParameters"] as? NSDictionary)
    params.merge(additional) { _, new in new }
    return params
  }

  /// Parse refresh threshold from JS.
  ///
  /// - Parameter value: Raw JS refresh threshold.
  /// - Returns: Parsed threshold value, if provided.
  private static func parseRefreshThreshold(_ value: Any?) -> Int64? {
    if let number = value as? NSNumber {
      return number.int64Value
    }
    return nil
  }
}
