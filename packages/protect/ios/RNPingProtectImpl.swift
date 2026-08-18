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
  }

  // TODO: Add invalidate() to cancel in-flight Tasks and reset module state on React context teardown
  // once PingOneProtect exposes a public cleanup/teardown API. Currently Protect has no public
  // teardown method (internal reset() is not part of the public API).

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
