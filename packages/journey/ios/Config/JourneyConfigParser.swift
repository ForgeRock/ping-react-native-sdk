/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import RNPingCore

/// Parses JS configuration maps into strongly-typed Journey payloads.
enum JourneyConfigParser {
  /// Parses and validates Journey configuration.
  ///
  /// - Parameter config: Bridge payload.
  /// - Returns: Parsed Journey client payload.
  /// - Throws: `JourneyBridgeError.argument` when required fields are missing or invalid.
  static func parse(_ config: NSDictionary) throws -> JourneyClientPayload {
    let serverUrl: String
    do {
      serverUrl = try ReadableMapUtils.requireString(config, key: "serverUrl")
    } catch {
      throw JourneyBridgeError.argument("Missing required parameter: serverUrl")
    }

    let realm = readOptionalString(config["realm"])
    let cookie = readOptionalString(config["cookie"])
    let clientId = readOptionalString(config["clientId"])
    let discoveryEndpoint = readOptionalString(config["discoveryEndpoint"])
    let redirectUri = readOptionalString(config["redirectUri"])
    let scopes = ReadableMapUtils.readStringArray(config["scopes"] as? NSArray)
    let openId = try parseOpenId(config["openId"])
    let acrValues = readOptionalString(config["acrValues"])
    let signOutRedirectUri = readOptionalString(config["signOutRedirectUri"])
    let state = readOptionalString(config["state"])
    let nonce = readOptionalString(config["nonce"])
    let uiLocales = readOptionalString(config["uiLocales"])
    let refreshThreshold = parseRefreshThreshold(config["refreshThreshold"])
    let loginHint = readOptionalString(config["loginHint"])
    let display = readOptionalString(config["display"])
    let prompt = readOptionalString(config["prompt"])
    let additionalParameters = ReadableMapUtils.readStringMap(
      config["additionalParameters"] as? NSDictionary
    )
    let sessionStorageId = readOptionalString(config["sessionStorageId"])
    let loggerId = readOptionalString(config["loggerId"])
    let oidcClientId = readOptionalString(config["oidcClientId"])

    let hasOidcClientHandle = !(oidcClientId?.isEmpty ?? true)
    let hasAnyOidcField =
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
      !additionalParameters.isEmpty

    if !hasOidcClientHandle &&
      hasAnyOidcField &&
      (
        (clientId?.isEmpty ?? true) ||
        (redirectUri?.isEmpty ?? true) ||
        ((discoveryEndpoint?.isEmpty ?? true) && openId == nil)
      ) {
      throw JourneyBridgeError.argument(
        "clientId, redirectUri, and either discoveryEndpoint or openId must all be provided when OIDC is configured"
      )
    }

    return JourneyClientPayload(
      serverUrl: serverUrl,
      realm: realm,
      cookie: cookie,
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
      sessionStorageId: sessionStorageId,
      loggerId: loggerId,
      oidcClientId: oidcClientId
    )
  }

  /// Parses optional OpenID endpoint override payload.
  ///
  /// - Parameter value: Journey `openId` payload from JS.
  /// - Returns: Parsed OpenID payload, or `nil` when omitted.
  /// - Throws: `JourneyBridgeError.argument` when required endpoint values are missing.
  private static func parseOpenId(_ value: Any?) throws -> JourneyOpenIdPayload? {
    guard let map = value as? NSDictionary else {
      return nil
    }

    let authorizationEndpoint: String
    let tokenEndpoint: String
    let userinfoEndpoint: String

    do {
      authorizationEndpoint = try ReadableMapUtils.requireString(map, key: "authorizationEndpoint")
      tokenEndpoint = try ReadableMapUtils.requireString(map, key: "tokenEndpoint")
      userinfoEndpoint = try ReadableMapUtils.requireString(map, key: "userinfoEndpoint")
    } catch {
      throw JourneyBridgeError.argument(
        "openId.authorizationEndpoint, openId.tokenEndpoint, and openId.userinfoEndpoint are required"
      )
    }

    return JourneyOpenIdPayload(
      authorizationEndpoint: authorizationEndpoint,
      tokenEndpoint: tokenEndpoint,
      userinfoEndpoint: userinfoEndpoint,
      endSessionEndpoint: readOptionalString(map["endSessionEndpoint"]),
      pingEndIdpSessionEndpoint: readOptionalString(map["pingEndIdpSessionEndpoint"]),
      revocationEndpoint: readOptionalString(map["revocationEndpoint"])
    )
  }

  /// Parses optional refresh threshold from JS payload.
  ///
  /// - Parameter value: Raw refresh threshold value.
  /// - Returns: Normalized refresh threshold, or `nil` when omitted.
  private static func parseRefreshThreshold(_ value: Any?) -> Int64? {
    if let number = value as? NSNumber {
      return number.int64Value
    }
    if let string = value as? String, let parsed = Int64(string.trimmingCharacters(in: .whitespacesAndNewlines)) {
      return parsed
    }
    return nil
  }

  /// Reads an optional string and trims whitespace/newlines.
  ///
  /// - Parameter value: Raw map value.
  /// - Returns: Trimmed string or `nil`.
  private static func readOptionalString(_ value: Any?) -> String? {
    guard let stringValue = value as? String else {
      return nil
    }
    let trimmed = stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }
}

