/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingDavinci
import PingDavinciPlugin
import PingJourneyPlugin
import PingLogger
import PingOneProtect
import React
import RNPingCore

/// Per-call Protect runtime configuration resolved from the JS bridge payload.
struct ProtectCallConfig {
  /// Optional logger handle identifier forwarded from JS.
  let loggerId: String?
}

/// Protect SDK initialization configuration parsed from the JS bridge payload.
struct ProtectInitConfig: Sendable {
  let envId: String?
  let isBehavioralDataCollection: Bool
  let isLazyMetadata: Bool
  let customHost: String?
  let isConsoleLogEnabled: Bool
  let deviceAttributesToIgnore: [String]
  let pauseBehavioralDataOnSuccess: Bool
  let resumeBehavioralDataOnStart: Bool
}

/// Identifies which bridge path completed the native Protect initialization.
enum InitializationSource: String, Sendable {
  /// Initialized through the bridge `initialize` method using app-supplied config.
  case appConfig = "app config"
  /// Initialized through `initializeForJourney` using the Journey tree's callback config.
  case journeyTreeConfig = "Journey tree config"
}

/// Tracks which bridge path initialized the native Protect SDK.
///
/// The first successful source wins. A later success from a different source logs a
/// warning and never rejects, matching native behavior where the second call returns success.
///
/// - Note: The state is never reset in production because native Protect state persists and
///   has no teardown API. Only initialization through this module's own paths counts: app
///   config via `initialize` or Journey tree config via `initializeForJourney`.
///   Initialization performed internally by the DaVinci `ProtectCollector` is deliberately
///   not tracked, because its config block carries collector-local settings only and no
///   identity configuration such as envId.
actor ProtectInitializationState {
  /// Shared process-wide instance.
  static let shared = ProtectInitializationState()

  /// Source that first completed initialization, or `nil` when none has been observed.
  private(set) var initializedBy: InitializationSource?

  /// Records a successful native initialization.
  ///
  /// - Parameters:
  ///   - source: Bridge path that just completed initialization.
  ///   - logger: Optional native logger used for the cross-source warning.
  func markInitialized(from source: InitializationSource, logger: PingLogger.Logger?) {
    guard let previous = initializedBy else {
      initializedBy = source
      return
    }
    guard previous != source else { return }
    logger?.w(
      "Protect already initialized by \(previous.rawValue); native initialize is once-only, "
        + "so the identity config (envId, customHost, deviceAttributesToIgnore, consoleLogEnabled, "
        + "lazyMetadata) from \(source.rawValue) was not applied; only behavioral-data "
        + "resume/pause, where that path performs it, took effect",
      error: nil
    )
  }

  /// Clears the recorded source so tests can start from a clean state.
  func resetForTesting() {
    initializedBy = nil
  }
}

/// Shared iOS implementation for the Ping Protect React Native module.
private final class SerializerState: @unchecked Sendable {
  private let lock = NSLock()
  private var registered = false

  func register(_ action: () -> Void) {
    lock.lock()
    defer { lock.unlock() }
    guard !registered else { return }
    registered = true
    action()
  }
}

public class RNPingProtectCommon: NSObject {
  private static let loggerIdKey = "loggerId"
  private static let serializerState = SerializerState()

  /// Stable registry key identifying the Protect DaVinci lifecycle module.
  private static let protectLifecycleKey = "protect"

  /// Stable error codes emitted by the Protect module.
  ///
  /// Keep these in sync with JS `ProtectErrorCode` and Android `ProtectErrorCodes`.
  private enum ProtectErrorCode: String {
    case collectError = "PROTECT_COLLECT_ERROR"
    case collectorNotFound = "PROTECT_COLLECTOR_NOT_FOUND"
    case initializeError = "PROTECT_INITIALIZE_ERROR"
    case notInitialized = "PROTECT_NOT_INITIALIZED"
    case callbackNotFound = "PROTECT_CALLBACK_NOT_FOUND"
    case argumentError = "PROTECT_ARGUMENT_ERROR"
  }

