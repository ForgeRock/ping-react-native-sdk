//
//  RNPingOidcCommon.swift
//  RNPingOidc
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation
import AuthenticationServices
import PingBrowser
import PingOidc
import PingOrchestrate
import RNPingCore

/// Common iOS implementation for the Ping OIDC React Native module.
@available(iOS 16.0.0, *)
@objcMembers
public class RNPingOidcCommon: NSObject {

  // MARK: - Debug logging

  private static func describeError(_ error: Error) -> String {
    let nsError = error as NSError
    let domain = nsError.domain
    let code = nsError.code
    let description = nsError.localizedDescription
    let userInfo = nsError.userInfo
    return "domain=\(domain) code=\(code) description=\(description) userInfo=\(userInfo)"
  }

  // MARK: - Registries

  /// Dedicated registry for OIDC clients.
  private static let clientRegistry: Registry = SimpleRegistry()
  /// Dedicated registry for OIDC web clients.
  private static let webRegistry: Registry = SimpleRegistry()

  /// Specific key for identifying the create queue.
  private static let createQueueKey = DispatchSpecificKey<Void>()
  /// Serial queue for synchronous creation calls.
  private static let createQueue: DispatchQueue = {
    let q = DispatchQueue(label: "com.ping.oidc.create", qos: .userInitiated)
    q.setSpecific(key: createQueueKey, value: ())
    return q
  }()

  // MARK: - Create

  /// Create an OIDC client from JavaScript configuration.
  ///
  /// - Parameter config: JS client configuration payload.
  /// - Returns: Registered client identifier.
  @objc
  public static func createClient(_ config: NSDictionary) -> String {
    return createQueue.sync {
      precondition(
        DispatchQueue.getSpecific(key: createQueueKey) != nil,
        "RNPingOidcCommon.createClient must be called on createQueue"
      )
      do {
        let payload = try OidcConfigParser.parseClientConfig(config)
        let oidcConfig = OidcClientFactory.buildOidcClient(payload)
        let client = OidcClient(config: oidcConfig)
        let user = OidcUser(config: oidcConfig)
        let handle = OidcClientHandle(payload: payload, client: client, user: user)
        let id = RegistrySync.registerSync(
          handle,
          registry: clientRegistry,
          queueKey: createQueueKey,
          context: "RNPingOidcCommon.createClient"
        )
        return id
      } catch {
        NSException(
          name: .invalidArgumentException,
          reason: "Invalid OIDC client config: \(error.localizedDescription)",
          userInfo: nil
        ).raise()
        return ""
      }
    }
  }

  /// Create an OIDC web client from an existing client handle.
  ///
  /// - Parameter clientId: Identifier returned by `createClient`.
  /// - Returns: Registered web client identifier.
  @objc
  public static func createWebClient(_ clientId: String) -> String {
    return createQueue.sync {
      precondition(
        DispatchQueue.getSpecific(key: createQueueKey) != nil,
        "RNPingOidcCommon.createWebClient must be called on createQueue"
      )
      guard let handle = RegistrySync.resolveSync(
        clientId,
        registry: clientRegistry,
        queueKey: createQueueKey,
        context: "RNPingOidcCommon.createWebClient"
      ) as? OidcClientHandle else {
        NSException(
          name: .invalidArgumentException,
          reason: "No OIDC client found for id \(clientId)",
          userInfo: nil
        ).raise()
        return ""
      }

      let web = OidcClientFactory.buildWebClient(handle.payload)
      let webHandle = OidcWebHandle(clientId: clientId, web: web)
      let id = RegistrySync.registerSync(
        webHandle,
        registry: webRegistry,
        queueKey: createQueueKey,
        context: "RNPingOidcCommon.createWebClient"
      )
      return id
    }
  }

  // MARK: - Client Operations

