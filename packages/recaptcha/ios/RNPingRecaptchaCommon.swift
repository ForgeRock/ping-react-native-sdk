/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import Foundation
import PingLogger
import PingReCaptchaEnterprise
import React
import RNPingCore

/// Shared reCAPTCHA Enterprise execution logic for React Native iOS bridges.
///
/// Verification outcomes resolve as discriminated payloads —
/// `{ type: "success", token }` or `{ type: "failure", code, message }` —
/// because the native `verify()` auto-submits the token or the client error
/// into the callback inputs on both paths and the server expects `next()` to
/// proceed. Only bridge-level failures (blank journey id, missing callback)
/// reject the promise.
///
/// - Note: No `@MainActor` is used. reCAPTCHA Enterprise verification is
///   headless and presents no UI, so no window anchor is required — unlike
///   FIDO, whose WebAuthn ceremonies need a main-actor window anchor.
@objcMembers
public class RNPingRecaptchaCommon: NSObject {

  /// Stable error codes emitted by the reCAPTCHA module.
  ///
  /// Keep these in sync with JS `RecaptchaErrorCode` and Android `RecaptchaErrorCodes`.
  private enum RecaptchaErrorCode: String {
    case recaptchaError = "RECAPTCHA_ERROR"
    case verifyError = "RECAPTCHA_VERIFY_ERROR"
    case callbackNotFound = "RECAPTCHA_CALLBACK_NOT_FOUND"
    case unknown = "UNKNOWN_ERROR"
  }

  /// Default action name mirroring the upstream
  /// `ReCaptchaEnterpriseConstants.defaultAction`.
  private static let defaultAction = "login"

  /// Default verification timeout in milliseconds.
  ///
  /// Always passed explicitly to `verify(configBlock:)` so both platforms
  /// behave identically; the JS layer forwards `timeoutMs` by default too.
  private static let defaultTimeoutMs: Double = 15000

