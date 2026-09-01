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
import PingLogger
import RNPingCore

/// Common iOS implementation for the Ping OIDC React Native module.
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

  /// Shared core registry for OIDC clients.
  private static let clientRegistry: Registry = CoreRuntime.oidcClientRegistry
  /// Shared core registry for OIDC web clients.
  private static let webRegistry: Registry = CoreRuntime.oidcWebClientRegistry
  private static let deviceRegistry: Registry = SimpleRegistry()
  private static let deviceTasks = DeviceTaskStore()

  /// Specific key for identifying the create queue.
  private static let createQueueKey = DispatchSpecificKey<Void>()
  /// Serial queue for synchronous creation calls.
  private static let createQueue: DispatchQueue = {
    let q = DispatchQueue(label: "com.ping.oidc.create", qos: .userInitiated)
    q.setSpecific(key: createQueueKey, value: ())
    return q
  }()

  /// Resolve a native logger from the shared Core logger registry.
  ///
  /// - Parameter loggerId: Logger handle identifier from JS.
  /// - Returns: Native logger instance, or nil when missing/invalid.
  private static func resolveLoggerFromCoreSync(_ loggerId: String?) -> Logger? {
    guard let loggerId, !loggerId.isEmpty else {
      return nil
    }

    guard let handle = RegistrySync.resolveSync(
      loggerId,
      registry: CoreRuntime.loggerRegistry,
      queueKey: createQueueKey,
      context: "RNPingOidcCommon.resolveLoggerFromCoreSync"
    ) as? LoggerHandleContract else {
      return nil
    }
    return handle.nativeLogger as? Logger
  }

  // MARK: - Cleanup

  /// Clear stored native OIDC clients and web clients.
  ///
  /// - Note: Invoked when the React Native bridge is invalidated to prevent
  ///   leaking native instances across reloads.
  @objc
  public static func cleanup() {
    Task { await deviceTasks.cancelAll() }
    Task {
      await clientRegistry.removeAll()
      await webRegistry.removeAll()
      await deviceRegistry.removeAll()
    }
  }

  // MARK: - Create

  /// Create an OIDC client from JavaScript configuration.
  ///
  /// - Parameter config: JS client configuration payload.
  /// - Returns: Registered client identifier.
  /// - Note: Raises an Objective-C exception when configuration is invalid.
  @objc
  public static func createClient(_ config: NSDictionary) -> String {
    return createQueue.sync {
      precondition(
        DispatchQueue.getSpecific(key: createQueueKey) != nil,
        "RNPingOidcCommon.createClient must be called on createQueue"
      )
      do {
        let payload = try OidcConfigParser.parseClientConfig(config)
        let logger = resolveLoggerFromCoreSync(payload.loggerId)
        let oidcConfig = OidcClientFactory.buildOidcClient(
          payload,
          logger: logger,
          queueKey: createQueueKey
        )
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

  /// Create an OIDC device client from JavaScript configuration.
  @objc
  public static func createOidcDeviceClient(_ config: NSDictionary) -> String {
    return createQueue.sync {
      do {
        let payload = try OidcConfigParser.parseClientConfig(config)
        let logger = resolveLoggerFromCoreSync(payload.loggerId)
        let oidcConfig = OidcClientFactory.buildOidcClient(payload, logger: logger, queueKey: createQueueKey)
        let client = OidcDeviceClient(config: oidcConfig)
        let handle = OidcDeviceHandle(payload: payload, client: client)
        return RegistrySync.registerSync(
          handle,
          registry: deviceRegistry,
          queueKey: createQueueKey,
          context: "RNPingOidcCommon.createOidcDeviceClient"
        )
      } catch {
        NSException(name: .invalidArgumentException, reason: "Invalid OIDC device client config: \(error.localizedDescription)", userInfo: nil).raise()
        return ""
      }
    }
  }

  /// Start an OIDC device authorization stream.
  @objc
  public static func deviceAuthorize(
    _ deviceClientId: String,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    Task {
      guard let handle = await RegistrySync.resolve(deviceClientId, registry: deviceRegistry) as? OidcDeviceHandle else {
        reject(GenericError(type: .stateError, error: OidcErrorCodes.authorizeError.rawValue, message: "No OIDC device client found for id \(deviceClientId)"), rejecter: rejecter)
        return
      }
      let subscriptionId = UUID().uuidString
      let task = Task { [deviceClientId, subscriptionId, handle] in
        do {
          let stream = try await handle.client.deviceAuthorization()
          for try await status in stream {
            emitDeviceStatus(deviceClientId: deviceClientId, subscriptionId: subscriptionId, status: status)
          }
        } catch is CancellationError {
          return
        } catch {
          emitDeviceStatus(deviceClientId: deviceClientId, subscriptionId: subscriptionId, status: .failure(error))
        }
        await deviceTasks.remove(subscriptionId)
      }
      await deviceTasks.set(task, for: subscriptionId)
      resolver(["subscriptionId": subscriptionId])
    }
  }

  @objc
  public static func cancelDeviceAuthorization(_ deviceClientId: String, subscriptionId: String, resolver: @escaping @Sendable () -> Void, rejecter: @escaping @Sendable (String, String, NSError?) -> Void) {
    Task { (await deviceTasks.remove(subscriptionId))?.cancel() }
    resolver()
  }

  /// Open a device authorization verification URL in the on-device browser.
  ///
  /// Delegates to the native SDK's `OidcDeviceClient.authorize(verificationUriComplete:)`
  /// which presents the URL in an `SFSafariViewController`. Dismissing the browser
  /// resolves with a `cancel` result; the authorization polling loop continues
  /// independently of this call.
  ///
  /// - Parameters:
  ///   - deviceClientId: Identifier returned by `createOidcDeviceClient`.
  ///   - verificationUri: Verification URI (prefer `verification_uri_complete`).
  ///   - resolver: Resolver called with a `success`/`cancel` payload.
  ///   - rejecter: Rejecter called with a `GenericError`.
  @objc
  public static func deviceOpenVerificationUrl(
    _ deviceClientId: String,
    verificationUri: String,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    Task { @MainActor in
      guard let handle = await RegistrySync.resolve(deviceClientId, registry: deviceRegistry) as? OidcDeviceHandle else {
        reject(GenericError(type: .stateError, error: OidcErrorCodes.authorizeError.rawValue, message: "No OIDC device client found for id \(deviceClientId)"), rejecter: rejecter)
        return
      }
      do {
        try await handle.client.authorize(verificationUriComplete: verificationUri)
        resolver(["type": "success"])
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
      } catch {
        reject(OidcErrorMapper.mapAuthorizeThrowable(error), rejecter: rejecter, underlyingError: error as NSError)
      }
    }
  }

  @objc
  public static func deviceHasUser(_ deviceClientId: String, resolver: @escaping @Sendable (Bool) -> Void, rejecter: @escaping @Sendable (String, String, NSError?) -> Void) {
    Task {
      guard let handle = await RegistrySync.resolve(deviceClientId, registry: deviceRegistry) as? OidcDeviceHandle else {
        reject(GenericError(type: .stateError, error: OidcErrorCodes.hasUserError.rawValue, message: "No OIDC device client found for id \(deviceClientId)"), rejecter: rejecter)
        return
      }
      resolver(await handle.client.user() != nil)
    }
  }

  @objc
  public static func disposeOidcDeviceClient(_ deviceClientId: String, resolver: @escaping @Sendable () -> Void, rejecter: @escaping @Sendable (String, String, NSError?) -> Void) {
    Task {
      await deviceRegistry.remove(deviceClientId)
      resolver()
    }
  }

  private static func resolveDeviceUser(_ deviceClientId: String) async -> (any User)? {
    guard let handle = await RegistrySync.resolve(deviceClientId, registry: deviceRegistry) as? OidcDeviceHandle else {
      return nil
    }
    return await handle.client.user()
  }

  @objc
  public static func deviceToken(_ deviceClientId: String, resolver: @escaping @Sendable (NSDictionary) -> Void, rejecter: @escaping @Sendable (String, String, NSError?) -> Void) {
    Task {
      guard let user = await resolveDeviceUser(deviceClientId) else {
        reject(GenericError(type: .stateError, error: OidcErrorCodes.tokenError.rawValue, message: "No authenticated device user is available"), rejecter: rejecter)
        return
      }
      switch await user.token() {
      case .success(let token): resolver(OidcResponseMapper.encodeTokens(token))
      case .failure(let error): reject(OidcErrorMapper.mapOidcError(error, code: .tokenError), rejecter: rejecter)
      }
    }
  }

  @objc
  public static func deviceRefresh(_ deviceClientId: String, resolver: @escaping @Sendable (NSDictionary) -> Void, rejecter: @escaping @Sendable (String, String, NSError?) -> Void) {
    Task {
      guard let user = await resolveDeviceUser(deviceClientId) else {
        reject(GenericError(type: .stateError, error: OidcErrorCodes.refreshError.rawValue, message: "No authenticated device user is available"), rejecter: rejecter)
        return
      }
      switch await user.refresh() {
      case .success(let token): resolver(OidcResponseMapper.encodeTokens(token))
      case .failure(let error): reject(OidcErrorMapper.mapOidcError(error, code: .refreshError), rejecter: rejecter)
      }
    }
  }

  @objc
  public static func deviceUserinfo(_ deviceClientId: String, cache: Bool, resolver: @escaping @Sendable (NSDictionary) -> Void, rejecter: @escaping @Sendable (String, String, NSError?) -> Void) {
    Task {
      guard let user = await resolveDeviceUser(deviceClientId) else {
        reject(GenericError(type: .stateError, error: OidcErrorCodes.userinfoError.rawValue, message: "No authenticated device user is available"), rejecter: rejecter)
        return
      }
      switch await user.userinfo(cache: cache) {
      case .success(let info): resolver(OidcResponseMapper.encodeUserinfo(info))
      case .failure(let error): reject(OidcErrorMapper.mapOidcError(error, code: .userinfoError), rejecter: rejecter)
      }
    }
  }

  @objc
  public static func deviceRevoke(_ deviceClientId: String, resolver: @escaping @Sendable () -> Void, rejecter: @escaping @Sendable (String, String, NSError?) -> Void) {
    Task {
      guard let user = await resolveDeviceUser(deviceClientId) else {
        reject(GenericError(type: .stateError, error: OidcErrorCodes.revokeError.rawValue, message: "No authenticated device user is available"), rejecter: rejecter)
        return
      }
      await user.revoke()
      resolver()
    }
  }

  @objc
  public static func deviceLogout(_ deviceClientId: String, resolver: @escaping @Sendable () -> Void, rejecter: @escaping @Sendable (String, String, NSError?) -> Void) {
    Task {
      guard let user = await resolveDeviceUser(deviceClientId) else {
        reject(GenericError(type: .stateError, error: OidcErrorCodes.logoutError.rawValue, message: "No authenticated device user is available"), rejecter: rejecter)
        return
      }
      await user.logout()
      resolver()
    }
  }

  private static func emitDeviceStatus(deviceClientId: String, subscriptionId: String, status: DeviceFlowStatus) {
    var body: [String: Any] = ["deviceClientId": deviceClientId, "subscriptionId": subscriptionId]
    switch status {
    case .started(let response):
      body["status"] = ["type": "started", "response": ["deviceCode": response.deviceCode, "userCode": response.userCode, "verificationUri": response.verificationUri, "verificationUriComplete": response.verificationUriComplete as Any, "expiresIn": response.expiresIn, "interval": response.interval]]
    case .polling(let pollCount, let pollInterval, let nextPollAt):
      body["status"] = ["type": "polling", "pollCount": pollCount, "pollInterval": pollInterval, "nextPollAt": nextPollAt.timeIntervalSince1970 * 1000]
    case .success:
      body["status"] = ["type": "success"]
    case .expired:
      body["status"] = ["type": "expired"]
    case .accessDenied:
      body["status"] = ["type": "accessDenied"]
    case .failure(let error):
      body["status"] = ["type": "failure", "error": ["message": error.localizedDescription]]
    }
    NotificationCenter.default.post(name: .pingOidcNativeEmit, object: nil, userInfo: ["eventName": RNPingOidcEvents.deviceFlowStatus, "eventBody": body])
  }

  /// Create an OIDC web client from an existing client handle.
  ///
  /// - Parameter clientId: Identifier returned by `createClient`.
  /// - Returns: Registered web client identifier.
  /// - Note: Raises an Objective-C exception when the client id is unknown.
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

      let logger = resolveLoggerFromCoreSync(handle.payload.loggerId)
      let web = OidcClientFactory.buildWebClient(
        handle.payload,
        logger: logger,
        queueKey: createQueueKey
      )
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
  /// - Returns: Void.
  @objc
  public static func clientToken(
    _ clientId: String,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
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
  /// - Returns: Void.
  @objc
  public static func clientRefresh(
    _ clientId: String,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
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
  /// - Returns: Void.
  @objc
  public static func clientUserinfo(
    _ clientId: String,
    cache: Bool,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
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
  /// - Returns: Void.
  @objc
  public static func clientRevoke(
    _ clientId: String,
    resolver: @escaping @Sendable () -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
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
  /// - Returns: Void.
  @objc
  public static func clientEndSession(
    _ clientId: String,
    resolver: @escaping @Sendable (Bool) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
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
  /// - Returns: Void.
  @objc
  public static func authorize(
    _ webClientId: String,
    options: NSDictionary,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    let params = OidcConfigParser.buildAuthorizeParams(from: options)
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

      // NOTE(SDKS-5295): PingOidc/PingBrowser 2.1.0's OidcWebClient.authorize()
      // collapses every FailureNode.cause (including browser cancellation) into
      // OidcError.unknown(message:) before returning it via `result`, discarding
      // the typed BrowserError/ASWebAuthenticationSessionError. Because
      // handle.web.authorize returns a Result rather than throwing on
      // cancellation, the `catch let error as BrowserError` /
      // `catch let error as ASWebAuthenticationSessionError` blocks below are
      // dead code in the normal cancel flow — they only fire if authorize()
      // itself throws before start() runs. Once the upstream fix preserves the
      // typed cause, revisit whether cancellation detection should move into
      // the `.failure(let error)` branch above instead.
      do {
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
  /// - Returns: Void.
  @objc
  public static func hasUser(
    _ webClientId: String,
    resolver: @escaping @Sendable (Bool) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
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
      var hasActiveSession = false
      if let sessionUser = user as? Session {
        hasActiveSession = !sessionUser.value.isEmpty
      }

      if !hasActiveSession,
         let clientHandle = await RegistrySync.resolve(handle.clientId, registry: clientRegistry) as? OidcClientHandle {
        let tokenResult = await clientHandle.user.token()
        if case .success = tokenResult {
          hasActiveSession = true
        }
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
  /// - Returns: Void.
  @objc
  public static func token(
    _ webClientId: String,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
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

      var resolvedUser = await handle.web.user()
      if resolvedUser == nil,
         let clientHandle = await RegistrySync.resolve(handle.clientId, registry: clientRegistry) as? OidcClientHandle {
        resolvedUser = clientHandle.user
      }

      guard let user = resolvedUser else {
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
  /// - Returns: Void.
  @objc
  public static func refresh(
    _ webClientId: String,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
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

      var resolvedUser = await handle.web.user()
      if resolvedUser == nil,
         let clientHandle = await RegistrySync.resolve(handle.clientId, registry: clientRegistry) as? OidcClientHandle {
        resolvedUser = clientHandle.user
      }

      guard let user = resolvedUser else {
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
  /// - Returns: Void.
  @objc
  public static func userinfo(
    _ webClientId: String,
    cache: Bool,
    resolver: @escaping @Sendable (NSDictionary) -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
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

      var resolvedUser = await handle.web.user()
      if resolvedUser == nil,
         let clientHandle = await RegistrySync.resolve(handle.clientId, registry: clientRegistry) as? OidcClientHandle {
        resolvedUser = clientHandle.user
      }

      guard let user = resolvedUser else {
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
  /// - Returns: Void.
  @objc
  public static func revoke(
    _ webClientId: String,
    resolver: @escaping @Sendable () -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
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

      var resolvedUser = await handle.web.user()
      if resolvedUser == nil,
         let clientHandle = await RegistrySync.resolve(handle.clientId, registry: clientRegistry) as? OidcClientHandle {
        resolvedUser = clientHandle.user
      }

      guard let user = resolvedUser else {
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
  /// - Returns: Void.
  @objc
  public static func logout(
    _ webClientId: String,
    resolver: @escaping @Sendable () -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
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

      var resolvedUser = await handle.web.user()
      if resolvedUser == nil,
         let clientHandle = await RegistrySync.resolve(handle.clientId, registry: clientRegistry) as? OidcClientHandle {
        resolvedUser = clientHandle.user
      }

      guard let user = resolvedUser else {
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

  // MARK: - Dispose

  /// Remove an OIDC client from CoreRuntime registries.
  ///
  /// - Parameters:
  ///   - clientId: Identifier returned by `createClient`.
  ///   - resolver: Called on success.
  ///   - rejecter: Called on failure.
  @objc
  public static func disposeClient(
    _ clientId: String,
    resolver: @escaping @Sendable () -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    Task {
      await clientRegistry.remove(clientId)
      resolver()
    }
  }

  /// Remove an OIDC web client from CoreRuntime registries.
  ///
  /// - Parameters:
  ///   - webClientId: Identifier returned by `createWebClient`.
  ///   - resolver: Called on success.
  ///   - rejecter: Called on failure.
  @objc
  public static func disposeWebClient(
    _ webClientId: String,
    resolver: @escaping @Sendable () -> Void,
    rejecter: @escaping @Sendable (String, String, NSError?) -> Void
  ) {
    Task {
      await webRegistry.remove(webClientId)
      resolver()
    }
  }

}