  /// Retrieve tokens for the current client.
  ///
  /// - Parameters:
  ///   - clientId: Identifier returned by `createClient`.
  ///   - resolver: Resolver called with token payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  @objc
  public static func clientToken(
    _ clientId: String,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let handle = await RegistrySync.resolve(clientId, registry: clientRegistry) as? OidcClientHandle else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.tokenError.rawValue,
          message: "No OIDC client found for id \(clientId)"
        )
        reject(error, rejecter: rejecter)
        return
      }

      let result = await handle.user.token()
      switch result {
      case .success(let token):
        resolver(OidcResponseMapper.encodeTokens(token))
      case .failure(let error):
        reject(OidcErrorMapper.mapOidcError(error, code: .tokenError), rejecter: rejecter)
      }
    }
  }

  /// Refresh tokens for the current client.
  ///
  /// - Parameters:
  ///   - clientId: Identifier returned by `createClient`.
  ///   - resolver: Resolver called with token payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  @objc
  public static func clientRefresh(
    _ clientId: String,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let handle = await RegistrySync.resolve(clientId, registry: clientRegistry) as? OidcClientHandle else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.refreshError.rawValue,
          message: "No OIDC client found for id \(clientId)"
        )
        reject(error, rejecter: rejecter)
        return
      }

      let result = await handle.user.refresh()
      switch result {
      case .success(let token):
        resolver(OidcResponseMapper.encodeTokens(token))
      case .failure(let error):
        reject(OidcErrorMapper.mapOidcError(error, code: .refreshError), rejecter: rejecter)
      }
    }
  }

  /// Fetch userinfo for the current client.
  ///
  /// - Parameters:
  ///   - clientId: Identifier returned by `createClient`.
  ///   - cache: Whether to use cached userinfo when available.
  ///   - resolver: Resolver called with userinfo payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  @objc
  public static func clientUserinfo(
    _ clientId: String,
    cache: Bool,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let handle = await RegistrySync.resolve(clientId, registry: clientRegistry) as? OidcClientHandle else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.userinfoError.rawValue,
          message: "No OIDC client found for id \(clientId)"
        )
        reject(error, rejecter: rejecter)
        return
      }

      let result = await handle.user.userinfo(cache: cache)
      switch result {
      case .success(let info):
        resolver(OidcResponseMapper.encodeUserinfo(info))
      case .failure(let error):
        reject(OidcErrorMapper.mapOidcError(error, code: .userinfoError), rejecter: rejecter)
      }
    }
  }

  /// Revoke tokens for the current client.
  ///
  /// - Parameters:
  ///   - clientId: Identifier returned by `createClient`.
  ///   - resolver: Resolver called on success.
  ///   - rejecter: Rejecter called with a `GenericError`.
  @objc
  public static func clientRevoke(
    _ clientId: String,
    resolver: @escaping () -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let handle = await RegistrySync.resolve(clientId, registry: clientRegistry) as? OidcClientHandle else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.revokeError.rawValue,
          message: "No OIDC client found for id \(clientId)"
        )
        reject(error, rejecter: rejecter)
        return
      }
      await handle.client.revoke()
      resolver()
    }
  }

  /// End the current client session.
  ///
  /// - Parameters:
  ///   - clientId: Identifier returned by `createClient`.
  ///   - resolver: Resolver called with end-session status.
  ///   - rejecter: Rejecter called with a `GenericError`.
  @objc
  public static func clientEndSession(
    _ clientId: String,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let handle = await RegistrySync.resolve(clientId, registry: clientRegistry) as? OidcClientHandle else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.logoutError.rawValue,
          message: "No OIDC client found for id \(clientId)"
        )
        reject(error, rejecter: rejecter)
        return
      }
      let result = await handle.client.endSession()
      resolver(result)
    }
  }

  // MARK: - Web Operations

  /// Start an OIDC authorization flow.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - options: Per-request authorization overrides.
  ///   - resolver: Resolver called with the authorize result payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  @objc
  public static func authorize(
    _ webClientId: String,
    options: NSDictionary,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task { @MainActor in
      guard let handle = await RegistrySync.resolve(webClientId, registry: webRegistry) as? OidcWebHandle else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.authorizeError.rawValue,
          message: "No OIDC web client found for id \(webClientId)"
        )
        reject(error, rejecter: rejecter)
        return
      }

      do {
        if let clientHandle = await RegistrySync.resolve(handle.clientId, registry: clientRegistry) as? OidcClientHandle {
          let payload = clientHandle.payload
          var openId: [String: Any] = [:]
          if let override = payload.openId {
            openId = [
              "authorizationEndpoint": override.authorizationEndpoint,
              "tokenEndpoint": override.tokenEndpoint,
              "userinfoEndpoint": override.userinfoEndpoint,
              "endSessionEndpoint": override.endSessionEndpoint ?? "",
              "revocationEndpoint": override.revocationEndpoint ?? "",
              "pingEndIdpSessionEndpoint": override.pingEndIdpSessionEndpoint ?? ""
            ]
          }
          let configPayload: [String: Any] = [
            "clientId": payload.clientId,
            "discoveryEndpoint": payload.discoveryEndpoint ?? "",
            "redirectUri": payload.redirectUri,
            "scopes": payload.scopes,
            "storageId": payload.storageId ?? "",
            "loggerId": payload.loggerId ?? "",
            "ios": [
              "browserType": payload.browserType ?? "",
              "browserMode": payload.browserMode ?? ""
            ],
            "acrValues": payload.acrValues ?? "",
            "signOutRedirectUri": payload.signOutRedirectUri ?? "",
            "state": payload.state ?? "",
            "nonce": payload.nonce ?? "",
            "uiLocales": payload.uiLocales ?? "",
            "refreshThreshold": payload.refreshThreshold as Any,
            "loginHint": payload.loginHint ?? "",
            "display": payload.display ?? "",
            "prompt": payload.prompt ?? "",
            "additionalParameters": payload.additionalParameters,
            "openId": openId
          ]
      }
        let params = OidcConfigParser.buildAuthorizeParams(from: options)
        let result = try await handle.web.authorize { config in
          config.additionalParameters = params
        }
        switch result {
        case .success:
          resolver(["type": "success"])
        case .failure(let error):
        reject(OidcErrorMapper.mapOidcError(error, code: .authorizeError), rejecter: rejecter)
        }
      } catch let error as BrowserError {
        if case .externalUserAgentCancelled = error {
          resolver(["type": "cancel"])
        } else {
          let mapped = GenericError(
            type: .internalError,
            error: OidcErrorCodes.authorizeError.rawValue,
            message: error.localizedDescription
          )
          reject(mapped, rejecter: rejecter, underlyingError: error as NSError)
        }
      } catch let error as ASWebAuthenticationSessionError {
        if error.code == .canceledLogin {
          resolver(["type": "cancel"])
        } else {
          let mapped = GenericError(
            type: .internalError,
            error: OidcErrorCodes.authorizeError.rawValue,
            message: error.localizedDescription,
            code: error.code.rawValue
          )
          reject(mapped, rejecter: rejecter, underlyingError: error as NSError)
        }
      } catch {
      reject(OidcErrorMapper.mapAuthorizeThrowable(error), rejecter: rejecter, underlyingError: error as NSError)
      }
    }
  }

  /// Check whether a user is available for the given client.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - resolver: Resolver called with a boolean result.
  ///   - rejecter: Rejecter called with a `GenericError`.
  @objc
  public static func hasUser(
    _ webClientId: String,
    resolver: @escaping (Bool) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let handle = await RegistrySync.resolve(webClientId, registry: webRegistry) as? OidcWebHandle else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.hasUserError.rawValue,
          message: "No OIDC web client found for id \(webClientId)"
        )
        reject(error, rejecter: rejecter)
        return
      }

      let user = await handle.web.user()
      if let user = user {
      } else {
      }
      let hasActiveSession: Bool
      if let sessionUser = user as? Session {
        hasActiveSession = !sessionUser.value.isEmpty
      } else {
        hasActiveSession = false
      }
      resolver(hasActiveSession)
    }
  }

  /// Retrieve tokens for the current user.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - resolver: Resolver called with token payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  @objc
  public static func token(
    _ webClientId: String,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let handle = await RegistrySync.resolve(webClientId, registry: webRegistry) as? OidcWebHandle else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.tokenError.rawValue,
          message: "No OIDC web client found for id \(webClientId)"
        )
        reject(error, rejecter: rejecter)
        return
      }

      guard let user = await handle.web.user() else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.tokenError.rawValue,
          message: "No authenticated user is available for this OIDC web client"
        )
        reject(error, rejecter: rejecter)
        return
      }

      let result = await user.token()
      switch result {
      case .success(let token):
        resolver(OidcResponseMapper.encodeTokens(token))
      case .failure(let error):
        reject(OidcErrorMapper.mapOidcError(error, code: .tokenError), rejecter: rejecter)
      }
    }
  }

  /// Refresh tokens for the current user.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - resolver: Resolver called with token payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  @objc
  public static func refresh(
    _ webClientId: String,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let handle = await RegistrySync.resolve(webClientId, registry: webRegistry) as? OidcWebHandle else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.refreshError.rawValue,
          message: "No OIDC web client found for id \(webClientId)"
        )
        reject(error, rejecter: rejecter)
        return
      }

      guard let user = await handle.web.user() else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.refreshError.rawValue,
          message: "No authenticated user is available for this OIDC web client"
        )
        reject(error, rejecter: rejecter)
        return
      }

      let result = await user.refresh()
      switch result {
      case .success(let token):
        resolver(OidcResponseMapper.encodeTokens(token))
      case .failure(let error):
        reject(OidcErrorMapper.mapOidcError(error, code: .refreshError), rejecter: rejecter)
      }
    }
  }

  /// Fetch user profile data from the userinfo endpoint.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - cache: Whether to use cached userinfo when available.
  ///   - resolver: Resolver called with userinfo payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  @objc
  public static func userinfo(
    _ webClientId: String,
    cache: Bool,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let handle = await RegistrySync.resolve(webClientId, registry: webRegistry) as? OidcWebHandle else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.userinfoError.rawValue,
          message: "No OIDC web client found for id \(webClientId)"
        )
        reject(error, rejecter: rejecter)
        return
      }

      guard let user = await handle.web.user() else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.userinfoError.rawValue,
          message: "No authenticated user is available for this OIDC web client"
        )
        reject(error, rejecter: rejecter)
        return
      }

      let result = await user.userinfo(cache: cache)
      switch result {
      case .success(let info):
        resolver(OidcResponseMapper.encodeUserinfo(info))
      case .failure(let error):
        reject(OidcErrorMapper.mapOidcError(error, code: .userinfoError), rejecter: rejecter)
      }
    }
  }

  /// Revoke tokens for the current user.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - resolver: Resolver called on success.
  ///   - rejecter: Rejecter called with a `GenericError`.
  @objc
  public static func revoke(
    _ webClientId: String,
    resolver: @escaping () -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let handle = await RegistrySync.resolve(webClientId, registry: webRegistry) as? OidcWebHandle else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.revokeError.rawValue,
          message: "No OIDC web client found for id \(webClientId)"
        )
        reject(error, rejecter: rejecter)
        return
      }

      guard let user = await handle.web.user() else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.revokeError.rawValue,
          message: "No authenticated user is available for this OIDC web client"
        )
        reject(error, rejecter: rejecter)
        return
      }

      await user.revoke()
      resolver()
    }
  }

  /// Logout the current user.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - resolver: Resolver called on success.
  ///   - rejecter: Rejecter called with a `GenericError`.
  @objc
  public static func logout(
    _ webClientId: String,
    resolver: @escaping () -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    Task {
      guard let handle = await RegistrySync.resolve(webClientId, registry: webRegistry) as? OidcWebHandle else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.logoutError.rawValue,
          message: "No OIDC web client found for id \(webClientId)"
        )
        reject(error, rejecter: rejecter)
        return
      }

      guard let user = await handle.web.user() else {
        let error = GenericError(
          type: .stateError,
          error: OidcErrorCodes.logoutError.rawValue,
          message: "No authenticated user is available for this OIDC web client"
        )
        reject(error, rejecter: rejecter)
        return
      }

      await user.logout()
      resolver()
    }
  }

}
