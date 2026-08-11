/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
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
}

/// Shared iOS implementation for the Ping Protect React Native module.
public class RNPingProtectCommon: NSObject {
  private static let loggerIdKey = "loggerId"

  /// Stable error codes emitted by the Protect module.
  ///
  /// Keep these in sync with JS `ProtectErrorCode` and Android `ProtectErrorCodes`.
  private enum ProtectErrorCode: String {
    case collectError = "PROTECT_COLLECT_ERROR"
    case collectorNotFound = "PROTECT_COLLECTOR_NOT_FOUND"
    case initializeError = "PROTECT_INITIALIZE_ERROR"
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

    let collectorIndex = parseCollectorIndex(options)

    // `@objc` methods cannot be declared `async`, so a Task is required to
    // enter the async context. The body runs off the main actor so that
    // `Protect.initialize()` and `Protect.data()` do not block the UI thread.
    // `PromiseBridge.resolve/reject` are safe to call from any thread.
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
            error: ProtectErrorCode.initializeError.rawValue,
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
            error: ProtectErrorCode.initializeError.rawValue,
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

  /// Parses per-call bridge configuration from the React Native payload.
  /// - Parameter config: Raw bridge configuration dictionary.
  /// - Returns: Trimmed call configuration values.
  static func parseCallConfig(_ config: NSDictionary) -> ProtectCallConfig {
    let trimmed = (config[loggerIdKey] as? String)?
      .trimmingCharacters(in: .whitespacesAndNewlines)
    let loggerId = (trimmed?.isEmpty == false) ? trimmed : nil
    return ProtectCallConfig(loggerId: loggerId)
  }

  /// Parses collector index from call options.
  ///
  /// - Parameter options: Per-call options payload.
  /// - Returns: Parsed collector index, defaulting to 0.
  static func parseCollectorIndex(_ options: NSDictionary) -> Int {
    if let value = options["index"] as? NSNumber {
      return value.intValue
    }
    if let value = options["index"] as? String, let parsed = Int(value) {
      return parsed
    }
    return 0
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
    return ProtectInitConfig(
      envId: envId,
      isBehavioralDataCollection: isBehavioralDataCollection,
      isLazyMetadata: isLazyMetadata,
      customHost: customHost,
      isConsoleLogEnabled: isConsoleLogEnabled,
      deviceAttributesToIgnore: deviceAttributesToIgnore
    )
  }
}
