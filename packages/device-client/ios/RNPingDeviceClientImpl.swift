/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import React

/// Swift entry point for the Device Client native module.
///
/// This singleton is the single ObjC-visible surface that both the TurboModule
/// (`RNPingDeviceClient.mm`) and the classic bridge (`RNPingDeviceClientClassic.mm`)
/// call into. Every method is a thin forwarder to ``RNPingDeviceClientCommon``,
/// which owns all shared logic and state.
///
/// Marked `@unchecked Sendable` because the class is stateless — all mutable
/// state lives in `RNPingDeviceClientCommon.registry` and is protected by its
/// own lock.
@objcMembers
public class RNPingDeviceClientImpl: NSObject, @unchecked Sendable {

  /// Shared singleton instance.
  @objc public static let shared = RNPingDeviceClientImpl()

  @objc private override init() {
    super.init()
  }

  /// Creates a new `DeviceClient` and returns its opaque handle.
  /// - Parameters:
  ///   - config: Configuration dictionary with `serverUrl`, `ssoToken`, and optional `realm`/`cookieName`.
  ///   - resolve: Promise resolver — receives the handle `String` on success.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public func create(
    _ config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingDeviceClientCommon.create(config, resolver: resolve, rejecter: rejecter)
  }

  /// Retrieves all devices of the given type from the server.
  /// - Parameters:
  ///   - handleId: Opaque handle returned by ``create(_:resolve:rejecter:)``.
  ///   - deviceType: One of `"oath"`, `"push"`, `"bound"`, `"profile"`, or `"webAuthn"`.
  ///   - resolve: Promise resolver — receives the result dictionary.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public func get(
    _ handleId: String,
    deviceType: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingDeviceClientCommon.get(
      handleId,
      deviceType: deviceType,
      resolver: resolve,
      rejecter: rejecter
    )
  }

  /// Updates a single device on the server.
  /// - Parameters:
  ///   - handleId: Opaque handle returned by ``create(_:resolve:rejecter:)``.
  ///   - deviceType: One of `"oath"`, `"push"`, `"bound"`, `"profile"`, or `"webAuthn"`.
  ///   - device: JS device payload to decode and send.
  ///   - resolve: Promise resolver — receives the updated device dictionary.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public func update(
    _ handleId: String,
    deviceType: String,
    device: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingDeviceClientCommon.update(
      handleId,
      deviceType: deviceType,
      device: device,
      resolver: resolve,
      rejecter: rejecter
    )
  }

  /// Deletes a single device from the server.
  /// - Parameters:
  ///   - handleId: Opaque handle returned by ``create(_:resolve:rejecter:)``.
  ///   - deviceType: One of `"oath"`, `"push"`, `"bound"`, `"profile"`, or `"webAuthn"`.
  ///   - device: JS device payload identifying the device to delete.
  ///   - resolve: Promise resolver — receives the deleted device dictionary.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public func deleteDevice(
    _ handleId: String,
    deviceType: String,
    device: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingDeviceClientCommon.deleteDevice(
      handleId,
      deviceType: deviceType,
      device: device,
      resolver: resolve,
      rejecter: rejecter
    )
  }

  /// Removes a `DeviceClient` from the handle registry.
  /// - Parameters:
  ///   - handleId: Opaque handle returned by ``create(_:resolve:rejecter:)``.
  ///   - resolve: Promise resolver — receives `NSNull` on success.
  ///   - rejecter: Promise rejecter (unused; dispose never fails).
  @objc
  public func dispose(
    _ handleId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingDeviceClientCommon.dispose(handleId, resolver: resolve, rejecter: rejecter)
  }
}