  /// Executes the active Journey `ReCaptchaEnterpriseCallback`.
  ///
  /// Both verification outcomes resolve: on success the native callback has
  /// already stored the token/action inputs, and on failure it has recorded
  /// the client error — the server expects `next()` to proceed in either
  /// case. Bridge-level failures (blank journey id, no callback at `index`)
  /// reject instead.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Callback execution options (index, action, timeoutMs, payload).
  ///   - config: Per-call runtime configuration payload (loggerId).
  ///   - resolver: Promise resolver for the verification outcome payload.
  ///   - rejecter: Promise rejecter for bridge-level errors.
  @objc
  public static func verifyForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)

    if journeyId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      handlers.reject(
        GenericError(
          type: .argumentError,
          error: RecaptchaErrorCode.recaptchaError.rawValue,
          message: "Journey id must not be empty for reCAPTCHA verification."
        )
      )
      return
    }

    let callConfig = parseCallConfig(config)
    let parsedOptions = parseVerifyOptions(options)

    // Headless verification: no UI anchor, so a plain structured Task on the
    // cooperative pool is correct (see class doc note).
    Task {
      guard let callback = await resolveEnterpriseCallback(
        journeyId: journeyId,
        index: parsedOptions.index
      ) else {
        handlers.reject(
          GenericError(
            type: .stateError,
            error: RecaptchaErrorCode.callbackNotFound.rawValue,
            message: "No active ReCaptchaEnterpriseCallback found for journey \(journeyId) at index \(parsedOptions.index)."
          )
        )
        return
      }

      let logger = await resolveLoggerFromCore(callConfig.loggerId)
      let result = await callback.verify { verifyConfig in
        applyOptions(parsedOptions, logger: logger, to: verifyConfig)
      }

      switch result {
      case .success(let token):
        handlers.resolve(createResultPayload(type: "success", token: token))
      case .failure(let error):
        // Verification failure resolves (never rejects): the native callback
        // has already recorded the client error into its inputs, so the
        // server expects `next()` to proceed.
        handlers.resolve(
          createFailureResultPayload(error: error)
        )
      }
    }
  }

  /// Resolves the Journey `ReCaptchaEnterpriseCallback` at the given type index.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - index: Zero-based index among the active enterprise callbacks.
  /// - Returns: The resolved callback, or `nil` when the journey is unknown
  ///   or no callback exists at the index.
  private static func resolveEnterpriseCallback(
    journeyId: String,
    index: Int
  ) async -> ReCaptchaEnterpriseCallback? {
    guard let callbacks = await CoreRuntime.resolveJourneyCallbacks(journeyId) else {
      return nil
    }
    let matching = callbacks.compactMap { $0 as? ReCaptchaEnterpriseCallback }
    guard index >= 0, index < matching.count else {
      return nil
    }
    return matching[index]
  }

  /// Applies parsed bridge options to the upstream verification config.
  ///
  /// - Parameters:
  ///   - options: Parsed options payload.
  ///   - logger: Optional native logger resolved from Core; upstream keeps
  ///     its `LogManager.logger` default when `nil`.
  ///   - config: Upstream configuration object to populate.
  private static func applyOptions(
    _ options: VerifyOptions,
    logger: PingLogger.Logger?,
    to config: ReCaptchaEnterpriseConfig
  ) {
    config.action = options.action
    config.timeout = options.timeoutMs
    config.payload = options.payload
    if let logger {
      config.logger = logger
    }
  }

  /// Builds the bridge payload for a verification outcome.
  ///
  /// - Parameters:
  ///   - type: Discriminant: `"success"` or `"failure"`.
  ///   - token: Verification token (success only).
  /// - Returns: Payload dictionary for JS.
  private static func createResultPayload(type: String, token: String) -> NSDictionary {
    return ["type": type, "token": token]
  }

  /// Builds the `{ type: "failure", code, message }` payload for a failed
  /// verification.
  ///
  /// The token is a credential-equivalent and is never echoed on failure.
  ///
  /// - Parameter error: Native error from the `Result.failure` branch.
  /// - Returns: Payload dictionary for JS.
  private static func createFailureResultPayload(error: Error) -> NSDictionary {
    return [
      "type": "failure",
      "code": failureCode(error),
      "message": error.localizedDescription,
    ]
  }

  /// Derives the stable failure code carried by the failure payload.
  ///
  /// - Parameter error: Native error from the `Result.failure` branch.
  /// - Returns: The upstream constant when the native callback surfaces its
  ///   invalid-token sentinel, otherwise the shared `UNKNOWN_ERROR` fallback.
  ///
  /// - Note: Internal (not `private`) for unit-test observability of the
  ///   failure-code contract.
  static func failureCode(_ error: Error) -> String {
    // TODO-PARITY (needs native defect ticket): on verification failure the
    // iOS SDK's `verify()` submits only the client error into the callback
    // inputs, while Android also submits an empty token, the action, and an
    // empty payload — so the server receives a different partial-input set
    // per platform. Additionally, Google's `RecaptchaEnterprise` error types
    // are `internal import`-ed upstream, so the bridge cannot map typed
    // error codes here and falls back to `UNKNOWN_ERROR`. Fix both in the
    // native SDK, not in this bridge.
    let nsError = error as NSError
    if nsError.localizedDescription.contains(
      ReCaptchaEnterpriseConstants.invalidToken
    ) {
      return ReCaptchaEnterpriseConstants.invalidToken
    }
    return RecaptchaErrorCode.unknown.rawValue
  }

  /// Parsed verification options.
  ///
  /// - Note: `@unchecked Sendable` because this is an immutable value wrapper
  ///   around bridge-provided dictionary data (`[String: Any]` is not
  ///   statically Sendable, but the payload is an immutable `NSDictionary`
  ///   snapshot safe for concurrent reads). The struct is captured inside the
  ///   upstream `@Sendable` config block and the verification `Task`.
  struct VerifyOptions: @unchecked Sendable {
    /// Zero-based index among the active enterprise callbacks.
    let index: Int
    /// Action name passed through to the upstream config.
    let action: String
    /// Verification timeout in milliseconds.
    let timeoutMs: Double
    /// Custom risk-assessment metadata, when supplied.
    let payload: [String: Any]?
  }

  /// Parses verification options from the JS payload.
  ///
  /// - Parameter options: Options dictionary from JS.
  /// - Returns: Parsed options with defaults applied (index 0, action
  ///   `"login"`, timeout 15000ms, no payload).
  /// - Note: Internal (not `private`) for unit-test observability of the
  ///   option-parsing defaults contract, mirroring `resolveLoggerFromCore`.
  static func parseVerifyOptions(_ options: NSDictionary) -> VerifyOptions {
    return VerifyOptions(
      index: parseCallbackIndex(options),
      action: normalizeAction(options["action"] as? String),
      timeoutMs: parseTimeoutMs(options),
      payload: options["payload"] as? [String: Any]
    )
  }

  /// Normalizes an optional action name from the bridge payload.
  ///
  /// - Parameter value: Raw action string, when supplied.
  /// - Returns: The trimmed action, or the upstream default when absent,
  ///   blank, or whitespace-only.
  private static func normalizeAction(_ value: String?) -> String {
    guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
          !trimmed.isEmpty else {
      return defaultAction
    }
    return trimmed
  }

  /// Parses the callback index from the options payload.
  ///
  /// - Parameter options: Options dictionary from JS.
  /// - Returns: Zero-based index, or 0 when absent or malformed.
  private static func parseCallbackIndex(_ options: NSDictionary) -> Int {
    if let value = options["index"] as? NSNumber {
      return value.intValue
    }
    if let value = options["index"] as? String, let parsed = Int(value) {
      return parsed
    }
    return 0
  }

  /// Parses the verification timeout from the options payload.
  ///
  /// - Parameter options: Options dictionary from JS.
  /// - Returns: Timeout in milliseconds, or the default when absent or not a
  ///   number. A supplied negative value passes through so the upstream SDK
  ///   surfaces its own timeout taxonomy rather than the bridge silently
  ///   substituting the default.
  private static func parseTimeoutMs(_ options: NSDictionary) -> Double {
    if let value = options["timeoutMs"] as? NSNumber {
      return value.doubleValue
    }
    if let value = options["timeoutMs"] as? String, let parsed = Double(value) {
      return parsed
    }
    return defaultTimeoutMs
  }

  /// Per-call runtime configuration.
  ///
  /// - Parameters:
  ///   - loggerId: Native logger handle id resolved via Core, when supplied.
  private struct CallConfig {
    let loggerId: String?
  }

  /// Parses the per-call configuration payload.
  ///
  /// - Parameter config: Raw bridge configuration dictionary.
  /// - Returns: Trimmed call configuration values.
  private static func parseCallConfig(_ config: NSDictionary) -> CallConfig {
    let trimmed = (config["loggerId"] as? String)?
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return CallConfig(loggerId: (trimmed?.isEmpty == false) ? trimmed : nil)
  }

  /// Resolves a native logger from the shared Core logger registry.
  ///
  /// - Parameter loggerId: Logger handle identifier from JS.
  /// - Returns: Native logger instance, or `nil` when missing/invalid.
  /// - Note: Internal (not `private`) for unit-test observability of the
  ///   `config.loggerId` forwarding contract, mirroring FIDO.
  static func resolveLoggerFromCore(_ loggerId: String?) async -> PingLogger.Logger? {
    guard let loggerId, !loggerId.isEmpty else { return nil }
    guard let handle = await CoreRuntime.loggerRegistry.resolve(loggerId) as? LoggerHandleContract else {
      return nil
    }
    return handle.nativeLogger as? PingLogger.Logger
  }
}
