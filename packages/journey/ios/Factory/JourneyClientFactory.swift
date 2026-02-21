/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingJourney
import PingLogger
import PingOidc
import PingStorage
import RNPingCore

/// Builds native Journey instances from parsed JS payloads.
final class JourneyClientFactory {
  /// OIDC settings resolved from direct Journey config or shared OIDC handles.
  private struct ResolvedOidcConfig: Sendable {
    let clientId: String
    let discoveryEndpoint: String?
    let redirectUri: String
    let scopes: [String]
    let openId: OidcOpenIdConfig?
    let acrValues: String?
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

  /// Builds a Journey workflow from parsed configuration.
  ///
  /// - Parameter payload: Parsed Journey payload.
  /// - Returns: Configured native Journey instance.
  /// - Throws: `JourneyBridgeError.argument` when payload values are invalid.
  /// - Throws: `JourneyBridgeError.state` when shared registries cannot resolve handles.
  func build(_ payload: JourneyClientPayload) async throws -> Journey {
    let resolvedOidc = try await resolveOidcConfig(payload)
    let resolvedLogger = await resolveLoggerFromCore(payload.loggerId)
    let sessionStorage = await Self.buildSessionStorageDelegate(payload.sessionStorageId)
    let oidcStorage = await Self.buildOidcStorageDelegate(payload.oidcStorageId)

    return Journey.createJourney { config in
      if let resolvedLogger {
        config.logger = resolvedLogger
      }
      config.serverUrl = payload.serverUrl
      if let timeoutSeconds = Self.timeoutSeconds(from: payload.timeout) {
        config.timeout = timeoutSeconds
      }

      if let realm = payload.realm {
        config.realm = realm
      }
      if let cookie = payload.cookie {
        config.cookie = cookie
      }
      if let sessionStorage {
        config.module(PingJourney.SessionModule.config) { module in
          module.storage = sessionStorage
        }
      }

      if let oidcConfig = resolvedOidc {
        config.module(PingJourney.OidcModule.config) { module in
          module.clientId = oidcConfig.clientId
          if let discoveryEndpoint = oidcConfig.discoveryEndpoint {
            module.discoveryEndpoint = discoveryEndpoint
          }
          module.redirectUri = oidcConfig.redirectUri
          module.scopes = Set(oidcConfig.scopes)
          module.acrValues = oidcConfig.acrValues
          module.state = oidcConfig.state
          module.nonce = oidcConfig.nonce
          module.uiLocales = oidcConfig.uiLocales
          module.loginHint = oidcConfig.loginHint
          module.display = oidcConfig.display
          module.prompt = oidcConfig.prompt
          if let refreshThreshold = oidcConfig.refreshThreshold {
            module.refreshThreshold = refreshThreshold
          }
          if !oidcConfig.additionalParameters.isEmpty {
            module.additionalParameters = oidcConfig.additionalParameters
          }
          if let openId = oidcConfig.openId {
            if let openIdConfiguration = Self.buildOpenIdConfiguration(openId) {
              module.openId = openIdConfiguration
            }
          }
          if let oidcStorage {
            module.storage = oidcStorage
          }

          if oidcConfig.signOutRedirectUri != nil {
            // TODO(iOS SDK parity): OidcClientConfig currently does not expose
            // `signOutRedirectUri` on iOS. Android supports this field.
          }
        }
      }
    }
  }

  /// Resolve a native logger from the shared Core logger registry.
  ///
  /// - Parameter loggerId: Logger handle identifier from JS.
  /// - Returns: Native logger instance, or `nil` when missing/invalid.
  private func resolveLoggerFromCore(_ loggerId: String?) async -> Logger? {
    guard let loggerId, !loggerId.isEmpty else {
      return nil
    }
    guard let handle = await CoreRuntime.loggerRegistry.resolve(loggerId) as? LoggerHandleContract else {
      return nil
    }
    switch handle.loggerLevel.uppercased() {
    case "STANDARD":
      return LogManager.standard
    case "WARN":
      return LogManager.warning
    case "NONE":
      return LogManager.none
    default:
      return LogManager.none
    }
  }

