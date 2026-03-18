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
import PingBrowser
import RNPingCore

/// Builder helpers for OIDC native clients.
enum OidcClientFactory {
  /// Build a native OIDC client configuration from the payload.
  ///
  /// - Parameter payload: Parsed JS client configuration payload.
  /// - Parameter logger: Optional native logger resolved from Core registry.
  /// - Returns: Native OIDC client configuration.
  ///
  /// Naming matches the Android factory for parity.
  static func buildOidcClient(
    _ payload: OidcClientPayload,
    logger: Logger?,
    queueKey: DispatchSpecificKey<Void>? = nil
  ) -> OidcClientConfig {
    let config = OidcClientConfig()
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
    if let logger {
      config.logger = logger
    }

    if let openId = payload.openId, let openIdConfig = buildOpenIdConfiguration(openId) {
      config.openId = openIdConfig
    }

    if let storage = buildStorageDelegate(payload.storageId, queueKey: queueKey) {
      config.storage = storage
    }

    return config
  }

  /// Build a native OIDC web client from the payload.
  ///
  /// - Parameter payload: Parsed JS client configuration payload.
  /// - Parameter logger: Optional native logger resolved from Core registry.
  /// - Returns: Native OIDC web client.
  static func buildWebClient(
    _ payload: OidcClientPayload,
    logger: Logger?,
    queueKey: DispatchSpecificKey<Void>? = nil
  ) -> OidcWeb {
    return OidcWeb.createOidcWeb { config in
      if let logger {
        config.logger = logger
      }
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
        if let storage = buildStorageDelegate(payload.storageId, queueKey: queueKey) {
          oidc.storage = storage
        }
      }
    }
  }

  /// Build an OIDC storage delegate if a storage id is provided.
  ///
  /// - Parameter storageId: Storage identifier from JS.
  /// - Returns: Storage delegate or nil when not configured.
  private static func buildStorageDelegate(
    _ storageId: String?,
    queueKey: DispatchSpecificKey<Void>?
  ) -> StorageDelegate<Token>? {
    guard let storageId, !storageId.isEmpty else {
      return nil
    }
    guard let queueKey,
          let config = resolveStorageConfigFromCoreSync(storageId, queueKey: queueKey) else {
      return nil
    }
    let account = config.account ?? "ACCESS_TOKEN_STORAGE"
    let encryptorEnabled = config.encryptor ?? true
    let encryptor: Encryptor = {
      if encryptorEnabled, let secured = SecuredKeyEncryptor() {
        return secured
      }
      return NoEncryptor()
    }()
    return KeychainStorage<Token>(
      account: account,
      encryptor: encryptor,
      cacheStrategy: parseCacheStrategy(cacheable: config.cacheable, rawStrategy: nil)
    )
  }

  /// Resolves storage configuration from Core OIDC registry by id.
  ///
  /// - Parameters:
  ///   - storageId: Storage handle identifier from JS.
  ///   - queueKey: Specific key for the queue that is allowed to block.
  /// - Returns: Storage handle contract payload, or nil.
  private static func resolveStorageConfigFromCoreSync(
    _ storageId: String,
    queueKey: DispatchSpecificKey<Void>
  ) -> StorageConfigHandleContract? {
    return RegistrySync.resolveSync(
      storageId,
      registry: CoreRuntime.oidcStorageConfigRegistry,
      queueKey: queueKey,
      context: "OidcClientFactory.resolveStorageConfigFromCoreSync"
    ) as? StorageConfigHandleContract
  }

  /// Maps storage config payload values to PingStorage cache strategy.
  ///
  /// Supports both the current `cacheable` boolean and future `cacheStrategy` string.
  ///
  /// - Parameter config: Registered storage configuration payload.
  /// - Returns: Native cache strategy value.
  private static func parseCacheStrategy(cacheable: Bool?, rawStrategy: String?) -> CacheStrategy {
    if let rawStrategy = rawStrategy?.lowercased() {
      switch rawStrategy {
      case "cache":
        return .CACHE
      case "cache_on_failure":
        return .CACHE_ON_FAILURE
      case "no_cache":
        return .NO_CACHE
      default:
        break
      }
    }

    if let cacheable {
      return cacheable ? .CACHE_ON_FAILURE : .NO_CACHE
    }

    return .NO_CACHE
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
