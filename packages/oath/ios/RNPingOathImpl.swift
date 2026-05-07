/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import React

/// Swift entry point for the OATH native module.
///
/// Singleton wrapper that both the TurboModule (`RNPingOath.mm`) and the
/// classic bridge (`RNPingOathClassic.mm`) call into. Every method is a
/// thin forwarder to ``RNPingOathCommon``, which owns all shared logic
/// and state.
///
/// Marked `@unchecked Sendable` because the class is stateless — all
/// mutable state lives in `RNPingOathCommon.registry` and is protected
/// by its own `NSLock`.
@objcMembers
public class RNPingOathImpl: NSObject, @unchecked Sendable {

  /// Shared singleton instance.
  @objc public static let shared = RNPingOathImpl()

  @objc private override init() { super.init() }

  /// Releases all native OATH clients held by the registry.
  ///
  /// Called from `invalidate()` in both `.mm` bridge files when the bridge tears down.
  @objc
  public func invalidate() {
    RNPingOathCommon.cleanup()
  }

  /// Creates a new `OathClient` and stores it in the handle registry.
  ///
  /// - Parameters:
  ///   - config: Configuration dictionary (currently unused; reserved for future use).
  ///   - resolve: Promise resolver — receives the handle `String` on success.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public func create(
    _ config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingOathCommon.create(config, resolver: resolve, rejecter: rejecter)
  }

  /// Adds a new OATH credential from an `otpauth://` URI.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by `create(_:resolve:rejecter:)`.
  ///   - uri: The `otpauth://` URI string encoding the credential parameters.
  ///   - resolve: Promise resolver — receives the encoded credential `NSDictionary` on success.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public func addCredentialFromUri(
    _ handle: String,
    uri: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingOathCommon.addCredentialFromUri(handle, uri: uri, resolver: resolve, rejecter: rejecter)
  }

  /// Retrieves a single OATH credential by its identifier.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by `create(_:resolve:rejecter:)`.
  ///   - credentialId: The unique identifier of the credential to retrieve.
  ///   - resolve: Promise resolver — receives the encoded credential `NSDictionary`, or `NSNull` if not found.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public func getCredential(
    _ handle: String,
    credentialId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingOathCommon.getCredential(handle, credentialId: credentialId, resolver: resolve, rejecter: rejecter)
  }

  /// Retrieves all OATH credentials stored in the client.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by `create(_:resolve:rejecter:)`.
  ///   - resolve: Promise resolver — receives an `NSArray` of encoded credential dictionaries.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public func getCredentials(
    _ handle: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingOathCommon.getCredentials(handle, resolver: resolve, rejecter: rejecter)
  }

  /// Saves (updates) an existing OATH credential.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by `create(_:resolve:rejecter:)`.
  ///   - credential: JS credential payload to decode and save.
  ///   - resolve: Promise resolver — receives the saved credential `NSDictionary` on success.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public func saveCredential(
    _ handle: String,
    credential: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingOathCommon.saveCredential(handle, credential: credential, resolver: resolve, rejecter: rejecter)
  }

  /// Deletes an OATH credential by its identifier.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by `create(_:resolve:rejecter:)`.
  ///   - credentialId: The unique identifier of the credential to delete.
  ///   - resolve: Promise resolver — receives `NSNumber(value: true)` if deleted, `NSNumber(value: false)` otherwise.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public func deleteCredential(
    _ handle: String,
    credentialId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingOathCommon.deleteCredential(handle, credentialId: credentialId, resolver: resolve, rejecter: rejecter)
  }

  /// Generates an OATH code for the specified credential.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by `create(_:resolve:rejecter:)`.
  ///   - credentialId: The unique identifier of the credential.
  ///   - resolve: Promise resolver — receives the generated code as `NSString`.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public func generateCode(
    _ handle: String,
    credentialId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingOathCommon.generateCode(handle, credentialId: credentialId, resolver: resolve, rejecter: rejecter)
  }

  /// Generates an OATH code with validity metadata for the specified credential.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by `create(_:resolve:rejecter:)`.
  ///   - credentialId: The unique identifier of the credential.
  ///   - resolve: Promise resolver — receives an `NSDictionary` with keys:
  ///     `code`, `timeRemaining`, `counter`, `progress`, `totalPeriod`.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public func generateCodeWithValidity(
    _ handle: String,
    credentialId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingOathCommon.generateCodeWithValidity(handle, credentialId: credentialId, resolver: resolve, rejecter: rejecter)
  }

  /// Closes the `OathClient` and removes it from the handle registry.
  ///
  /// - Parameters:
  ///   - handle: Opaque handle returned by `create(_:resolve:rejecter:)`.
  ///   - resolve: Promise resolver — receives `NSNull` on success.
  ///   - rejecter: Promise rejecter (unused; close never fails from the JS perspective).
  @objc
  public func close(
    _ handle: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingOathCommon.close(handle, resolver: resolve, rejecter: rejecter)
  }

  /// Registers an OATH policy evaluator configuration and returns the registry id.
  ///
  /// - Parameter config: Configuration dictionary containing `policies` (NSArray of kind strings)
  ///   and optionally `loggerId` (NSString).
  /// - Returns: Opaque UUID id string for the registered evaluator descriptor.
  @objc
  public func registerOathPolicyEvaluator(_ config: NSDictionary) -> String {
    return RNPingOathCommon.registerOathPolicyEvaluator(config)
  }

  /// Retrieves a previously registered policy evaluator descriptor by id.
  ///
  /// - Parameter id: Registry id returned by `registerOathPolicyEvaluator(_:)`.
  /// - Returns: NSDictionary with `policies` (NSArray of kind strings) and optionally `loggerId`.
  @objc
  public func configureOathPolicyEvaluator(_ id: String) -> NSDictionary {
    return RNPingOathCommon.configureOathPolicyEvaluator(id)
  }
}