  /// Resolves OIDC settings from shared OIDC handles or direct Journey fields.
  ///
  /// - Parameter payload: Parsed Journey payload.
  /// - Returns: Resolved OIDC settings, or `nil` when OIDC is not configured.
  /// - Throws: `JourneyBridgeError.argument` when required values are missing.
  /// - Throws: `JourneyBridgeError.state` when OIDC handle resolution fails.
  private func resolveOidcConfig(_ payload: JourneyClientPayload) async throws -> ResolvedOidcConfig? {
    if let oidcClientId = payload.oidcClientId, !oidcClientId.isEmpty {
      return try await resolveOidcConfigFromHandle(oidcClientId)
    }

    if let clientId = payload.clientId, !clientId.isEmpty,
       let redirectUri = payload.redirectUri, !redirectUri.isEmpty,
       let discoveryEndpoint = payload.discoveryEndpoint, !discoveryEndpoint.isEmpty {
      return ResolvedOidcConfig(
        clientId: clientId,
        discoveryEndpoint: discoveryEndpoint,
        redirectUri: redirectUri,
        scopes: payload.scopes,
        openId: payload.openId.map(Self.toCoreOpenId),
        acrValues: payload.acrValues,
        signOutRedirectUri: payload.signOutRedirectUri,
        state: payload.state,
        nonce: payload.nonce,
        uiLocales: payload.uiLocales,
        refreshThreshold: payload.refreshThreshold,
        loginHint: payload.loginHint,
        display: payload.display,
        prompt: payload.prompt,
        additionalParameters: payload.additionalParameters
      )
    }

    if let clientId = payload.clientId, !clientId.isEmpty,
       let redirectUri = payload.redirectUri, !redirectUri.isEmpty,
       let openId = payload.openId {
      return ResolvedOidcConfig(
        clientId: clientId,
        discoveryEndpoint: payload.discoveryEndpoint,
        redirectUri: redirectUri,
        scopes: payload.scopes,
        openId: Self.toCoreOpenId(openId),
        acrValues: payload.acrValues,
        signOutRedirectUri: payload.signOutRedirectUri,
        state: payload.state,
        nonce: payload.nonce,
        uiLocales: payload.uiLocales,
        refreshThreshold: payload.refreshThreshold,
        loginHint: payload.loginHint,
        display: payload.display,
        prompt: payload.prompt,
        additionalParameters: payload.additionalParameters
      )
    }

    return nil
  }

  /// Resolves OIDC settings from a registered OIDC client handle.
  ///
  /// - Parameter oidcClientId: OIDC client id returned by `@ping-identity/rn-oidc`.
  /// - Returns: Resolved OIDC settings.
  /// - Throws: `JourneyBridgeError.argument` when required values are missing.
  /// - Throws: `JourneyBridgeError.state` when handle resolution fails.
  private func resolveOidcConfigFromHandle(_ oidcClientId: String) async throws -> ResolvedOidcConfig {
    guard let handle = await CoreRuntime.oidcClientRegistry.resolve(oidcClientId) as? OidcClientConfigHandle else {
      throw JourneyBridgeError.argument("OIDC client instance not found for id=\(oidcClientId)")
    }

    let discoveryEndpoint = handle.discoveryEndpoint?.trimmingCharacters(in: .whitespacesAndNewlines)
    if (discoveryEndpoint == nil || discoveryEndpoint?.isEmpty == true) && handle.openId == nil {
      throw JourneyBridgeError.argument(
        "OIDC client id=\(oidcClientId) does not expose discoveryEndpoint or openId. Configure OIDC with discoveryEndpoint or openId before composing Journey."
      )
    }

    return ResolvedOidcConfig(
      clientId: handle.clientId,
      discoveryEndpoint: discoveryEndpoint,
      redirectUri: handle.redirectUri,
      scopes: handle.scopes,
      openId: handle.openId,
      acrValues: handle.acrValues,
      signOutRedirectUri: handle.signOutRedirectUri,
      state: handle.state,
      nonce: handle.nonce,
      uiLocales: handle.uiLocales,
      refreshThreshold: handle.refreshThreshold,
      loginHint: handle.loginHint,
      display: handle.display,
      prompt: handle.prompt,
      additionalParameters: handle.additionalParameters
    )
  }

