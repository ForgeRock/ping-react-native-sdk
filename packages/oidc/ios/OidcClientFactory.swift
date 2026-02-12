//
//  OidcClientFactory.swift
//  RNPingOidc
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation
import PingLogger
import PingOidc
import PingStorage
import RNPingStorage
import PingBrowser
import RNPingLogger

/// Builder helpers for OIDC native clients.
enum OidcClientFactory {
  /// Build a native OIDC client configuration from the payload.
  ///
  /// - Parameter payload: Parsed JS client configuration payload.
  /// - Returns: Native OIDC client configuration.
  ///
  /// Naming matches the Android factory for parity.
  static func buildOidcClient(_ payload: OidcClientPayload) -> OidcClientConfig {
    let config = OidcClientConfig()
    _ = RNPingLoggerImpl.shared.applyLogger(payload.loggerId)
    config.clientId = payload.clientId
    config.discoveryEndpoint = payload.discoveryEndpoint ?? ""
    config.redirectUri = payload.redirectUri
    config.scopes = Set(payload.scopes)
    config.acrValues = payload.acrValues
    config.state = payload.state
    config.nonce = payload.nonce
    config.uiLocales = payload.uiLocales
    config.loginHint = payload.loginHint
    config.display = payload.display
    config.prompt = payload.prompt
    if let refreshThreshold = payload.refreshThreshold {
      config.refreshThreshold = refreshThreshold
    }
    if !payload.additionalParameters.isEmpty {
      config.additionalParameters = payload.additionalParameters
    }
    config.logger = LogManager.logger

    if let openId = payload.openId, let openIdConfig = buildOpenIdConfiguration(openId) {
      config.openId = openIdConfig
    }

    if let storage = buildStorageDelegate(payload.storageId) {
      config.storage = storage
    }

    return config
  }

  /// Build a native OIDC web client from the payload.
  ///
  /// - Parameter payload: Parsed JS client configuration payload.
  /// - Returns: Native OIDC web client.
  static func buildWebClient(_ payload: OidcClientPayload) -> OidcWeb {
    return OidcWeb.createOidcWeb { config in
      _ = RNPingLoggerImpl.shared.applyLogger(payload.loggerId)
      config.logger = LogManager.logger
      if let browserType = mapBrowserType(payload.browserType) {
        config.browserType = browserType
      }
      if let browserMode = mapBrowserMode(payload.browserMode) {
        config.browserMode = browserMode
      }
      config.module(OidcModule.config) { oidc in
        oidc.clientId = payload.clientId
        oidc.discoveryEndpoint = payload.discoveryEndpoint ?? ""
        oidc.redirectUri = payload.redirectUri
        oidc.scopes = Set(payload.scopes)
        oidc.acrValues = payload.acrValues
        oidc.state = payload.state
        oidc.nonce = payload.nonce
        oidc.uiLocales = payload.uiLocales
        oidc.loginHint = payload.loginHint
        oidc.display = payload.display
        oidc.prompt = payload.prompt
        if let refreshThreshold = payload.refreshThreshold {
          oidc.refreshThreshold = refreshThreshold
        }
        if !payload.additionalParameters.isEmpty {
          oidc.additionalParameters = payload.additionalParameters
        }
        if let openId = payload.openId, let openIdConfig = buildOpenIdConfiguration(openId) {
          oidc.openId = openIdConfig
        }
        if let storage = buildStorageDelegate(payload.storageId) {
          oidc.storage = storage
        }
      }
    }
  }

  /// Build an OIDC storage delegate if a storage id is provided.
  ///
  /// - Parameter storageId: Storage identifier from JS.
  /// - Returns: Storage delegate or nil when not configured.
  private static func buildStorageDelegate(_ storageId: String?) -> StorageDelegate<Token>? {
    guard let storageId, !storageId.isEmpty else {
      return nil
    }
    let config = RNPingStorageCommon.configureOidcStorage(storageId)
    let account = (config["account"] as? String) ?? "ACCESS_TOKEN_STORAGE"
    let encryptorEnabled = (config["encryptor"] as? Bool) ?? true
    let cacheable = (config["cacheable"] as? Bool) ?? false
    let encryptor: Encryptor = {
      if encryptorEnabled, let secured = SecuredKeyEncryptor() {
        return secured
      }
      return NoEncryptor()
    }()
    return KeychainStorage<Token>(account: account, encryptor: encryptor, cacheable: cacheable)
  }

  /// Build OpenID configuration using the Codable initializer.
  ///
  /// - Parameter openId: Parsed OpenID override payload.
  /// - Returns: OpenID configuration or nil when serialization fails.
  private static func buildOpenIdConfiguration(_ openId: OpenIdPayload) -> OpenIdConfiguration? {
    var payload: [String: Any] = [
      "authorization_endpoint": openId.authorizationEndpoint,
      "token_endpoint": openId.tokenEndpoint,
      "userinfo_endpoint": openId.userinfoEndpoint,
      "end_session_endpoint": openId.endSessionEndpoint ?? "",
      "revocation_endpoint": openId.revocationEndpoint ?? ""
    ]
    if let pingEnd = openId.pingEndIdpSessionEndpoint {
      payload["ping_end_idp_session_endpoint"] = pingEnd
    }
    guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []) else {
      return nil
    }
    return try? JSONDecoder().decode(OpenIdConfiguration.self, from: data)
  }

  /// Map JS string values to PingBrowser BrowserType.
  ///
  /// - Parameter value: JS browser type string.
  /// - Returns: Parsed BrowserType or nil when unsupported.
  private static func mapBrowserType(_ value: String?) -> BrowserType? {
    guard let value = value?.lowercased() else {
      return nil
    }
    switch value {
    case "authsession":
      return .authSession
    case "nativebrowserapp":
      return .nativeBrowserApp
    case "sfviewcontroller":
      return .sfViewController
    case "ephemeralauthsession":
      return .ephemeralAuthSession
    default:
      return nil
    }
  }

  /// Map JS string values to PingBrowser BrowserMode.
  ///
  /// - Parameter value: JS browser mode string.
  /// - Returns: Parsed BrowserMode or nil when unsupported.
  private static func mapBrowserMode(_ value: String?) -> BrowserMode? {
    guard let value = value?.lowercased() else {
      return nil
    }
    switch value {
    case "login":
      return .login
    case "logout":
      return .logout
    case "custom":
      return .custom
    default:
      return nil
    }
  }
}
