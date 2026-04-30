/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import Foundation
import PingJourneyPlugin
import PingBinding
import PingStorage
import PingLogger
import React
import RNPingCore

/// Shared device binding and signing-verifier execution logic for React Native iOS bridges.
///
/// Delegates to focused extension files:
/// - `BindingEventBridge.swift`  — bridge collectors, event emission, PIN/key lifecycle
/// - `BindingOptionParser.swift` — option/config parsing and DeviceBindingConfig application
/// - `BindingErrorMapper.swift`  — error code resolution and journey result payload
@objcMembers
public class RNPingBindingCommon: NSObject {

  // MARK: - Event bridge state

  private static let lock = NSLock()
  // nonisolated(unsafe): manually guarded by `lock`.
  nonisolated(unsafe) private static var pendingPinRequests: [String: (String?) -> Void] = [:]
  nonisolated(unsafe) private static var pendingUserKeyRequests: [String: (String?) -> Void] = [:]

  /// Posts a `RNPingBinding_NativeEmit` notification that the ObjC emitter gate forwards to
  /// `RCTDeviceEventEmitter`, making it available to JS `DeviceEventEmitter` on both architectures.
  ///
  /// - Parameters:
  ///   - name: The event name (e.g. `RNPingBinding_PinRequired`).
  ///   - body: The event payload dictionary.
  static func emitEvent(_ name: String, body: [String: Any]) {
    NotificationCenter.default.post(
      name: nativeEmitNotification,
      object: nil,
      userInfo: ["eventName": name, "eventBody": body]
    )
  }

  /// Stores a PIN completion handler under `requestId` so it can be fulfilled by `resolvePin` or `cancelPin`.
  static func storePinCompletion(requestId: String, completion: @escaping (String?) -> Void) {
    lock.lock(); defer { lock.unlock() }
    pendingPinRequests[requestId] = completion
  }

  /// Fulfils the pending PIN request identified by `requestId` with the provided `pin`.
  /// Called from the JS-facing ObjC bridge when the user confirms a PIN.
  @objc public static func resolvePin(requestId: String, pin: String) {
    lock.lock()
    let completion = pendingPinRequests.removeValue(forKey: requestId)
    lock.unlock()
    completion?(pin)
  }

  /// Cancels the pending PIN request identified by `requestId` (completes with `nil`).
  /// Called from the JS-facing ObjC bridge when the user dismisses the PIN dialog.
  @objc public static func cancelPin(requestId: String) {
    lock.lock()
    let completion = pendingPinRequests.removeValue(forKey: requestId)
    lock.unlock()
    completion?(nil)
  }

  /// Stores a user-key selection completion handler under `requestId` so it can be fulfilled by
  /// `resolveUserKey` or `cancelUserKey`.
  static func storeUserKeyCompletion(requestId: String, completion: @escaping (String?) -> Void) {
    lock.lock(); defer { lock.unlock() }
    pendingUserKeyRequests[requestId] = completion
  }

  /// Fulfils the pending user-key selection request identified by `requestId` with `keyId`.
  /// Called from the JS-facing ObjC bridge when the user selects a key.
  @objc public static func resolveUserKey(requestId: String, keyId: String) {
    lock.lock()
    let completion = pendingUserKeyRequests.removeValue(forKey: requestId)
    lock.unlock()
    completion?(keyId)
  }

  /// Cancels the pending user-key selection request identified by `requestId` (completes with `nil`).
  /// Called from the JS-facing ObjC bridge when the user dismisses the key selector.
  @objc public static func cancelUserKey(requestId: String) {
    lock.lock()
    let completion = pendingUserKeyRequests.removeValue(forKey: requestId)
    lock.unlock()
    completion?(nil)
  }

  // MARK: - Journey operations