  /// Maps parser OpenID payload into shared core OpenID config.
  ///
  /// - Parameter payload: Parser OpenID payload.
  /// - Returns: Shared core OpenID configuration.
  private static func toCoreOpenId(_ payload: JourneyOpenIdPayload) -> OidcOpenIdConfig {
    return OidcOpenIdConfig(
      authorizationEndpoint: payload.authorizationEndpoint,
      tokenEndpoint: payload.tokenEndpoint,
      userinfoEndpoint: payload.userinfoEndpoint,
      endSessionEndpoint: payload.endSessionEndpoint,
      pingEndIdpSessionEndpoint: payload.pingEndIdpSessionEndpoint,
      revocationEndpoint: payload.revocationEndpoint
    )
  }

  /// Builds OpenID configuration for `OidcClientConfig`.
  ///
  /// - Parameter openId: Shared OpenID configuration payload.
  /// - Returns: Native OpenID configuration when encoding succeeds.
  private static func buildOpenIdConfiguration(_ openId: OidcOpenIdConfig) -> OpenIdConfiguration? {
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

  /// Builds an OIDC storage delegate from a registered storage id.
  ///
  /// - Parameter storageId: OIDC storage identifier from JS.
  /// - Returns: Storage delegate, or `nil` when no storage id is provided.
  private static func buildOidcStorageDelegate(_ storageId: String?) async -> StorageDelegate<Token>? {
    guard let storageId, !storageId.isEmpty else {
      return nil
    }
    guard let config = await resolveStorageConfigFromCore(
      storageId: storageId,
      registry: CoreRuntime.oidcStorageConfigRegistry
    ) else {
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

  /// Builds a session storage delegate from a registered storage id.
  ///
  /// - Parameter storageId: Session storage identifier from JS.
  /// - Returns: Session storage delegate, or `nil` when no storage id is provided.
  private static func buildSessionStorageDelegate(_ storageId: String?) async -> (any Storage<SSOTokenImpl>)? {
    guard let storageId, !storageId.isEmpty else {
      return nil
    }
    guard let config = await resolveStorageConfigFromCore(
      storageId: storageId,
      registry: CoreRuntime.sessionStorageConfigRegistry
    ) else {
      return nil
    }
    let account = config.account ?? "com.pingidentity.rnsampleapp.keyalias"
    let encryptorEnabled = config.encryptor ?? true
    let encryptor: Encryptor = {
      if encryptorEnabled, let secured = SecuredKeyEncryptor() {
        return secured
      }
      return NoEncryptor()
    }()
    return KeychainStorage<SSOTokenImpl>(
      account: account,
      encryptor: encryptor,
      cacheStrategy: parseCacheStrategy(cacheable: config.cacheable, rawStrategy: nil)
    )
  }

  /// Resolves storage configuration from a Core registry by id.
  ///
  /// - Parameters:
  ///   - storageId: Storage identifier from JS.
  ///   - registry: Target Core storage registry.
  /// - Returns: Storage handle contract payload, or `nil`.
  private static func resolveStorageConfigFromCore(
    storageId: String,
    registry: Registry
  ) async -> StorageConfigHandleContract? {
    return await registry.resolve(storageId) as? StorageConfigHandleContract
  }

  /// Maps storage config payload values to PingStorage cache strategy.
  ///
  /// Supports both the current `cacheable` boolean and future `cacheStrategy` string.
  ///
  /// - Parameters:
  ///   - cacheable: Storage cacheable flag.
  ///   - rawStrategy: Optional explicit cache strategy string.
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

  /// Converts JS timeout milliseconds into Journey timeout seconds.
  ///
  /// - Parameter timeoutMs: Timeout in milliseconds.
  /// - Returns: Timeout in seconds for PingJourney configuration.
  private static func timeoutSeconds(from timeoutMs: Int64?) -> TimeInterval? {
    guard let timeoutMs else {
      return nil
    }
    if timeoutMs <= 0 {
      return nil
    }
    return max(1, ceil(Double(timeoutMs) / 1000.0))
  }
}
