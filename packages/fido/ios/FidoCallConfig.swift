/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingLogger

/// Per-call FIDO runtime configuration parsed from the React Native bridge payload.
///
/// - Note: A `Sendable` value type: parsed once per call and read from the
///   ceremony paths without further synchronization.
struct FidoCallConfig: Sendable {

  /// The FIDO ceremony a bridge call drives. Registration ceremonies accept no
  /// credential preference, so a supplied value is reported and ignored there.
  enum Ceremony {
    /// FIDO credential registration.
    case registration
    /// FIDO authentication (assertion).
    case authentication
  }

  // MARK: - Bridge keys

  private static let loggerIdKey = "loggerId"
  private static let preferImmediatelyAvailableCredentialsKey = "preferImmediatelyAvailableCredentials"
  private static let androidConfigKey = "android"
  // MARK: - Parsed values

  /// Logger handle identifier used to resolve the native ceremony logger.
  ///
  /// `nil` when absent, blank, or not a string.
  let loggerId: String?

  /// When `true`, restricts authentication to credentials already present on
  /// the device: no QR or nearby-device fallback is offered and the ceremony
  /// cancels when no local credential matches.
  ///
  /// `nil` keeps the native full sign-in flow. Registration ceremonies have no
  /// matching native parameter, so a supplied value is reported and ignored.
  let preferImmediatelyAvailableCredentials: Bool?

  // MARK: - Parsing

  /// Parses the bridge payload, reporting option problems through the warning
  /// sink resolved for this call before any fallback applies.
  ///
  /// The payload is parsed twice: once silently to resolve the parsed logger
  /// handle for the sink, then once with warnings. Parsing is synchronous and
  /// pure, so the two passes are equivalent and the sink is resolved from the
  /// same trimmed handle the ceremony logger uses.
  ///
  /// - Parameters:
  ///   - config: Raw bridge configuration payload.
  ///   - ceremony: Ceremony the call drives.
  /// - Returns: Parsed call configuration; invalid values fall back to the
  ///   native defaults after the corresponding warning is emitted.
  /// - Note: Main-actor isolated because the registry lookup awaits an actor
  ///   and entry points already run there; parsing itself is synchronous.
  @MainActor
  static func resolve(_ config: NSDictionary, ceremony: Ceremony) async -> FidoCallConfig {
    let parsed = parse(config, ceremony: ceremony) { _ in }
    let sink = await warningSink(loggerId: parsed.loggerId)
    return parse(config, ceremony: ceremony) { sink.w($0, error: nil) }
  }

  /// Parses the raw bridge configuration dictionary.
  ///
  /// - Parameters:
  ///   - config: Raw bridge configuration payload.
  ///   - ceremony: Ceremony the call drives.
  ///   - warn: Sink for option warnings; invoked before each fallback applies.
  /// - Returns: Parsed call configuration.
  static func parse(
    _ config: NSDictionary,
    ceremony: Ceremony,
    warn: (String) -> Void
  ) -> FidoCallConfig {
    let loggerId = parseLoggerId(config, warn: warn)
    let preferImmediatelyAvailableCredentials = parsePreferImmediatelyAvailableCredentials(
      config,
      ceremony: ceremony,
      warn: warn
    )
    warnIfOffPlatformAndroidConfigPresent(config, warn: warn)
    warnIfUnknownKeysPresent(config, warn: warn)
    return FidoCallConfig(
      loggerId: loggerId,
      preferImmediatelyAvailableCredentials: preferImmediatelyAvailableCredentials
    )
  }

  /// Resolves the warning sink for one call.
  ///
  /// The registry logger resolved from the parsed logger handle is used so
  /// option warnings reach the same sink as the ceremony logs. When none
  /// resolves (absent, mistyped, or unknown handle) the PingLogger global
  /// default applies, mirroring the native collectors' fallback.
  ///
  /// - Parameter loggerId: Parsed, trimmed logger handle identifier.
  /// - Returns: Warning sink for the call.
  /// - Note: Main-actor isolated; called from `resolve` on the main actor.
  @MainActor
  static func warningSink(loggerId: String?) async -> Logger {
    if let resolved = await RNPingFidoCommon.resolveLoggerFromCore(loggerId) {
      return resolved
    }
    return LogManager.logger
  }

