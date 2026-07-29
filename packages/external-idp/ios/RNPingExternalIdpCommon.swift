/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingExternalIdP
import PingLogger
import React
import RNPingCore

/// Per-call External IdP runtime configuration resolved from the JS bridge payload.
struct ExternalIdpCallConfig {
  /// Optional logger handle identifier forwarded from JS.
  let loggerId: String?

  /// Optional app return URI override forwarded from JS.
  let redirectUri: String
}

/// IdP handler decorator that overrides the redirect URI before native authorization starts.
@MainActor
final class RedirectUriOverridingIdpHandler: NSObject, @preconcurrency IdpHandler {
  /// Wrapped native handler for the selected provider.
  private var baseHandler: any IdpHandler

  /// Redirect URI override forwarded from the React Native bridge.
  private let redirectUri: String

  /// Creates a redirect-overriding handler wrapper.
  /// - Parameters:
  ///   - baseHandler: Native provider handler resolved for the selected callback provider.
  ///   - redirectUri: Redirect URI to inject into the `IdpClient`.
  init(baseHandler: any IdpHandler, redirectUri: String) {
    self.baseHandler = baseHandler
    self.redirectUri = redirectUri
    super.init()
  }

  /// Token type exposed by the wrapped provider handler.
  var tokenType: String {
    get {
      baseHandler.tokenType
    }
    set {
      baseHandler.tokenType = newValue
    }
  }

  /// Authorizes the wrapped provider after overriding the `IdpClient.redirectUri`.
  /// - Parameter idpClient: Native client payload created from the Journey callback.
  /// - Returns: The provider authorization result.
  /// - Throws: Any authorization error emitted by the wrapped handler.
  func authorize(idpClient: IdpClient) async throws -> IdpResult {
    var overriddenClient = idpClient
    overriddenClient.redirectUri = redirectUri
    return try await baseHandler.authorize(idpClient: overriddenClient)
  }
}

/// Shared iOS implementation for the Ping External IdP React Native module.
public class RNPingExternalIdpCommon: NSObject {
  private static let loggerIdKey = "loggerId"
  private static let redirectUriKey = "redirectUri"

  /// Stable error codes emitted by the External IdP module.
  ///
  /// Keep these in sync with JS `ExternalIdpErrorCode` and Android `ExternalIdpErrorCodes`.
  private enum ExternalIdpErrorCode: String {
    case authorizeError = "EXTERNAL_IDP_AUTHORIZE_ERROR"
    case cancelled = "EXTERNAL_IDP_CANCELLED"
    case unsupportedProvider = "EXTERNAL_IDP_UNSUPPORTED_PROVIDER"
    case callbackNotFound = "EXTERNAL_IDP_CALLBACK_NOT_FOUND"
    case configError = "EXTERNAL_IDP_CONFIG_ERROR"
    case windowUnavailable = "EXTERNAL_IDP_WINDOW_UNAVAILABLE"
  }

