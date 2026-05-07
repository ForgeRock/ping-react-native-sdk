/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import Foundation
import PingBinding
import PingStorage
import PingLogger
import RNPingCore

/// Parsed app-pin authenticator options from the JS `options.appPin` sub-key.
struct ParsedAppPinOptions: Sendable {
  let maxAttempts: Int?
  let keyTag: String?
  let promptTitle: String?
  let promptSubtitle: String?
  let promptDescription: String?
}

/// Parsed biometric authenticator options from the JS `options.biometric.ios` sub-key.
struct ParsedBiometricOptions: Sendable {
  let keyTag: String?
}

/// Parsed JWT claim timing options from the JS `options.jwt` sub-key.
struct ParsedJwtOptions: Sendable {
  let issueTimeEpochSeconds: Double?
  let notBeforeTimeEpochSeconds: Double?
  let expirationTimeEpochSeconds: Double?
}

/// Resolved user-key storage configuration fetched from the `CoreRuntime` registry.
struct ResolvedUserKeyStorageValues: Sendable {
  /// The Keychain account string for user-key persistence.
  let account: String
  /// Whether to wrap the Keychain entry with `SecuredKeyEncryptor`.
  let encryptorEnabled: Bool
}

extension RNPingBindingCommon {

  /// Reads the `index` field from `options`, accepting both `NSNumber` and `String` representations.
  /// Returns `0` when the field is absent or not parseable.
  static func parseCallbackIndex(_ options: NSDictionary) -> Int {
    if let value = options["index"] as? NSNumber { return value.intValue }
    if let value = options["index"] as? String, let parsed = Int(value) { return parsed }
    return 0
  }

  /// Reads a trimmed, non-blank string from `options` at `key`. Returns `nil` when absent or blank.
  static func parseStringOption(_ options: NSDictionary, key: String) -> String? {
    guard let value = options[key] as? String else { return nil }
    let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return normalized.isEmpty ? nil : normalized
  }

  /// Reads a trimmed, non-blank string from the per-call `config` dict at `key`. Returns `nil` when absent or blank.
  static func parseStringConfig(_ config: NSDictionary, key: String) -> String? {
    guard let value = config[key] as? String else { return nil }
    let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return normalized.isEmpty ? nil : normalized
  }

  /// Reads the `loggerId` field from the per-call `config` dict. Returns `nil` when absent or blank.
  static func parseLoggerId(_ config: NSDictionary) -> String? {
    guard let value = config["loggerId"] as? String else { return nil }
    let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return normalized.isEmpty ? nil : normalized
  }

  /// Extracts the `claims` dictionary from `options`. Returns an empty dict when absent or wrong type.
  static func parseClaims(_ options: NSDictionary) -> [String: Any] {
    guard let claims = options["claims"] as? [String: Any] else { return [:] }
    return claims
  }

  /// Parses `options.appPin` into `ParsedAppPinOptions`. Returns `nil` when the key is absent.
  static func parseAppPinOptions(_ options: NSDictionary) -> ParsedAppPinOptions? {
    guard let appPin = options["appPin"] as? NSDictionary else { return nil }
    let prompt = appPin["prompt"] as? NSDictionary
    return ParsedAppPinOptions(
      maxAttempts: (appPin["maxAttempts"] as? NSNumber)?.intValue,
      keyTag: appPin["keyTag"] as? String,
      promptTitle: prompt?["title"] as? String,
      promptSubtitle: prompt?["subtitle"] as? String,
      promptDescription: prompt?["description"] as? String
    )
  }

  /// Parses `options.biometric.ios` into `ParsedBiometricOptions`. Returns `nil` when the key is absent.
  static func parseBiometricOptions(_ options: NSDictionary) -> ParsedBiometricOptions? {
    guard let biometric = options["biometric"] as? NSDictionary,
          let ios = biometric["ios"] as? NSDictionary else { return nil }
    return ParsedBiometricOptions(
      keyTag: ios["keyTag"] as? String
    )
  }

