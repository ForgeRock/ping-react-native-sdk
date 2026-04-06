/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import React

/// Swift entry point for the FIDO native module.
@objcMembers
public class RNPingFidoImpl: NSObject, @unchecked Sendable {

  /// Shared singleton instance.
  @objc public static let shared = RNPingFidoImpl()

  @objc private override init() {
    super.init()
  }

  /// Registers a new FIDO credential.
  /// - Parameters:
  ///   - options: Registration options payload.
  ///   - resolve: Promise resolver for the registration result.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public func register(
    _ options: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingFidoCommon.register(options, resolver: resolve, rejecter: rejecter)
  }

  /// Authenticates with an existing FIDO credential.
  /// - Parameters:
  ///   - options: Authentication options payload.
  ///   - resolve: Promise resolver for the authentication result.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public func authenticate(
    _ options: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingFidoCommon.authenticate(options, resolver: resolve, rejecter: rejecter)
  }

  /// Executes a Journey-scoped FIDO registration callback.
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Callback execution options.
  ///   - resolve: Promise resolver for success payload.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public func registerForJourney(
    _ journeyId: String,
    options: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingFidoCommon.registerForJourney(
      journeyId,
      options: options,
      resolver: resolve,
      rejecter: rejecter
    )
  }

  /// Executes a Journey-scoped FIDO authentication callback.
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Callback execution options.
  ///   - resolve: Promise resolver for success payload.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public func authenticateForJourney(
    _ journeyId: String,
    options: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingFidoCommon.authenticateForJourney(
      journeyId,
      options: options,
      resolver: resolve,
      rejecter: rejecter
    )
  }
}
