/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import RNPingCore

/// Parses JS configuration maps into strongly-typed DaVinci payloads.
enum DaVinciConfigParser {
  /// Parses and validates DaVinci configuration from a JS bridge map.
  ///
  /// - Parameter config: Bridge payload.
  /// - Returns: Parsed DaVinci client payload.
  /// - Throws: `DaVinciBridgeError.argument` when required fields are missing, blank, or the
  ///   `timeout` value is a non-numeric string.
  static func parse(_ config: NSDictionary) throws -> DaVinciClientPayload {
    let discoveryEndpoint: String
    do {
      discoveryEndpoint = try ReadableMapUtils.requireString(config, key: "discoveryEndpoint")
    } catch {
      throw DaVinciBridgeError.argument("Missing required parameter: discoveryEndpoint")
    }

    let clientId: String
    do {
      clientId = try ReadableMapUtils.requireString(config, key: "clientId")
    } catch {
      throw DaVinciBridgeError.argument("Missing required parameter: clientId")
    }

    let redirectUri: String
    do {
      redirectUri = try ReadableMapUtils.requireString(config, key: "redirectUri")
    } catch {
      throw DaVinciBridgeError.argument("Missing required parameter: redirectUri")
    }

    let scopes = ReadableMapUtils.readStringArray(config["scopes"] as? NSArray)
    let storageId = readOptionalString(config["storageId"])
    let loggerId = readOptionalString(config["loggerId"])
    let timeout = try requireInt64IfPresent(config["timeout"], key: "timeout")
    let signOutRedirectUri = readOptionalString(config["signOutRedirectUri"])
    let loginHint = readOptionalString(config["loginHint"])
    let nonce = readOptionalString(config["nonce"])
    let state = readOptionalString(config["state"])
    let prompt = readOptionalString(config["prompt"])
    let display = readOptionalString(config["display"])
    let uiLocales = readOptionalString(config["uiLocales"])
    let acrValues = readOptionalString(config["acrValues"])
    let refreshThreshold = parseInt64(config["refreshThreshold"])
    let additionalParameters = ReadableMapUtils.readStringMap(
      config["additionalParameters"] as? NSDictionary
    )

    return DaVinciClientPayload(
      discoveryEndpoint: discoveryEndpoint,
      clientId: clientId,
      redirectUri: redirectUri,
      scopes: scopes,
      storageId: storageId,
      loggerId: loggerId,
      timeout: timeout,
      signOutRedirectUri: signOutRedirectUri,
      loginHint: loginHint,
      nonce: nonce,
      state: state,
      prompt: prompt,
      display: display,
      uiLocales: uiLocales,
      acrValues: acrValues,
      refreshThreshold: refreshThreshold,
      additionalParameters: additionalParameters
    )
  }

  /// Reads an optional numeric value as `Int64`.
  ///
  /// - Parameter value: Raw bridge value.
  /// - Returns: Parsed `Int64`, or `nil` when missing/unparseable.
  private static func parseInt64(_ value: Any?) -> Int64? {
    if let number = value as? NSNumber {
      return number.int64Value
    }
    if let string = value as? String,
       let parsed = Int64(string.trimmingCharacters(in: .whitespacesAndNewlines)) {
      return parsed
    }
    return nil
  }

  /// Parses an optional numeric field, throwing when the value is present but not a valid integer.
  ///
  /// - Parameters:
  ///   - value: Raw bridge value.
  ///   - key: Field name used in the error message.
  /// - Returns: Parsed `Int64`, or `nil` when the field is absent.
  /// - Throws: `DaVinciBridgeError.argument` when the value is a non-numeric string.
  private static func requireInt64IfPresent(_ value: Any?, key: String) throws -> Int64? {
    guard let value else { return nil }
    if let number = value as? NSNumber {
      return number.int64Value
    }
    if let string = value as? String {
      let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
      if let parsed = Int64(trimmed) { return parsed }
      throw DaVinciBridgeError.argument("Invalid value for '\(key)': expected a number, got \"\(trimmed)\"")
    }
    return nil
  }

  /// Reads an optional string and trims whitespace/newlines.
  ///
  /// - Parameter value: Raw bridge value.
  /// - Returns: Trimmed string, or `nil` when missing or blank.
  private static func readOptionalString(_ value: Any?) -> String? {
    guard let stringValue = value as? String else {
      return nil
    }
    let trimmed = stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }
}
