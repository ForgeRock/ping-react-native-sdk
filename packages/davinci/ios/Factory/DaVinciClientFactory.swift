/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingDavinci
import PingLogger
import PingOidc
import PingStorage
import RNPingCore
#if canImport(PingOneProtect)
import PingOneProtect
#endif

/// Builds native DaVinci workflow instances from parsed JS payloads.
final class DaVinciClientFactory {
  /// Resolved OIDC configuration used to construct the native OIDC module.
  private struct ResolvedOidcConfig: Sendable {
    let discoveryEndpoint: String
    let clientId: String
    let redirectUri: String
    let par: Bool?
    let scopes: [String]
    let storageId: String?
    let signOutRedirectUri: String?
    let loginHint: String?
    let nonce: String?
    let state: String?
    let prompt: String?
    let display: String?
    let uiLocales: String?
    let acrValues: String?
    let refreshThreshold: Int64?
    let additionalParameters: [String: String]
  }

  /// Builds a DaVinci workflow from parsed configuration.
  ///
  /// - Parameter payload: Parsed DaVinci payload.
  /// - Returns: Configured native DaVinci instance.
  /// - Throws: `DaVinciBridgeError.argument` when shared registries cannot resolve handles.
  func build(_ payload: DaVinciClientPayload) async throws -> DaVinci {
    let resolvedLogger = await resolveLoggerFromCore(payload.loggerId)
    let resolvedOidcConfig = resolveOidcConfig(payload)
    let oidcStorage = try await Self.buildOidcStorageDelegate(resolvedOidcConfig.storageId)

    return DaVinci.createDaVinci { config in
      if let resolvedLogger {
        config.logger = resolvedLogger
      }
      if let timeoutSeconds = Self.timeoutSeconds(from: payload.timeout) {
        config.timeout = timeoutSeconds
      }

      config.module(PingDavinci.OidcModule.config) { oidcConfig in
        oidcConfig.discoveryEndpoint = resolvedOidcConfig.discoveryEndpoint
        oidcConfig.clientId = resolvedOidcConfig.clientId
        oidcConfig.redirectUri = resolvedOidcConfig.redirectUri
        if let par = resolvedOidcConfig.par {
          oidcConfig.par = par
        }
        oidcConfig.scopes = Set(resolvedOidcConfig.scopes)

        if let loginHint = resolvedOidcConfig.loginHint {
          oidcConfig.loginHint = loginHint
        }
        if let nonce = resolvedOidcConfig.nonce {
          oidcConfig.nonce = nonce
        }
        if let state = resolvedOidcConfig.state {
          oidcConfig.state = state
        }
        if let prompt = resolvedOidcConfig.prompt {
          oidcConfig.prompt = prompt
        }
        if let display = resolvedOidcConfig.display {
          oidcConfig.display = display
        }
        if let uiLocales = resolvedOidcConfig.uiLocales {
          oidcConfig.uiLocales = uiLocales
        }
        if let acrValues = resolvedOidcConfig.acrValues {
          oidcConfig.acrValues = acrValues
        }
        if let refreshThreshold = resolvedOidcConfig.refreshThreshold {
          oidcConfig.refreshThreshold = refreshThreshold
        }
        if !resolvedOidcConfig.additionalParameters.isEmpty {
          oidcConfig.additionalParameters = resolvedOidcConfig.additionalParameters
        }
        if let oidcStorage {
          oidcConfig.storage = oidcStorage
        }
        if resolvedOidcConfig.signOutRedirectUri != nil {
          // TODO-SDK-PARITY: OidcClientConfig currently does not expose
          // `signOutRedirectUri` on iOS. Android supports this field.
        }
      }

      #if canImport(PingOneProtect)
      if let protect = payload.protect {
        config.module(ProtectLifecycleModule.config) { protectConfig in
          protectConfig.envId = protect.envId
          protectConfig.isBehavioralDataCollection = protect.isBehavioralDataCollection
          protectConfig.isLazyMetadata = protect.isLazyMetadata
          if let customHost = protect.customHost {
            protectConfig.customHost = customHost
          }
          protectConfig.isConsoleLogEnabled = protect.isConsoleLogEnabled
          if !protect.deviceAttributesToIgnore.isEmpty {
            protectConfig.deviceAttributesToIgnore = protect.deviceAttributesToIgnore
          }
          protectConfig.pauseBehavioralDataOnSuccess = protect.pauseBehavioralDataOnSuccess
          protectConfig.resumeBehavioralDataOnStart = protect.resumeBehavioralDataOnStart
        }
      }
      #endif
    }
  }

  /// Resolves the direct OIDC configuration for native module construction.
  ///
  /// - Parameter payload: Parsed DaVinci payload.
  /// - Returns: Resolved DaVinci OIDC configuration.
  private func resolveOidcConfig(_ payload: DaVinciClientPayload) -> ResolvedOidcConfig {
    let oidc = payload.oidc
    return ResolvedOidcConfig(
      discoveryEndpoint: oidc.discoveryEndpoint,
      clientId: oidc.clientId,
      redirectUri: oidc.redirectUri,
      par: oidc.par,
      scopes: oidc.scopes,
      storageId: oidc.storageId,
      signOutRedirectUri: oidc.signOutRedirectUri,
      loginHint: oidc.loginHint,
      nonce: oidc.nonce,
      state: oidc.state,
      prompt: oidc.prompt,
      display: oidc.display,
      uiLocales: oidc.uiLocales,
      acrValues: oidc.acrValues,
      refreshThreshold: oidc.refreshThreshold,
      additionalParameters: oidc.additionalParameters
    )
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
    return handle.nativeLogger as? Logger
  }

  /// Builds an OIDC storage delegate from a registered storage id.
  ///
  /// - Parameter storageId: OIDC storage identifier from JS.
  /// - Returns: Storage delegate, or `nil` when no storage id is provided.
  /// - Throws: `DaVinciBridgeError.argument` when a provided id cannot be resolved.
  private static func buildOidcStorageDelegate(_ storageId: String?) async throws -> StorageDelegate<Token>? {
    guard let storageId, !storageId.isEmpty else {
      return nil
    }
    guard let config = await CoreRuntime.oidcStorageConfigRegistry.resolve(storageId) as? StorageConfigHandleContract else {
      throw DaVinciBridgeError.argument("No OIDC storage config registered for id=\(storageId)")
    }
    let account = config.account ?? "com.pingidentity.rndavinci.storage"
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

  /// Converts JS timeout milliseconds into DaVinci timeout seconds.
  ///
  /// - Parameter timeoutMs: Timeout in milliseconds.
  /// - Returns: Timeout in seconds for DaVinci configuration.
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
