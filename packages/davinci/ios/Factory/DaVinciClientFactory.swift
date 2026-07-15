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

/// Builds native DaVinci workflow instances from parsed JS payloads.
final class DaVinciClientFactory {
  /// Builds a DaVinci workflow from parsed configuration.
  ///
  /// - Parameter payload: Parsed DaVinci payload.
  /// - Returns: Configured native DaVinci instance.
  /// - Throws: `DaVinciBridgeError.argument` when shared registries cannot resolve handles.
  func build(_ payload: DaVinciClientPayload) async throws -> DaVinci {
    let resolvedLogger = await resolveLoggerFromCore(payload.loggerId)
    let oidcStorage = try await Self.buildOidcStorageDelegate(payload.storageId)

    return DaVinci.createDaVinci { config in
      if let resolvedLogger {
        config.logger = resolvedLogger
      }
      if let timeoutSeconds = Self.timeoutSeconds(from: payload.timeout) {
        config.timeout = timeoutSeconds
      }

      config.module(PingDavinci.OidcModule.config) { oidcConfig in
        oidcConfig.discoveryEndpoint = payload.discoveryEndpoint
        oidcConfig.clientId = payload.clientId
        oidcConfig.redirectUri = payload.redirectUri
        oidcConfig.scopes = Set(payload.scopes)

        if let loginHint = payload.loginHint {
          oidcConfig.loginHint = loginHint
        }
        if let nonce = payload.nonce {
          oidcConfig.nonce = nonce
        }
        if let state = payload.state {
          oidcConfig.state = state
        }
        if let prompt = payload.prompt {
          oidcConfig.prompt = prompt
        }
        if let display = payload.display {
          oidcConfig.display = display
        }
        if let uiLocales = payload.uiLocales {
          oidcConfig.uiLocales = uiLocales
        }
        if let acrValues = payload.acrValues {
          oidcConfig.acrValues = acrValues
        }
        if let refreshThreshold = payload.refreshThreshold {
          oidcConfig.refreshThreshold = refreshThreshold
        }
        if !payload.additionalParameters.isEmpty {
          oidcConfig.additionalParameters = payload.additionalParameters
        }
        if let oidcStorage {
          oidcConfig.storage = oidcStorage
        }
        if payload.signOutRedirectUri != nil {
          // TODO-SDK-PARITY: OidcClientConfig currently does not expose
          // `signOutRedirectUri` on iOS. Android supports this field.
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
