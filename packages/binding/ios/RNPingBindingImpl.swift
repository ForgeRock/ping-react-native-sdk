/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import React

/// Swift entry point for the Binding native module.
///
/// Delegates all operations to `RNPingBindingCommon`.
@objcMembers
public class RNPingBindingImpl: NSObject, @unchecked Sendable {

  @objc public static let shared = RNPingBindingImpl()

  @objc private override init() {
    super.init()
  }

  /// Executes a Journey-scoped DeviceBindingCallback.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Bind callback execution options.
  ///   - config: Per-call runtime configuration.
  ///   - resolve: Promise resolver.
  ///   - rejecter: Promise rejecter.
  @objc
  @MainActor
  public func bindForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingBindingCommon.bindForJourney(
      journeyId,
      options: options,
      config: config,
      resolver: resolve,
      rejecter: rejecter
    )
  }

  /// Executes a Journey-scoped DeviceSigningVerifierCallback.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Sign callback execution options.
  ///   - config: Per-call runtime configuration.
  ///   - resolve: Promise resolver.
  ///   - rejecter: Promise rejecter.
  @objc
  @MainActor
  public func signForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingBindingCommon.signForJourney(
      journeyId,
      options: options,
      config: config,
      resolver: resolve,
      rejecter: rejecter
    )
  }

  /// Resolves a pending JS PIN collection request with the entered PIN.
  @objc public func resolvePin(_ requestId: String, pin: String) {
    RNPingBindingCommon.resolvePin(requestId: requestId, pin: pin)
  }

  /// Cancels a pending JS PIN collection request.
  @objc public func cancelPin(_ requestId: String) {
    RNPingBindingCommon.cancelPin(requestId: requestId)
  }

  /// Resolves a pending JS user key selection request with the selected key id.
  @objc public func selectUserKey(_ requestId: String, keyId: String) {
    RNPingBindingCommon.resolveUserKey(requestId: requestId, keyId: keyId)
  }

  /// Cancels a pending JS user key selection request.
  @objc public func cancelUserKey(_ requestId: String) {
    RNPingBindingCommon.cancelUserKey(requestId: requestId)
  }

  /// Returns all locally stored device binding keys.
  ///
  /// - Parameters:
  ///   - resolve: Promise resolver.
  ///   - rejecter: Promise rejecter.
  @objc public func getAllKeys(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingBindingCommon.getAllKeys(resolver: resolve, rejecter: rejecter)
  }

  /// Deletes a single locally stored device binding key.
  ///
  /// - Parameters:
  ///   - userId: The user identifier associated with the key.
  ///   - keyId: The unique key identifier (kid).
  ///   - resolve: Promise resolver.
  ///   - rejecter: Promise rejecter.
  @objc public func deleteKey(
    _ userId: String,
    keyId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingBindingCommon.deleteKey(userId: userId, keyId: keyId, resolver: resolve, rejecter: rejecter)
  }

  /// Deletes all locally stored device binding keys.
  ///
  /// - Parameters:
  ///   - resolve: Promise resolver.
  ///   - rejecter: Promise rejecter.
  @objc public func deleteAllKeys(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingBindingCommon.deleteAllKeys(resolver: resolve, rejecter: rejecter)
  }
}
