/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import React

/// Swift entry point for the Protect native module.
@objcMembers
public final class RNPingProtectImpl: NSObject, Sendable {

  /// Shared singleton instance.
  @objc public static let shared = RNPingProtectImpl()

  /// Creates a singleton bridge implementation instance.
  @objc private override init() {
    super.init()
    RNPingProtectCommon.registerDaVinciSerializer()
  }

  // TODO: Add invalidate() to cancel in-flight Tasks and reset module state on React context teardown
  // once PingOneProtect exposes a public cleanup/teardown API. Verified against PingOneProtect 2.1.0:
  // the only available methods are initialize(), data(), pauseBehavioralData(), resumeBehavioralData().
  // The internal reset() is not public. Re-evaluate when upgrading PingOneProtect. When invalidate()
  // is added it must also call CoreRuntime.unregisterDaVinciModuleHook(key: protectLifecycleKey) so the lifecycle
  // hook registered with the last initialize() config does not outlive the module (mirrors Android
  // RNPingProtectCommon.cleanup()).

  /// Runs Protect SDK data collection for the active `ProtectCollector` in a DaVinci flow.
  /// - Parameters:
  ///   - davinciId: Native DaVinci instance id.
  ///   - options: Per-call options payload.
  ///   - config: Per-client runtime configuration payload.
  ///   - resolve: Promise resolver for void completion.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public func collectForDaVinci(
    _ davinciId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingProtectCommon.collectForDaVinci(
      davinciId,
      options: options,
      config: config,
      resolver: resolve,
      rejecter: rejecter
    )
  }

  /// Runs PingOne Protect data collection for a Journey evaluation callback.
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Per-call options payload (`index`).
  ///   - config: Per-client runtime configuration payload.
  ///   - resolve: Promise resolver for the `{ type: "success" }` result.
  ///   - rejecter: Promise rejecter for errors.
  // NOTE: @MainActor matches the isolation of `RNPingProtectCommon.collectForJourney`, which this forwards to.
  @objc
  @MainActor
  public func collectForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingProtectCommon.collectForJourney(
      journeyId,
      options: options,
      config: config,
      resolver: resolve,
      rejecter: rejecter
    )
  }

  /// Executes a Journey initialize callback using the configuration carried by the callback.
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - config: Per-client runtime configuration payload.
  ///   - resolve: Promise resolver for the `{ type: "success" }` result.
  ///   - rejecter: Promise rejecter for errors.
  // NOTE: @MainActor matches the isolation of `RNPingProtectCommon.initializeForJourney`, which this forwards to.
  @objc
  @MainActor
  public func initializeForJourney(
    _ journeyId: String,
    config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingProtectCommon.initializeForJourney(
      journeyId,
      config: config,
      resolver: resolve,
      rejecter: rejecter
    )
  }

  /// Initializes the Protect SDK with the provided configuration.
  /// - Parameters:
  ///   - protectConfig: Protect SDK initialization config dictionary.
  ///   - config: Per-client runtime configuration payload.
  ///   - resolve: Promise resolver for void completion.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public func initialize(
    _ protectConfig: NSDictionary,
    config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingProtectCommon.initialize(protectConfig, config: config, resolver: resolve, rejecter: rejecter)
  }

  /// Pauses behavioral data collection.
  /// - Parameters:
  ///   - config: Per-client runtime configuration payload.
  ///   - resolve: Promise resolver for void completion.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public func pauseBehavioralData(
    _ config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingProtectCommon.pauseBehavioralData(config, resolver: resolve, rejecter: rejecter)
  }

  /// Resumes behavioral data collection.
  /// - Parameters:
  ///   - config: Per-client runtime configuration payload.
  ///   - resolve: Promise resolver for void completion.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public func resumeBehavioralData(
    _ config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingProtectCommon.resumeBehavioralData(config, resolver: resolve, rejecter: rejecter)
  }

}