  /// Parses `options.jwt` into `ParsedJwtOptions`. Returns `nil` when the key is absent.
  static func parseJwtOptions(_ options: NSDictionary) -> ParsedJwtOptions? {
    guard let jwt = options["jwt"] as? NSDictionary else { return nil }
    return ParsedJwtOptions(
      issueTimeEpochSeconds: (jwt["issueTimeEpochSeconds"] as? NSNumber)?.doubleValue,
      notBeforeTimeEpochSeconds: (jwt["notBeforeTimeEpochSeconds"] as? NSNumber)?.doubleValue,
      expirationTimeEpochSeconds: (jwt["expirationTimeEpochSeconds"] as? NSNumber)?.doubleValue
    )
  }

  /// Resolves a `PingLogger.Logger` from the `CoreRuntime` registry using `loggerId`.
  /// Returns `nil` when `loggerId` is blank or no matching handle is registered.
  static func resolveLoggerFromCore(_ loggerId: String?) async -> PingLogger.Logger? {
    guard let loggerId, !loggerId.isEmpty else { return nil }
    guard let handle = await CoreRuntime.loggerRegistry.resolve(loggerId) as? LoggerHandleContract else { return nil }
    return handle.nativeLogger as? PingLogger.Logger
  }

  /// Sets the `logger` property on `config` via KVC when the config type supports it.
  /// Falls back to `LogManager.none` when `logger` is `nil`.
  static func setLoggerIfSupported(_ config: AnyObject, logger: PingLogger.Logger?) {
    guard let target = config as? NSObject else { return }
    let selector = NSSelectorFromString("setLogger:")
    guard target.responds(to: selector) else { return }
    target.setValue(logger ?? LogManager.none, forKey: "logger")
  }

  /// Resolves user-key storage configuration from the `CoreRuntime` registry using `userKeyStorageId`.
  /// Returns `nil` when `userKeyStorageId` is blank or no matching handle is registered.
  static func resolveUserKeyStorageFromCore(_ userKeyStorageId: String?) async -> ResolvedUserKeyStorageValues? {
    guard let userKeyStorageId, !userKeyStorageId.isEmpty else { return nil }
    guard let handle = await CoreRuntime.bindingUserKeyStorageConfigRegistry.resolve(userKeyStorageId)
      as? StorageConfigHandleContract else { return nil }
    let rawAccount = handle.account?.trimmingCharacters(in: .whitespacesAndNewlines)
    let resolvedAccount = (rawAccount?.isEmpty == false)
      ? (rawAccount ?? "com.pingidentity.device.binding.v1.userkeys")
      : "com.pingidentity.device.binding.v1.userkeys"
    return ResolvedUserKeyStorageValues(
      account: resolvedAccount,
      encryptorEnabled: handle.encryptor ?? true
    )
  }

  /// Applies parsed options to `nativeConfig` inside a `bind {}` or `sign {}` closure.
  ///
  /// - Parameters:
  ///   - nativeConfig: The `DeviceBindingConfig` to mutate.
  ///   - appPin: Parsed app-pin options, or `nil` to skip.
  ///   - biometric: Parsed biometric options, or `nil` to skip.
  ///   - jwt: Parsed JWT timing options, or `nil` to skip.
  ///   - resolvedUserKeyStorage: Resolved user-key storage values, or `nil` to skip.
  static func applyCommonBindingConfig(
    nativeConfig: DeviceBindingConfig,
    appPin: ParsedAppPinOptions?,
    biometric: ParsedBiometricOptions?,
    jwt: ParsedJwtOptions?,
    resolvedUserKeyStorage: ResolvedUserKeyStorageValues?
  ) {
    if let storage = resolvedUserKeyStorage {
      let encryptor: any Encryptor
      if storage.encryptorEnabled {
        encryptor = SecuredKeyEncryptor() ?? NoEncryptor()
      } else {
        encryptor = NoEncryptor()
      }
      nativeConfig.userKeyStorage = UserKeyStorageConfig(
        storage: KeychainStorage(account: storage.account, encryptor: encryptor)
      )
    }
    if let appPin { applyAppPinConfig(nativeConfig: nativeConfig, appPin: appPin) }
    if let biometric { applyBiometricConfig(nativeConfig: nativeConfig, biometric: biometric) }
    if let jwt { applyJwtConfig(nativeConfig: nativeConfig, jwt: jwt) }
  }

