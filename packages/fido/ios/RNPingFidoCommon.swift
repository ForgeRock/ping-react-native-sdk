/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import AuthenticationServices
import Foundation
import PingFido
import PingJourneyPlugin
import React
import RNPingCore

/// Shared FIDO execution logic for React Native iOS bridges.
@objcMembers
public class RNPingFidoCommon: NSObject {

  /// Stable error codes emitted by the FIDO module.
  ///
  /// Keep these in sync with JS `FidoErrorCode` and Android `FidoErrorCodes`.
  private enum FidoErrorCode: String {
    case fidoError = "FIDO_ERROR"
    case registerError = "FIDO_REGISTER_ERROR"
    case authenticateError = "FIDO_AUTHENTICATE_ERROR"
    case authenticateCancelled = "FIDO_AUTHENTICATE_CANCELLED"
    case windowUnavailable = "FIDO_WINDOW_UNAVAILABLE"
    case callbackNotFound = "FIDO_CALLBACK_NOT_FOUND"
  }

  /// Registers a new FIDO credential.
  /// - Parameters:
  ///   - options: Registration options payload.
  ///   - config: Per-call runtime configuration payload.
  ///   - resolver: Promise resolver for the registration result.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public static func register(
    _ options: NSDictionary,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    _ = config
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    execute(
      options: options,
      action: "registration",
      methodErrorCode: .registerError,
      handlers: handlers
    ) { optionsMap, window, completion in
      Fido.shared.register(options: optionsMap, window: window, completion: completion)
    }
  }

  /// Authenticates with an existing FIDO credential.
  /// - Parameters:
  ///   - options: Authentication options payload.
  ///   - config: Per-call runtime configuration payload.
  ///   - resolver: Promise resolver for the authentication result.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public static func authenticate(
    _ options: NSDictionary,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    _ = config
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    execute(
      options: options,
      action: "authentication",
      methodErrorCode: .authenticateError,
      handlers: handlers
    ) { optionsMap, window, completion in
      Fido.shared.authenticate(options: optionsMap, window: window, completion: completion)
    }
  }

  /// Executes a Journey-scoped FIDO registration callback.
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Callback execution options.
  ///   - config: Per-call runtime configuration payload.
  ///   - resolver: Promise resolver for success payload.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public static func registerForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    _ = config
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    if journeyId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      handlers.reject(
        GenericError(
          type: .argumentError,
          error: FidoErrorCode.callbackNotFound.rawValue,
          message: "Journey id must not be empty for FIDO registration."
        )
      )
      return
    }

    let callbackIndex = parseCallbackIndex(options)
    let deviceName = parseJourneyDeviceName(options)

    guard let window = PresentationAnchorResolver.resolveForegroundWindowAnchor() else {
      handlers.reject(
        GenericError(
          type: .fidoError,
          error: FidoErrorCode.windowUnavailable.rawValue,
          message: "No active application window is available for Journey FIDO registration."
        )
      )
      return
    }

    Task { @MainActor in
      guard let callback = await resolveRegistrationCallback(
        journeyId: journeyId,
        index: callbackIndex
      ) else {
        handlers.reject(
          GenericError(
            type: .stateError,
            error: FidoErrorCode.callbackNotFound.rawValue,
            message: "No active FIDO registration callback found for journey \(journeyId)."
          )
        )
        return
      }

      let result = await callback.register(deviceName: deviceName, window: window)
      switch result {
      case .success:
        handlers.resolve(createJourneyResultPayload(type: "success"))
      case .failure(let error):
        handlers.reject(
          GenericError(
            type: .fidoError,
            error: FidoErrorCode.registerError.rawValue,
            message: error.localizedDescription
          ),
          underlying: error as NSError
        )
      }
    }
  }

  /// Executes a Journey-scoped FIDO authentication callback.
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Callback execution options.
  ///   - config: Per-call runtime configuration payload.
  ///   - resolver: Promise resolver for success payload.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public static func authenticateForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    _ = config
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    if journeyId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      handlers.reject(
        GenericError(
          type: .argumentError,
          error: FidoErrorCode.callbackNotFound.rawValue,
          message: "Journey id must not be empty for FIDO authentication."
        )
      )
      return
    }

    let callbackIndex = parseCallbackIndex(options)

    guard let window = PresentationAnchorResolver.resolveForegroundWindowAnchor() else {
      handlers.reject(
        GenericError(
          type: .fidoError,
          error: FidoErrorCode.windowUnavailable.rawValue,
          message: "No active application window is available for Journey FIDO authentication."
        )
      )
      return
    }

    Task { @MainActor in
      guard let callback = await resolveAuthenticationCallback(
        journeyId: journeyId,
        index: callbackIndex
      ) else {
        handlers.reject(
          GenericError(
            type: .stateError,
            error: FidoErrorCode.callbackNotFound.rawValue,
            message: "No active FIDO authentication callback found for journey \(journeyId)."
          )
        )
        return
      }

      let result = await callback.authenticate(window: window)
      switch result {
      case .success:
        handlers.resolve(createJourneyResultPayload(type: "success"))
      case .failure(let error):
        let nsError = error as NSError
        let code = isRecoverableFidoAuthenticationFailure(nsError)
          ? FidoErrorCode.authenticateCancelled
          : FidoErrorCode.authenticateError
        handlers.reject(
          GenericError(
            type: .fidoError,
            error: code.rawValue,
            message: error.localizedDescription
          ),
          underlying: nsError
        )
      }
    }
  }

  /// Executes one FIDO operation using standardized bridge/error handling.
  /// - Parameters:
  ///   - options: JS options payload.
  ///   - action: Human-readable action used in error messages.
  ///   - methodErrorCode: Stable method-specific error code.
  ///   - handlers: Shared promise bridge handlers.
  ///   - operation: Native FIDO operation closure to execute.
  @MainActor
  private static func execute(
    options: NSDictionary,
    action: String,
    methodErrorCode: FidoErrorCode,
    handlers: PromiseBridge<NSDictionary>,
    operation: (
      _ options: [String: Any],
      _ window: ASPresentationAnchor,
      _ completion: @escaping (Result<[String: Any], Error>) -> Void
    ) -> Void
  ) {
    guard let window = PresentationAnchorResolver.resolveForegroundWindowAnchor() else {
      handlers.reject(
        GenericError(
          type: .fidoError,
          error: FidoErrorCode.windowUnavailable.rawValue,
          message: "No active application window is available for FIDO \(action)."
        )
      )
      return
    }

    guard let optionsMap = options as? [String: Any] else {
      handlers.reject(
        GenericError(
          type: .argumentError,
          error: methodErrorCode.rawValue,
          message: "Invalid FIDO \(action) options payload."
        )
      )
      return
    }

    operation(optionsMap, window) { result in
      switch result {
      case .success(let payload):
        handlers.resolve(JsonBridgeMapper.encodeJsonObject(payload))
      case .failure(let error):
        handlers.reject(
          GenericError(
            type: .fidoError,
            error: methodErrorCode.rawValue,
            message: error.localizedDescription
          ),
          underlying: error as NSError
        )
      }
    }
  }

  /// Resolves one registration callback from the active Journey callbacks exposed by core.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - index: Per-type callback index.
  /// - Returns: Matching callback when available.
  private static func resolveRegistrationCallback(
    journeyId: String,
    index: Int
  ) async -> FidoRegistrationCallback? {
    guard let callbacks = await CoreRuntime.resolveJourneyCallbacks(journeyId) else {
      return nil
    }
    let matching = callbacks.compactMap { $0 as? FidoRegistrationCallback }
    guard index >= 0, index < matching.count else {
      return nil
    }
    return matching[index]
  }

  /// Resolves one authentication callback from the active Journey callbacks exposed by core.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - index: Per-type callback index.
  /// - Returns: Matching callback when available.
  private static func resolveAuthenticationCallback(
    journeyId: String,
    index: Int
  ) async -> FidoAuthenticationCallback? {
    guard let callbacks = await CoreRuntime.resolveJourneyCallbacks(journeyId) else {
      return nil
    }
    let matching = callbacks.compactMap { $0 as? FidoAuthenticationCallback }
    guard index >= 0, index < matching.count else {
      return nil
    }
    return matching[index]
  }

  /// Parses callback index from Journey callback execution options.
  ///
  /// - Parameter options: Callback execution options payload.
  /// - Returns: Parsed callback index (defaults to 0).
  private static func parseCallbackIndex(_ options: NSDictionary) -> Int {
    if let value = options["index"] as? NSNumber {
      return value.intValue
    }
    if let value = options["index"] as? String, let parsed = Int(value) {
      return parsed
    }
    return 0
  }

  /// Parses optional device name for Journey registration callback execution.
  ///
  /// - Parameter options: Callback execution options payload.
  /// - Returns: Trimmed device name when provided.
  private static func parseJourneyDeviceName(_ options: NSDictionary) -> String? {
    if let value = options["deviceName"] as? String {
      let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
      return normalized.isEmpty ? nil : normalized
    }
    if let value = options["deviceName"] as? NSNumber {
      return value.stringValue
    }
    if let value = options["deviceName"] as? Bool {
      return value ? "true" : "false"
    }
    return nil
  }

  /// Creates a normalized Journey callback success payload.
  ///
  /// - Parameter type: Result type value.
  /// - Returns: NSDictionary payload for JS.
  private static func createJourneyResultPayload(type: String) -> NSDictionary {
    return ["type": type]
  }

  /// Determines whether a FIDO authentication failure is recoverable cancellation.
  ///
  /// - Parameter error: Native error from FIDO authenticate.
  /// - Returns: `true` for cancellation/no-credential outcomes.
  private static func isRecoverableFidoAuthenticationFailure(_ error: NSError) -> Bool {
    if error.domain == ASAuthorizationError.errorDomain,
       error.code == ASAuthorizationError.canceled.rawValue {
      return true
    }
    if let underlyingError = error.userInfo[NSUnderlyingErrorKey] as? NSError,
       underlyingError.domain == ASAuthorizationError.errorDomain,
       underlyingError.code == ASAuthorizationError.canceled.rawValue {
      return true
    }
    let text = [
      error.domain,
      error.localizedDescription,
      String(error.code),
      (error.userInfo["message"] as? String) ?? "",
      (error.userInfo["error"] as? String) ?? "",
    ].joined(separator: " ").lowercased()

    return text.contains("asauthorizationerror") &&
      (text.contains("code=1001") ||
        text.contains("code 1001") ||
        text.contains("error 1001"))
  }
}