  /// Executes a `DeviceBindingCallback` for the active journey identified by `journeyId`.
  ///
  /// - Parameters:
  ///   - journeyId: The identifier of the active journey session.
  ///   - options: Binding options (deviceName, appPin, biometric, jwt).
  ///   - config: Per-call config (loggerId, hasPinCollector, userKeyStorageId).
  ///   - resolver: Promise resolver called on success with `{ "type": "success" }`.
  ///   - rejecter: Promise rejecter called on failure with a `BindingErrorCode`.
  @objc
  @MainActor
  public static func bindForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    if journeyId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      handlers.reject(GenericError(
        type: .argumentError,
        error: BindingErrorCode.callbackNotFound.rawValue,
        message: "Journey id must not be empty for device binding."
      ))
      return
    }

    let callbackIndex = parseCallbackIndex(options)
    let loggerId = parseLoggerId(config)
    let hasPinCollector = config["hasPinCollector"] as? Bool == true
    let userKeyStorageId = parseStringConfig(config, key: "userKeyStorageId")

    guard PresentationAnchorResolver.resolveForegroundWindowAnchor() != nil else {
      handlers.reject(GenericError(
        type: .bindingError,
        error: BindingErrorCode.uiUnavailable.rawValue,
        message: "No active application window is available for Journey device binding."
      ))
      return
    }

    Task { @MainActor in
      guard let callback = await resolveDeviceBindingCallback(journeyId: journeyId, index: callbackIndex) else {
        handlers.reject(GenericError(
          type: .stateError,
          error: BindingErrorCode.callbackNotFound.rawValue,
          message: "No active DeviceBindingCallback found for journey \(journeyId)."
        ))
        return
      }
      let jsDeviceName = parseStringOption(options, key: "deviceName")
      let resolvedLogger = await resolveLoggerFromCore(loggerId)
      let parsedAppPin = parseAppPinOptions(options)
      let parsedBiometric = parseBiometricOptions(options)
      let parsedJwt = parseJwtOptions(options)
      let resolvedUserKeyStorage = await resolveUserKeyStorageFromCore(userKeyStorageId)

      let result = await callback.bind { @Sendable config in
        setLoggerIfSupported(config as AnyObject, logger: resolvedLogger)
        if let name = jsDeviceName { config.deviceName = name }
        applyCommonBindingConfig(
          nativeConfig: config, appPin: parsedAppPin, biometric: parsedBiometric,
          jwt: parsedJwt, resolvedUserKeyStorage: resolvedUserKeyStorage
        )
        if hasPinCollector {
          let bridgeConfig = buildBridgeAppPinConfig(
            title: callback.title,
            subtitle: callback.subtitle,
            description: callback.description,
            appPin: parsedAppPin
          )
          config.authenticatorConfig = bridgeConfig
        }
      }
      switch result {
      case .success:
        handlers.resolve(createJourneyResultPayload(type: "success"))
      case .failure(let error):
        let code = resolveBindingErrorCode(error, defaultCode: .bindError)
        handlers.reject(
          GenericError(type: .bindingError, error: code.rawValue, message: error.localizedDescription),
          underlying: error as NSError
        )
      }
    }
  }

  /// Executes a `DeviceSigningVerifierCallback` for the active journey identified by `journeyId`.
  ///
  /// - Parameters:
  ///   - journeyId: The identifier of the active journey session.
  ///   - options: Signing options (claims, appPin, biometric, jwt).
  ///   - config: Per-call config (loggerId, hasPinCollector, hasUserKeySelector, userKeyStorageId).
  ///   - resolver: Promise resolver called on success with `{ "type": "success" }`.
  ///   - rejecter: Promise rejecter called on failure with a `BindingErrorCode`.
  @objc
  @MainActor
  public static func signForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    if journeyId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      handlers.reject(GenericError(
        type: .argumentError,
        error: BindingErrorCode.callbackNotFound.rawValue,
        message: "Journey id must not be empty for device signing."
      ))
      return
    }

    let callbackIndex = parseCallbackIndex(options)
    let loggerId = parseLoggerId(config)
    let hasPinCollector = config["hasPinCollector"] as? Bool == true
    let hasUserKeySelector = config["hasUserKeySelector"] as? Bool == true
    let userKeyStorageId = parseStringConfig(config, key: "userKeyStorageId")

    guard PresentationAnchorResolver.resolveForegroundWindowAnchor() != nil else {
      handlers.reject(GenericError(
        type: .bindingError,
        error: BindingErrorCode.uiUnavailable.rawValue,
        message: "No active application window is available for Journey device signing."
      ))
      return
    }

    Task { @MainActor in
      guard let callback = await resolveDeviceSigningVerifierCallback(journeyId: journeyId, index: callbackIndex) else {
        handlers.reject(GenericError(
          type: .stateError,
          error: BindingErrorCode.callbackNotFound.rawValue,
          message: "No active DeviceSigningVerifierCallback found for journey \(journeyId)."
        ))
        return
      }
      // `[String: Any]` is not Sendable in strict concurrency, but the dict
      // is constructed locally from JS primitives and only read inside the
      // closure — safe to bridge with `nonisolated(unsafe)`.
      nonisolated(unsafe) let jsClaims = parseClaims(options)
      let resolvedLogger = await resolveLoggerFromCore(loggerId)
      let parsedAppPin = parseAppPinOptions(options)
      let parsedBiometric = parseBiometricOptions(options)
      let parsedJwt = parseJwtOptions(options)
      let resolvedUserKeyStorage = await resolveUserKeyStorageFromCore(userKeyStorageId)

      let result = await callback.sign { @Sendable config in
        setLoggerIfSupported(config as AnyObject, logger: resolvedLogger)
        if !jsClaims.isEmpty { config.claims = jsClaims }
        applyCommonBindingConfig(
          nativeConfig: config, appPin: parsedAppPin, biometric: parsedBiometric,
          jwt: parsedJwt, resolvedUserKeyStorage: resolvedUserKeyStorage
        )
        if hasPinCollector {
          let bridgeConfig = buildBridgeAppPinConfig(
            title: callback.title,
            subtitle: callback.subtitle,
            description: callback.description,
            appPin: parsedAppPin
          )
          config.authenticatorConfig = bridgeConfig
        }
        if hasUserKeySelector {
          config.userKeySelector = BridgeUserKeySelector()
        }
      }
      switch result {
      case .success:
        handlers.resolve(createJourneyResultPayload(type: "success"))
      case .failure(let error):
        let code = resolveBindingErrorCode(error, defaultCode: .signError)
        handlers.reject(
          GenericError(type: .bindingError, error: code.rawValue, message: error.localizedDescription),
          underlying: error as NSError
        )
      }
    }
  }

  // MARK: - Key management

  /// Returns all locally stored device binding keys as a JS array.
  ///
  /// Each element is a dict with `id`, `userId`, `username`, and `authenticationType`.
  ///
  /// - Parameters:
  ///   - resolver: Promise resolver called with the array on success.
  ///   - rejecter: Promise rejecter called with `BINDING_KEY_DELETE_ERROR` on failure.
  @objc
  public static func getAllKeys(
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSArray>(resolver: resolver, rejecter: rejecter)
    Task {
      do {
        let keys = try await BindingModule.getAllKeys()
        let result: NSArray = keys.map { key -> [String: Any] in
          ["id": key.id, "userId": key.userId, "username": key.username, "authenticationType": key.authType.rawValue]
        } as NSArray
        handlers.resolve(result)
      } catch {
        handlers.reject(
          GenericError(type: .bindingError, error: BindingErrorCode.keyDeleteError.rawValue, message: error.localizedDescription),
          underlying: error as NSError
        )
      }
    }
  }

  /// Deletes the device binding key identified by `userId` and `keyId` from the Keychain.
  ///
  /// - Parameters:
  ///   - userId: The user ID associated with the key.
  ///   - keyId: The unique key ID.
  ///   - resolver: Promise resolver called with `null` on success.
  ///   - rejecter: Promise rejecter called with `BINDING_KEY_DELETE_ERROR` when the key is not found
  ///     or deletion fails.
  @objc
  public static func deleteKey(
    userId: String,
    keyId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSNull>(resolver: resolver, rejecter: rejecter)
    Task {
      do {
        let keys = try await BindingModule.getAllKeys()
        guard let key = keys.first(where: { $0.id == keyId && $0.userId == userId }) else {
          handlers.reject(GenericError(
            type: .stateError,
            error: BindingErrorCode.keyDeleteError.rawValue,
            message: "No binding key found for userId=\(userId) keyId=\(keyId)."
          ))
          return
        }
        try await BindingModule.deleteKey(key)
        handlers.resolve(NSNull())
      } catch {
        handlers.reject(
          GenericError(type: .bindingError, error: BindingErrorCode.keyDeleteError.rawValue, message: error.localizedDescription),
          underlying: error as NSError
        )
      }
    }
  }

  /// Deletes all locally stored device binding keys from the Keychain.
  ///
  /// - Parameters:
  ///   - resolver: Promise resolver called with `null` on success.
  ///   - rejecter: Promise rejecter called with `BINDING_KEY_DELETE_ERROR` on failure.
  @objc
  public static func deleteAllKeys(
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSNull>(resolver: resolver, rejecter: rejecter)
    Task {
      do {
        try await BindingModule.deleteAllKeys()
        handlers.resolve(NSNull())
      } catch {
        handlers.reject(
          GenericError(type: .bindingError, error: BindingErrorCode.keyDeleteError.rawValue, message: error.localizedDescription),
          underlying: error as NSError
        )
      }
    }
  }

  // MARK: - Callback resolvers

  /// Fetches the `DeviceBindingCallback` at `index` from the active journey session.
  private static func resolveDeviceBindingCallback(journeyId: String, index: Int) async -> DeviceBindingCallback? {
    guard let callbacks = await CoreRuntime.resolveJourneyCallbacks(journeyId) else { return nil }
    let matching = callbacks.compactMap { $0 as? DeviceBindingCallback }
    guard index >= 0, index < matching.count else { return nil }
    return matching[index]
  }

  /// Fetches the `DeviceSigningVerifierCallback` at `index` from the active journey session.
  private static func resolveDeviceSigningVerifierCallback(journeyId: String, index: Int) async -> DeviceSigningVerifierCallback? {
    guard let callbacks = await CoreRuntime.resolveJourneyCallbacks(journeyId) else { return nil }
    let matching = callbacks.compactMap { $0 as? DeviceSigningVerifierCallback }
    guard index >= 0, index < matching.count else { return nil }
    return matching[index]
  }

  /// Builds App PIN config for JS collector while preserving callback prompt text as the baseline.
  /// Optional JS `appPin.prompt` values may override callback prompt fields.
  private static func buildBridgeAppPinConfig(
    title: String,
    subtitle: String,
    description: String,
    appPin: ParsedAppPinOptions?
  ) -> AppPinConfig {
    let bridgeConfig = AppPinConfig(pinCollector: BridgePinCollector())
    bridgeConfig.prompt = Prompt(title: title, subtitle: subtitle, description: description)
    if let appPin { configureAppPinConfig(bridgeConfig, appPin: appPin) }
    return bridgeConfig
  }

#if DEBUG
  public static func _test_buildBridgePrompt(_ payload: NSDictionary) -> NSDictionary {
    let title = (payload["title"] as? String) ?? ""
    let subtitle = (payload["subtitle"] as? String) ?? ""
    let description = (payload["description"] as? String) ?? ""
    let appPin = parseAppPinOptions(payload)
    let config = buildBridgeAppPinConfig(
      title: title,
      subtitle: subtitle,
      description: description,
      appPin: appPin
    )
    return [
      "promptTitle": config.prompt.title,
      "promptSubtitle": config.prompt.subtitle,
      "promptDescription": config.prompt.description,
    ]
  }
#endif
}