  // MARK: - Key parsers

  /// Parses the logger handle id from the payload.
  private static func parseLoggerId(_ config: NSDictionary, warn: (String) -> Void) -> String? {
    guard let value = config[loggerIdKey] else {
      return nil
    }
    guard let id = value as? String else {
      warnOption(loggerIdKey, value, "a String is expected and the default logger applies", warn)
      return nil
    }
    let trimmed = id.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }

  /// Parses the authentication-only credential preference from the payload.
  private static func parsePreferImmediatelyAvailableCredentials(
    _ config: NSDictionary,
    ceremony: Ceremony,
    warn: (String) -> Void
  ) -> Bool? {
    guard let value = config[preferImmediatelyAvailableCredentialsKey] else {
      return nil
    }
    guard let flag = booleanValue(value) else {
      warnOption(
        preferImmediatelyAvailableCredentialsKey,
        value,
        "a Boolean is expected and the native sign-in flow applies",
        warn
      )
      return nil
    }
    // TODO-PARITY: iOS applies preferImmediatelyAvailableCredentials to authenticate only (register ignores it) while Android 2.2.0 applies it to registration only - needs native defect ticket
    if ceremony == .registration {
      warnOption(
        preferImmediatelyAvailableCredentialsKey,
        value,
        "registration does not support this option and the full registration flow applies",
        warn
      )
      return nil
    }
    return flag
  }

  /// Reports Android-only ceremony options supplied on iOS.
  private static func warnIfOffPlatformAndroidConfigPresent(
    _ config: NSDictionary,
    warn: (String) -> Void
  ) {
    guard let value = config[androidConfigKey] else {
      return
    }
    warnOption(androidConfigKey, value, "Android-only options are ignored on iOS", warn)
  }

  /// Reports unrecognized configuration keys before the ceremony proceeds.
  ///
  /// - Parameters:
  ///   - config: Raw bridge configuration payload.
  ///   - warn: Sink for option warnings.
  private static func warnIfUnknownKeysPresent(
    _ config: NSDictionary,
    warn: (String) -> Void
  ) {
    let knownKeys: Set<String> = [
      loggerIdKey,
      preferImmediatelyAvailableCredentialsKey,
      androidConfigKey
    ]
    for key in config.allKeys {
      guard let key = key as? String else {
        warnOption(
          String(describing: key),
          config[key],
          "this key is not a String and is ignored",
          warn
        )
        continue
      }
      guard !knownKeys.contains(key) else {
        continue
      }
      warnOption(key, config[key], "this key is not recognized and is ignored", warn)
    }
  }

  // MARK: - Value helpers

  /// Returns the value when it is a bridge boolean, otherwise `nil`.
  ///
  /// Numeric payloads are rejected so a mistyped `1` is reported instead of
  /// silently promoting to `true`.
  private static func booleanValue(_ value: Any) -> Bool? {
    guard let number = value as? NSNumber,
          CFGetTypeID(number) == CFBooleanGetTypeID() else {
      return nil
    }
    return number.boolValue
  }

  /// Emits an option warning naming the key, the value type and, for strings,
  /// the length; never the value itself.
  private static func warnOption(
    _ key: String,
    _ value: Any,
    _ consequence: String,
    _ warn: (String) -> Void
  ) {
    var message = "FIDO config key '\(key)' received \(describeValueType(value))"
    if let string = value as? String {
      message += " of length \(string.count)"
    }
    message += "; \(consequence)"
    warn(message)
  }

  /// Describes the bridge value type of a payload value.
  private static func describeValueType(_ value: Any) -> String {
    switch value {
    case is String:
      return "a String"
    case is NSDictionary:
      return "an Object"
    case is NSArray:
      return "an Array"
    case let number as NSNumber:
      return CFGetTypeID(number) == CFBooleanGetTypeID() ? "a Boolean" : "a Number"
    case is NSNull:
      return "null"
    default:
      return "a value of type \(String(describing: type(of: value)))"
    }
  }
}