  /// Options key holding the zero-based Journey callback index.
  private static let indexKey = "index"

  /// Registers the PingOne Protect Journey callbacks with the native callback registry.
  ///
  /// The promise resolves only after both callback types are present in the registry, so a
  /// Journey `start()` issued afterwards always parses them.
  ///
  /// - Parameters:
  ///   - resolver: Promise resolver for void completion.
  ///   - rejecter: Promise rejecter for errors.
  /// - Note: The native `ProtectCallbacks.registerCallbacks()` is internal and schedules the
  ///   registration in an unawaited `Task`, so the bridge registers the same public callback
  ///   types directly and awaits the registry.
  // TODO-PARITY: iOS has no launch-time registration for Protect callbacks (Android registers
  // at app launch via androidx.startup). Native Journey probes optional modules by name and its
  // Protect probe does not match the class's module-qualified name ("PingProtect.ProtectCallbacks"
  // vs the real "PingOneProtect.ProtectCallbacks"; the naming difference is intentional upstream
  // as the PingProtect name is taken by the legacy iOS SDK), so native never registers Protect
  // callbacks and the bridge does it here instead.
  @objc
  public static func registerJourneyCallbacks(
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSNull>(resolver: resolver, rejecter: rejecter)
    Task {
      await registerJourneyCallbackTypes()
      handlers.resolve(NSNull())
    }
  }

  /// Registers the Protect initialize and evaluation callbacks with `CallbackRegistry`.
  static func registerJourneyCallbackTypes() async {
    await CallbackRegistry.shared.register(
      type: JourneyConstants.pingOneProtectInitializeCallback,
      callback: PingOneProtectInitializeCallback.self
    )
    await CallbackRegistry.shared.register(
      type: JourneyConstants.pingOneProtectEvaluationCallback,
      callback: PingOneProtectEvaluationCallback.self
    )
  }

  /// Registers the Protect collector serializer with the generic DaVinci mapper.
  @objc public static func registerDaVinciSerializer() {
    serializerState.register {
      CoreRuntime.registerDaVinciCollectorSerializer { collectorAny in
        guard let collector = collectorAny as? ProtectCollector else { return nil }
        return ["key": collector.id, "type": "PROTECT"]
      }
    }
  }

