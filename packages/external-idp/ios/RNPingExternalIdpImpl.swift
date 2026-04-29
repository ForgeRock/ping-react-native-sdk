/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import React

/// Swift entry point for the External IdP native module.
@objcMembers
public final class RNPingExternalIdpImpl: NSObject, Sendable {

  /// Shared singleton instance.
  @objc public static let shared = RNPingExternalIdpImpl()

  /// Creates a singleton bridge implementation instance.
  @objc private override init() {
    super.init()
  }

  /// Launches the external IdP authorization flow for an active Journey `IdpCallback`.
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Callback execution options.
  ///   - config: Per-call runtime configuration payload.
  ///   - resolve: Promise resolver for the authorization result.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public func authorizeForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingExternalIdpCommon.authorizeForJourney(
      journeyId,
      options: options,
      config: config,
      resolver: resolve,
      rejecter: rejecter
    )
  }

  /// Mutates the native `SelectIdpCallback` state for an active Journey.
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - provider: Provider identifier selected by the user.
  ///   - options: Callback execution options.
  ///   - config: Per-call runtime configuration payload.
  ///   - resolve: Promise resolver for completion.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public func selectProviderForJourney(
    _ journeyId: String,
    provider: String,
    options: NSDictionary,
    config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingExternalIdpCommon.selectProviderForJourney(
      journeyId,
      provider: provider,
      options: options,
      config: config,
      resolver: resolve,
      rejecter: rejecter
    )
  }
}