  static func configureAppPinConfig(_ config: AppPinConfig, appPin: ParsedAppPinOptions) {
    if let maxAttempts = appPin.maxAttempts { config.pinRetry = maxAttempts }
    if let keyTag = appPin.keyTag, !keyTag.isEmpty { config.keyTag = keyTag }
    if appPin.promptTitle != nil || appPin.promptSubtitle != nil || appPin.promptDescription != nil {
      config.prompt = Prompt(
        title: appPin.promptTitle ?? config.prompt.title,
        subtitle: appPin.promptSubtitle ?? config.prompt.subtitle,
        description: appPin.promptDescription ?? config.prompt.description
      )
    }
  }

  static func applyAppPinConfig(nativeConfig: DeviceBindingConfig, appPin: ParsedAppPinOptions) {
    let defaultConfig = AppPinConfig()
    configureAppPinConfig(defaultConfig, appPin: appPin)
    nativeConfig.authenticatorConfig = defaultConfig
  }

  static func applyBiometricConfig(nativeConfig: DeviceBindingConfig, biometric: ParsedBiometricOptions) {
    let biometricConfig = BiometricAuthenticatorConfig()
    if let keyTag = biometric.keyTag, !keyTag.isEmpty { biometricConfig.keyTag = keyTag }
    nativeConfig.authenticatorConfig = biometricConfig
  }

  static func applyJwtConfig(nativeConfig: DeviceBindingConfig, jwt: ParsedJwtOptions) {
    if let issue = jwt.issueTimeEpochSeconds {
      let date = Date(timeIntervalSince1970: issue)
      nativeConfig.issueTime = { date }
    }
    if let notBefore = jwt.notBeforeTimeEpochSeconds {
      let date = Date(timeIntervalSince1970: notBefore)
      nativeConfig.notBeforeTime = { date }
    }
    if let expiration = jwt.expirationTimeEpochSeconds {
      let date = Date(timeIntervalSince1970: expiration)
      nativeConfig.expirationTime = { _ in date }
    }
  }

#if DEBUG
  public static func _test_configureAppPinConfig(_ options: NSDictionary) -> NSDictionary? {
    guard let appPin = parseAppPinOptions(options) else { return nil }
    let config = AppPinConfig()
    configureAppPinConfig(config, appPin: appPin)
    return [
      "pinRetry": config.pinRetry as Any,
      "keyTag": config.keyTag as Any,
      "promptTitle": config.prompt.title as Any,
      "promptSubtitle": config.prompt.subtitle as Any,
      "promptDescription": config.prompt.description as Any,
    ]
  }

  public static func _test_parseAppPinOptions(_ options: NSDictionary) -> NSDictionary? {
    guard let parsed = parseAppPinOptions(options) else { return nil }
    return [
      "maxAttempts": parsed.maxAttempts as Any,
      "keyTag": parsed.keyTag as Any,
      "promptTitle": parsed.promptTitle as Any,
      "promptSubtitle": parsed.promptSubtitle as Any,
      "promptDescription": parsed.promptDescription as Any,
    ]
  }

  public static func _test_parseBiometricOptions(_ options: NSDictionary) -> NSDictionary? {
    guard let parsed = parseBiometricOptions(options) else { return nil }
    return [
      "keyTag": parsed.keyTag as Any,
    ]
  }

  public static func _test_parseJwtOptions(_ options: NSDictionary) -> NSDictionary? {
    guard let parsed = parseJwtOptions(options) else { return nil }
    return [
      "issueTimeEpochSeconds": parsed.issueTimeEpochSeconds as Any,
      "notBeforeTimeEpochSeconds": parsed.notBeforeTimeEpochSeconds as Any,
      "expirationTimeEpochSeconds": parsed.expirationTimeEpochSeconds as Any,
    ]
  }

  public static func _test_parseClaims(_ options: NSDictionary) -> NSDictionary {
    return parseClaims(options) as NSDictionary
  }

  public static func _test_parseCallbackIndex(_ options: NSDictionary) -> Int {
    return parseCallbackIndex(options)
  }

  public static func _test_parseStringOption(_ options: NSDictionary, key: String) -> String? {
    return parseStringOption(options, key: key)
  }

  public static func _test_parseLoggerId(_ config: NSDictionary) -> String? {
    return parseLoggerId(config)
  }

  public static func _test_parseStringConfig(_ config: NSDictionary, key: String) -> String? {
    return parseStringConfig(config, key: key)
  }
#endif
}
