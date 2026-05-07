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
/// TODO(SDKS-concurrency): Apply the same static-methods + actor pattern to the remaining
/// packages. See packages/binding/TODOS.md for the full list.
@objcMembers
public class RNPingBindingImpl: NSObject {

  /// Executes a Journey-scoped DeviceBindingCallback.
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Bind callback execution options (deviceName, appPin, biometric, jwt).
  ///   - config: Per-call runtime configuration (loggerId, hasPinCollector, userKeyStorageId).
  ///   - resolve: Promise resolver.
  ///   - rejecter: Promise rejecter.
  @objc
  @MainActor
  public static func bindForJourney(
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
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Sign callback execution options (claims, appPin, biometric, jwt).
  ///   - config: Per-call runtime configuration (loggerId, hasPinCollector, hasUserKeySelector, userKeyStorageId).
  ///   - resolve: Promise resolver.
  ///   - rejecter: Promise rejecter.
  @objc
  @MainActor
  public static func signForJourney(
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
  /// - Parameters:
  ///   - requestId: The request identifier emitted with `RNPingBinding_PinRequired`.
  ///   - pin: The PIN entered by the user.
  @objc public static func resolvePin(_ requestId: String, pin: String) {
    RNPingBindingCommon.resolvePin(requestId: requestId, pin: pin)
  }

  /// Cancels a pending JS PIN collection request.
  /// - Parameter requestId: The request identifier emitted with `RNPingBinding_PinRequired`.
  @objc public static func cancelPin(_ requestId: String) {
    RNPingBindingCommon.cancelPin(requestId: requestId)
  }

  /// Resolves a pending JS user key selection request with the selected key id.
  /// - Parameters:
  ///   - requestId: The request identifier emitted with `RNPingBinding_UserKeyRequired`.
  ///   - keyId: The key id selected by the user.
  @objc public static func selectUserKey(_ requestId: String, keyId: String) {
    RNPingBindingCommon.resolveUserKey(requestId: requestId, keyId: keyId)
  }

  /// Cancels a pending JS user key selection request.
  /// - Parameter requestId: The request identifier emitted with `RNPingBinding_UserKeyRequired`.
  @objc public static func cancelUserKey(_ requestId: String) {
    RNPingBindingCommon.cancelUserKey(requestId: requestId)
  }

  /// Returns all locally stored device binding keys.
  /// - Parameters:
  ///   - resolve: Promise resolver — receives an array of key dictionaries on success.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc public static func getAllKeys(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingBindingCommon.getAllKeys(resolver: resolve, rejecter: rejecter)
  }

  /// Deletes a single locally stored device binding key.
  /// - Parameters:
  ///   - userId: The user identifier associated with the key.
  ///   - keyId: The unique key identifier (kid).
  ///   - resolve: Promise resolver — receives `NSNull` on success.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc public static func deleteKey(
    _ userId: String,
    keyId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingBindingCommon.deleteKey(userId: userId, keyId: keyId, resolver: resolve, rejecter: rejecter)
  }

  /// Deletes all locally stored device binding keys.
  /// - Parameters:
  ///   - resolve: Promise resolver — receives `NSNull` on success.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc public static func deleteAllKeys(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingBindingCommon.deleteAllKeys(resolver: resolve, rejecter: rejecter)
  }
}