  /// Runs Protect SDK data collection for the active `ProtectCollector` in a DaVinci flow.
  ///
  /// The collected payload is set internally on the native collector so that
  /// `daVinci.next({})` picks it up automatically via `collector.payload()`.
  ///
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - options: Per-call options payload.
  ///   - config: Per-client runtime configuration payload.
  ///   - resolver: Promise resolver for void completion.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public static func collectForDaVinci(
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
          error: ProtectErrorCode.collectorNotFound.rawValue,
          message: "DaVinci id must not be empty for Protect data collection."
        )
      )
      return
    }

    let collectorIndex = 0

    // `@objc` methods cannot be declared `async`, so a Task is required to
    // enter the async context. The Task inherits @MainActor isolation from the
    // enclosing function — it does NOT run off the main actor.
    // TODO-PARITY: Android runs collectForDaVinci on Dispatchers.IO; iOS runs on main actor.
    Task {
      let logger = await resolveLoggerFromCore(callConfig.loggerId)
      logger?.i("Protect collectForDaVinci requested for collector index \(collectorIndex)")

      guard let collectors = await CoreRuntime.resolveDaVinciCollectors(davinciId) else {
        logger?.w("Protect collectForDaVinci collectors not found for davinciId \(davinciId)", error: nil)
        handlers.reject(
          GenericError(
            type: .stateError,
            error: ProtectErrorCode.collectorNotFound.rawValue,
            message: "No active DaVinci collectors found for id \(davinciId)."
          )
        )
        return
      }

      let matching = collectors.compactMap { $0 as? ProtectCollector }
      guard collectorIndex >= 0, collectorIndex < matching.count else {
        logger?.w("Protect collectForDaVinci collector not found at index \(collectorIndex)", error: nil)
        handlers.reject(
          GenericError(
            type: .stateError,
            error: ProtectErrorCode.collectorNotFound.rawValue,
            message: "No active Protect collector found for DaVinci \(davinciId) at index \(collectorIndex)."
          )
        )
        return
      }

      let collector = matching[collectorIndex]
      let result = await collector.collect()
      switch result {
      case .success:
        logger?.d("Protect collectForDaVinci succeeded")
        handlers.resolve(NSNull())

      case .failure(let error):
        logger?.e("Protect collectForDaVinci failed", error: error as NSError)
        // ProtectException has no subtype hierarchy — .authError is the correct
        // default and matches Android's mapThrowableToGenericError output.
        handlers.reject(
          GenericError(
            type: .authError,
            error: ProtectErrorCode.collectError.rawValue,
            message: error.localizedDescription
          ),
          underlying: error as NSError
        )
      }
    }
  }

  /// Runs PingOne Protect data collection for a Journey evaluation callback.
  ///
  /// The collected risk signal is written natively into the callback and is never returned
  /// to JavaScript; the promise resolves with `["type": "success"]`.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Per-call options payload (`index`).
  ///   - config: Per-client runtime configuration payload (`loggerId`).
  ///   - resolver: Promise resolver for the result payload.
  ///   - rejecter: Promise rejecter for errors.
  /// - Note: Rejects with `PROTECT_ARGUMENT_ERROR`, `PROTECT_CALLBACK_NOT_FOUND`,
  ///   `PROTECT_NOT_INITIALIZED`, or `PROTECT_COLLECT_ERROR`. Initialization performed outside the bridge, for example by the
  ///   DaVinci `ProtectCollector`, is not observable and results in `PROTECT_NOT_INITIALIZED`.
  @objc
  @MainActor
  public static func collectForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let callConfig = parseCallConfig(config)
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    // `@objc` methods cannot be declared `async`, so a Task is required to
    // enter the async context. The Task inherits @MainActor isolation from the
    // enclosing function and does NOT run off the main actor.
    // @MainActor is kept for consistency with the other Protect entry points, so the
    // Protect SDK calls (which run the Signals data collection) are issued from a single
    // serial context; the native Journey callback itself has no UI or Activity dependency.
    // TODO-PARITY: Android runs collectForJourney on Dispatchers.IO; iOS runs on main actor.
    Task {
      let logger = await resolveLoggerFromCore(callConfig.loggerId)
      if journeyId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        logger?.w("Protect collectForJourney rejected because Journey id was empty", error: nil)
        handlers.reject(
          GenericError(
            type: .argumentError,
            error: ProtectErrorCode.argumentError.rawValue,
            message: "Journey id must not be empty for Protect data collection."
          )
        )
        return
      }
      logger?.i("Protect collectForJourney requested")

      let callbackIndex = journeyIndex(options, logger: logger)

      let callbacks = await CoreRuntime.resolveJourneyCallbacks(journeyId) ?? []
      let matching = callbacks.compactMap { $0 as? PingOneProtectEvaluationCallback }
      guard matching.indices.contains(callbackIndex) else {
        logger?.w("Protect collectForJourney callback not found at index \(callbackIndex)", error: nil)
        handlers.reject(
          GenericError(
            type: .stateError,
            error: ProtectErrorCode.callbackNotFound.rawValue,
            message: "No active Protect evaluation callback found for Journey \(journeyId) at index \(callbackIndex)."
          )
        )
        return
      }

      guard await ProtectInitializationState.shared.initializedBy != nil else {
        logger?.w("Protect collectForJourney rejected because Protect was not initialized by the bridge", error: nil)
        handlers.reject(
          GenericError(
            type: .stateError,
            error: ProtectErrorCode.notInitialized.rawValue,
            message: "Protect has not been initialized. Call initializeProtectForJourney() before collecting."
          )
        )
        return
      }

      let result = await matching[callbackIndex].collect()
      switch result {
      case .success:
        logger?.d("Protect collectForJourney succeeded")
        handlers.resolve(createJourneyResultPayload())

      case .failure(let error):
        logger?.e("Protect collectForJourney failed", error: error as NSError)
        handlers.reject(
          GenericError(
            type: .authError,
            error: ProtectErrorCode.collectError.rawValue,
            message: error.localizedDescription
          ),
          underlying: error as NSError
        )
      }
    }
  }

  /// Executes a Journey initialize callback using the configuration carried by the callback.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - config: Per-client runtime configuration payload (`loggerId`).
  ///   - resolver: Promise resolver for the result payload.
  ///   - rejecter: Promise rejecter for errors.
  /// - Note: Rejects with `PROTECT_ARGUMENT_ERROR`, `PROTECT_CALLBACK_NOT_FOUND`, or
  ///   `PROTECT_INITIALIZE_ERROR`. When Protect
  ///   was already initialized by the other bridge path the call still succeeds and a warning is
  ///   logged, because native initialization is once-only.
  // NOTE: @MainActor keeps Protect initialization on the same serial context as `initialize`
  // and `collectForJourney`; the native initialize callback has no UI dependency.
  @objc
  @MainActor
  public static func initializeForJourney(
    _ journeyId: String,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let callConfig = parseCallConfig(config)
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    Task {
      let logger = await resolveLoggerFromCore(callConfig.loggerId)
      if journeyId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        logger?.w("Protect initializeForJourney rejected because Journey id was empty", error: nil)
        handlers.reject(
          GenericError(
            type: .argumentError,
            error: ProtectErrorCode.argumentError.rawValue,
            message: "Journey id must not be empty for Protect initialization."
          )
        )
        return
      }
      logger?.i("Protect initializeForJourney requested")

      let callbacks = await CoreRuntime.resolveJourneyCallbacks(journeyId) ?? []
      guard let callback = callbacks.compactMap({ $0 as? PingOneProtectInitializeCallback }).first else {
        logger?.w("Protect initializeForJourney callback not found", error: nil)
        handlers.reject(
          GenericError(
            type: .stateError,
            error: ProtectErrorCode.callbackNotFound.rawValue,
            message: "No active Protect initialize callback found for Journey \(journeyId)."
          )
        )
        return
      }

      let result = await callback.start()
      switch result {
      case .success:
        await ProtectInitializationState.shared.markInitialized(from: .journeyTreeConfig, logger: logger)
        logger?.d("Protect initializeForJourney succeeded")
        handlers.resolve(createJourneyResultPayload())

      case .failure(let error):
        logger?.e("Protect initializeForJourney failed", error: error as NSError)
        handlers.reject(
          GenericError(
            type: .authError,
            error: ProtectErrorCode.initializeError.rawValue,
            message: error.localizedDescription
          ),
          underlying: error as NSError
        )
      }
    }
  }

  /// Initializes the Protect SDK with the provided configuration.
  ///
  /// - Parameters:
  ///   - davinciId: Unused placeholder kept for uniform ObjC signature pattern.
  ///   - protectConfig: Protect SDK initialization config dictionary.
  ///   - config: Per-client runtime configuration payload.
  ///   - resolver: Promise resolver for void completion.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public static func initialize(
    _ protectConfig: NSDictionary,
    config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let callConfig = parseCallConfig(config)
    let handlers = PromiseBridge<NSNull>(resolver: resolver, rejecter: rejecter)
    let initConfig = parseProtectInitConfig(protectConfig)

    Task {
      let logger = await resolveLoggerFromCore(callConfig.loggerId)
      logger?.i("Protect initialize requested")
      do {
        await Protect.config { @Sendable c in
          c.envId = initConfig.envId
          c.isBehavioralDataCollection = initConfig.isBehavioralDataCollection
          c.isLazyMetadata = initConfig.isLazyMetadata
          c.customHost = initConfig.customHost
          c.isConsoleLogEnabled = initConfig.isConsoleLogEnabled
          c.deviceAttributesToIgnore = initConfig.deviceAttributesToIgnore
        }
        try await Protect.initialize()
        await ProtectInitializationState.shared.markInitialized(from: .appConfig, logger: logger)
        registerDaVinciModuleHook(initConfig)
        logger?.d("Protect initialize succeeded")
        handlers.resolve(NSNull())
      } catch {
        logger?.e("Protect initialize failed", error: error as NSError)
        handlers.reject(
          GenericError(
            type: .authError,
            error: ProtectErrorCode.initializeError.rawValue,
            message: error.localizedDescription
          ),
          underlying: error as NSError
        )
      }
    }
  }

  /// Registers the Protect lifecycle module with the generic DaVinci hook registry.
  private static func registerDaVinciModuleHook(_ config: ProtectInitConfig) {
    CoreRuntime.registerDaVinciModuleHook(key: protectLifecycleKey) { builder in
      guard let configBuilder = builder as? DaVinciConfig else { return }
      configBuilder.module(ProtectLifecycleModule.config) { lifecycleConfig in
        lifecycleConfig.envId = config.envId
        lifecycleConfig.isBehavioralDataCollection = config.isBehavioralDataCollection
        lifecycleConfig.isLazyMetadata = config.isLazyMetadata
        lifecycleConfig.customHost = config.customHost
        lifecycleConfig.isConsoleLogEnabled = config.isConsoleLogEnabled
        lifecycleConfig.deviceAttributesToIgnore = config.deviceAttributesToIgnore
        lifecycleConfig.pauseBehavioralDataOnSuccess = config.pauseBehavioralDataOnSuccess
        lifecycleConfig.resumeBehavioralDataOnStart = config.resumeBehavioralDataOnStart
      }
    }
  }

  /// Pauses behavioral data collection.
  ///
  /// - Parameters:
  ///   - config: Per-client runtime configuration payload.
  ///   - resolver: Promise resolver for void completion.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public static func pauseBehavioralData(
    _ config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let callConfig = parseCallConfig(config)
    let handlers = PromiseBridge<NSNull>(resolver: resolver, rejecter: rejecter)

    Task {
      let logger = await resolveLoggerFromCore(callConfig.loggerId)
      // TODO-PARITY: iOS rejects if Protect is not initialized (PingOneProtect throws);
      // Android resolves silently in the same state. Align once the native SDK
      // provides a uniform initialization check.
      logger?.i("Protect pauseBehavioralData requested")
      do {
        try Protect.pauseBehavioralData()
        logger?.d("Protect pauseBehavioralData succeeded")
        handlers.resolve(NSNull())
      } catch {
        logger?.e("Protect pauseBehavioralData failed", error: error as NSError)
        handlers.reject(
          GenericError(
            type: .authError,
            error: ProtectErrorCode.collectError.rawValue,
            message: error.localizedDescription
          ),
          underlying: error as NSError
        )
      }
    }
  }

  /// Resumes behavioral data collection.
  ///
  /// - Parameters:
  ///   - config: Per-client runtime configuration payload.
  ///   - resolver: Promise resolver for void completion.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public static func resumeBehavioralData(
    _ config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let callConfig = parseCallConfig(config)
    let handlers = PromiseBridge<NSNull>(resolver: resolver, rejecter: rejecter)

    Task {
      let logger = await resolveLoggerFromCore(callConfig.loggerId)
      logger?.i("Protect resumeBehavioralData requested")
      do {
        try Protect.resumeBehavioralData()
        logger?.d("Protect resumeBehavioralData succeeded")
        handlers.resolve(NSNull())
      } catch {
        logger?.e("Protect resumeBehavioralData failed", error: error as NSError)
        handlers.reject(
          GenericError(
            type: .authError,
            error: ProtectErrorCode.collectError.rawValue,
            message: error.localizedDescription
          ),
          underlying: error as NSError
        )
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

  /// Reads the position of the evaluation callback within the node's callback list.
  ///
  /// The index is derived from the server callback list, not supplied by the app. A missing
  /// or `NSNull` index defaults to 0. A value that is not a whole number (a fractional number,
  /// a bridged boolean, or a non-numeric type) logs a warning and defaults to 0. An index outside
  /// the matching callbacks, including a negative one, is reported as callback-not-found by the
  /// caller. Negative values are not rejected here because the JS facade already validates that
  /// the index is a non-negative integer.
  ///
  /// - Parameters:
  ///   - options: Per-call options payload.
  ///   - logger: Optional logger used to report unrecognized index values.
  /// - Returns: The callback index, or 0 when none is present or the value is unrecognized.
  static func journeyIndex(_ options: NSDictionary, logger: PingLogger.Logger? = nil) -> Int {
    guard let raw = options[indexKey], !(raw is NSNull) else {
      return 0
    }
    guard let number = raw as? NSNumber,
      CFGetTypeID(number) != CFBooleanGetTypeID(),
      let index = Int(exactly: number.doubleValue)
    else {
      logger?.w(
        "Protect collectForJourney received unrecognized index \(type(of: raw)) '\(raw)'; defaulting to 0",
        error: nil
      )
      return 0
    }
    return index
  }

  /// Builds the `["type": "success"]` Journey result payload.
  ///
  /// - Returns: NSDictionary payload for JS.
  private static func createJourneyResultPayload() -> NSDictionary {
    return ["type": "success"]
  }

  /// Parses per-call bridge configuration from the React Native payload.
  /// - Parameter config: Raw bridge configuration dictionary.
  /// - Returns: Trimmed call configuration values.
  static func parseCallConfig(_ config: NSDictionary) -> ProtectCallConfig {
    let trimmed = (config[loggerIdKey] as? String)?
      .trimmingCharacters(in: .whitespacesAndNewlines)
    let loggerId = (trimmed?.isEmpty == false) ? trimmed : nil
    return ProtectCallConfig(loggerId: loggerId)
  }

  /// Parses Protect SDK initialization configuration from the JS bridge payload.
  ///
  /// - Parameter dict: Raw initialization config dictionary from JS.
  /// - Returns: Parsed Protect initialization configuration with safe defaults.
  static func parseProtectInitConfig(_ dict: NSDictionary) -> ProtectInitConfig {
    let envId = (dict["envId"] as? String).flatMap { $0.isEmpty ? nil : $0 }
    let isBehavioralDataCollection = (dict["isBehavioralDataCollection"] as? Bool) ?? true
    let isLazyMetadata = (dict["isLazyMetadata"] as? Bool) ?? false
    let customHost = (dict["customHost"] as? String).flatMap { $0.isEmpty ? nil : $0 }
    let isConsoleLogEnabled = (dict["isConsoleLogEnabled"] as? Bool) ?? false
    let deviceAttributesToIgnore = (dict["deviceAttributesToIgnore"] as? [String]) ?? []
    let pauseBehavioralDataOnSuccess = (dict["pauseBehavioralDataOnSuccess"] as? Bool) ?? false
    let resumeBehavioralDataOnStart = (dict["resumeBehavioralDataOnStart"] as? Bool) ?? false
    return ProtectInitConfig(
      envId: envId,
      isBehavioralDataCollection: isBehavioralDataCollection,
      isLazyMetadata: isLazyMetadata,
      customHost: customHost,
      isConsoleLogEnabled: isConsoleLogEnabled,
      deviceAttributesToIgnore: deviceAttributesToIgnore,
      pauseBehavioralDataOnSuccess: pauseBehavioralDataOnSuccess,
      resumeBehavioralDataOnStart: resumeBehavioralDataOnStart
    )
  }
}