  /// Launches the external IdP authorization flow for an active Journey `IdpCallback`.
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Per-call options payload.
  ///   - config: Per-call runtime configuration payload.
  ///   - resolver: Promise resolver for the authorization result.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public static func authorizeForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let callConfig = parseCallConfig(config)
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    if journeyId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      handlers.reject(
        GenericError(
          type: .argumentError,
          error: ExternalIdpErrorCode.callbackNotFound.rawValue,
          message: "Journey id must not be empty for external IdP authorization."
        )
      )
      return
    }

    guard PresentationAnchorResolver.resolveForegroundWindowAnchor() != nil else {
      handlers.reject(
        GenericError(
          type: .authError,
          error: ExternalIdpErrorCode.windowUnavailable.rawValue,
          message: "No active application window is available for external IdP authorization."
        )
      )
      return
    }

    let callbackIndex = parseCallbackIndex(options)

    // `@objc` methods cannot be declared `async`, so a Task is required to
    // enter the async context. The `@MainActor` annotation is redundant here
    // but kept to make the actor affinity explicit at the call site.
    Task { @MainActor in
      let logger = await resolveLoggerFromCore(callConfig.loggerId)
      logger?.i("External IdP authorizeForJourney requested for callback index \(callbackIndex)")
      guard let callback = await resolveIdpCallback(journeyId: journeyId, index: callbackIndex) else {
        logger?.w("External IdP authorizeForJourney callback not found at index \(callbackIndex)", error: nil)
        handlers.reject(
          GenericError(
            type: .stateError,
            error: ExternalIdpErrorCode.callbackNotFound.rawValue,
            message: "No active IdP callback found for journey \(journeyId) at index \(callbackIndex)."
          )
        )
        return
      }

      let result = await authorizeForJourney(callback: callback, redirectUri: callConfig.redirectUri)
      switch result {
      case .success(let idpResult):
        logger?.d("External IdP authorizeForJourney succeeded")
        handlers.resolve(createAuthorizeResultPayload(idpResult))

      case .failure(let error):
        let mapped = mapIdpError(error)
        logger?.e("External IdP authorizeForJourney failed with code \(mapped.error)", error: error as NSError)
        handlers.reject(
          mapped,
          underlying: error as NSError
        )
      }
    }
  }

  /// Mutates the native `SelectIdpCallback` state for an active Journey.
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - provider: Provider identifier selected by the user.
  ///   - options: Per-call options payload.
  ///   - config: Per-call runtime configuration payload.
  ///   - resolver: Promise resolver for completion.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public static func selectProviderForJourney(
    _ journeyId: String,
    provider: String,
    options: NSDictionary,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let callConfig = parseCallConfig(config)
    let handlers = PromiseBridge<NSNull>(resolver: resolver, rejecter: rejecter)
    if journeyId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      handlers.reject(
        GenericError(
          type: .argumentError,
          error: ExternalIdpErrorCode.callbackNotFound.rawValue,
          message: "Journey id must not be empty for setting selected provider."
        )
      )
      return
    }

    let selectedProvider = provider.trimmingCharacters(in: .whitespacesAndNewlines)
    if selectedProvider.isEmpty {
      handlers.reject(
        GenericError(
          type: .argumentError,
          error: ExternalIdpErrorCode.configError.rawValue,
          message: "Provider must not be empty for external IdP selection."
        )
      )
      return
    }

    let callbackIndex = parseCallbackIndex(options)

    // `@objc` methods cannot be declared `async`, so a Task is required to
    // enter the async context. The `@MainActor` annotation is redundant here
    // but kept to make the actor affinity explicit at the call site.
    Task { @MainActor in
      let logger = await resolveLoggerFromCore(callConfig.loggerId)
      logger?.i("External IdP select provider requested for callback index \(callbackIndex)")
      guard let callback = await resolveSelectIdpCallback(journeyId: journeyId, index: callbackIndex) else {
        logger?.w("External IdP select provider callback not found at index \(callbackIndex)", error: nil)
        handlers.reject(
          GenericError(
            type: .stateError,
            error: ExternalIdpErrorCode.callbackNotFound.rawValue,
            message: "No active SelectIdp callback found for journey \(journeyId) at index \(callbackIndex)."
          )
        )
        return
      }

      callback.value = selectedProvider
      logger?.d("External IdP select provider succeeded")
      handlers.resolve(NSNull())
    }
  }

  /// Launches the external IdP authorization flow for an active DaVinci `IdpCollector`.
  ///
  /// Architecturally different from Journey: the IdP token flows through
  /// `daVinci.next()` via the native `RequestInterceptor`. This method resolves
  /// void — the token is NOT returned to JS.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - options: Per-call options payload.
  ///   - config: Per-call runtime configuration payload.
  ///   - resolver: Promise resolver for void completion.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public static func authorizeForDaVinci(
    _ davinciId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let callConfig = parseCallConfig(config)
    let handlers = PromiseBridge<NSNull>(resolver: resolver, rejecter: rejecter)
    if davinciId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      handlers.reject(
        GenericError(
          type: .argumentError,
          error: ExternalIdpErrorCode.callbackNotFound.rawValue,
          message: "DaVinci id must not be empty for external IdP authorization."
        )
      )
      return
    }

    guard PresentationAnchorResolver.resolveForegroundWindowAnchor() != nil else {
      handlers.reject(
        GenericError(
          type: .authError,
          error: ExternalIdpErrorCode.windowUnavailable.rawValue,
          message: "No active application window is available for external IdP authorization."
        )
      )
      return
    }

    let collectorIndex = parseCallbackIndex(options)

    Task { @MainActor in
      let logger = await resolveLoggerFromCore(callConfig.loggerId)
      logger?.i("External IdP authorizeForDaVinci requested for collector index \(collectorIndex)")

      guard let collectors = await CoreRuntime.resolveDaVinciCollectors(davinciId) else {
        logger?.w("External IdP authorizeForDaVinci collectors not found for davinciId \(davinciId)", error: nil)
        handlers.reject(
          GenericError(
            type: .stateError,
            error: ExternalIdpErrorCode.callbackNotFound.rawValue,
            message: "No active DaVinci collectors found for id \(davinciId)."
          )
        )
        return
      }

      let matching = collectors.compactMap { $0 as? IdpCollector }
      guard collectorIndex >= 0, collectorIndex < matching.count else {
        logger?.w("External IdP authorizeForDaVinci collector not found at index \(collectorIndex)", error: nil)
        handlers.reject(
          GenericError(
            type: .stateError,
            error: ExternalIdpErrorCode.callbackNotFound.rawValue,
            message: "No active IdP collector found for DaVinci \(davinciId) at index \(collectorIndex)."
          )
        )
        return
      }

      let collector = matching[collectorIndex]
      let callbackURLScheme = callConfig.redirectUri.isEmpty ? nil : callConfig.redirectUri
      let result = await collector.authorize(callbackURLScheme: callbackURLScheme)
      switch result {
      case .success:
        logger?.d("External IdP authorizeForDaVinci succeeded")
        handlers.resolve(NSNull())

      case .failure(let error):
        let mapped = mapIdpError(error)
        logger?.e("External IdP authorizeForDaVinci failed with code \(mapped.error)", error: error as NSError)
        handlers.reject(mapped, underlying: error as NSError)
      }
    }
  }

  /// Resolves a native logger from the shared Core logger registry.
  ///
  /// - Parameter loggerId: Logger handle identifier from JS.
  /// - Returns: Native logger instance, or `nil` when missing/invalid.
  private static func resolveLoggerFromCore(_ loggerId: String?) async -> PingLogger.Logger? {
    guard let loggerId, !loggerId.isEmpty else { return nil }
    guard let handle = await CoreRuntime.loggerRegistry.resolve(loggerId) as? LoggerHandleContract else {
      return nil
    }
    return handle.nativeLogger as? PingLogger.Logger
  }

  /// Parses per-call bridge configuration from the React Native payload.
  /// - Parameter config: Raw bridge configuration dictionary.
  /// - Returns: Trimmed call configuration values.
  static func parseCallConfig(_ config: NSDictionary) -> ExternalIdpCallConfig {
    let loggerId = (config[loggerIdKey] as? String)?
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .nilIfEmpty
    let redirectUri = (config[redirectUriKey] as? String)?
      .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return ExternalIdpCallConfig(loggerId: loggerId, redirectUri: redirectUri)
  }

  /// Authorizes a Journey IdP callback, optionally overriding its native redirect URI.
  /// - Parameters:
  ///   - callback: Journey-scoped callback resolved from Core runtime.
  ///   - redirectUri: Optional redirect URI override forwarded from JS.
  /// - Returns: Native authorization result.
  // TODO: Add browser fallback here when the iOS native SDK supports it for AIC Journey flows.
  @MainActor
  static func authorizeForJourney(
    callback: IdpCallback,
    redirectUri: String
  ) async -> Result<IdpResult, IdpExceptions> {
    guard !redirectUri.isEmpty else {
      return await callback.authorize()
    }

    guard let handler = resolveIdpHandler(for: callback.provider) else {
      return .failure(.unsupportedIdpException(message: callback.provider))
    }

    let overridingHandler = RedirectUriOverridingIdpHandler(
      baseHandler: handler,
      redirectUri: redirectUri
    )
    return await callback.authorize(idpHandler: overridingHandler)
  }

  /// Resolves one `IdpCallback` from active Journey callbacks by per-type index.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - index: Per-type callback index.
  /// - Returns: Matching callback when available.
  private static func resolveIdpCallback(journeyId: String, index: Int) async -> IdpCallback? {
    guard let callbacks = await CoreRuntime.resolveJourneyCallbacks(journeyId) else {
      return nil
    }
    let matching = callbacks.compactMap { $0 as? IdpCallback }
    guard index >= 0, index < matching.count else {
      return nil
    }
    return matching[index]
  }

  /// Resolves one `SelectIdpCallback` from active Journey callbacks by per-type index.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - index: Per-type callback index.
  /// - Returns: Matching callback when available.
  private static func resolveSelectIdpCallback(
    journeyId: String,
    index: Int
  ) async -> SelectIdpCallback? {
    guard let callbacks = await CoreRuntime.resolveJourneyCallbacks(journeyId) else {
      return nil
    }
    let matching = callbacks.compactMap { $0 as? SelectIdpCallback }
    guard index >= 0, index < matching.count else {
      return nil
    }
    return matching[index]
  }

  /// Parses callback index from callback execution options.
  ///
  /// - Parameter options: Callback execution options payload.
  /// - Returns: Parsed callback index, defaulting to 0.
  static func parseCallbackIndex(_ options: NSDictionary) -> Int {
    if let value = options["index"] as? NSNumber {
      return value.intValue
    }
    if let value = options["index"] as? String, let parsed = Int(value) {
      return parsed
    }
    return 0
  }

  /// Resolves the default native handler for a Journey `IdpCallback` provider.
  /// - Parameter provider: Provider identifier configured on the callback.
  /// - Returns: Matching native provider handler when available.
  @MainActor
  static func resolveIdpHandler(for provider: String) -> (any IdpHandler)? {
    let lowercasedProvider = provider.lowercased()

    switch true {
    case lowercasedProvider.contains("apple") || lowercasedProvider.contains("siwa"):
      return makeIdpHandler(from: "PingExternalIdPApple.AppleHandler")

    case lowercasedProvider.contains("google"):
      return makeIdpHandler(from: "PingExternalIdPGoogle.GoogleHandler")

    case lowercasedProvider.contains("facebook"):
      return makeIdpHandler(from: "PingExternalIdPFacebook.FacebookHandler")

    default:
      return nil
    }
  }

  /// Instantiates a native provider handler from its Objective-C runtime name.
  /// - Parameter className: Objective-C runtime class name for the provider handler.
  /// - Returns: Initialized handler when the provider SDK is linked.
  @MainActor
  private static func makeIdpHandler(from className: String) -> (any IdpHandler)? {
    guard let handlerClass = NSClassFromString(className) as? (NSObject & IdpHandler).Type else {
      return nil
    }
    return handlerClass.init()
  }

  /// Creates the JS-facing authorize result payload.
  ///
  /// - Parameter result: Native IdP authorization result.
  /// - Returns: Bridge-safe result dictionary.
  static func createAuthorizeResultPayload(_ result: IdpResult) -> NSDictionary {
    var payload: [String: Any] = ["token": result.token]
    if let additionalParameters = result.additionalParameters {
      payload["additionalParameters"] = additionalParameters
    }
    return payload as NSDictionary
  }

  /// Maps native IdP failures to the shared JS error contract.
  ///
  /// - Parameter error: Native IdP exception.
  /// - Returns: Generic bridge error.
  static func mapIdpError(_ error: IdpExceptions) -> GenericError {
    switch error {
    case .idpCanceledException:
      return GenericError(
        type: .authError,
        error: ExternalIdpErrorCode.cancelled.rawValue,
        message: error.localizedDescription
      )

    case .unsupportedIdpException:
      return GenericError(
        type: .authError,
        error: ExternalIdpErrorCode.unsupportedProvider.rawValue,
        message: error.localizedDescription
      )

    case .illegalArgumentException:
      return GenericError(
        type: .argumentError,
        error: ExternalIdpErrorCode.configError.rawValue,
        message: error.localizedDescription
      )

    case .illegalStateException:
      return GenericError(
        type: .authError,
        error: ExternalIdpErrorCode.authorizeError.rawValue,
        message: error.localizedDescription
      )
    }
  }
}

private extension String {
  /// Returns `nil` when the string becomes empty after trimming.
  var nilIfEmpty: String? {
    isEmpty ? nil : self
  }
}
