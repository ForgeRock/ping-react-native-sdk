/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingDeviceClient
import React
import RNPingCore

/// Shared execution logic for the Device Client React Native iOS bridge.
///
/// This class maintains a handle-based registry that maps opaque `String`
/// handles (UUIDs) to live `DeviceClient` instances. The registry pattern
/// allows a single React Native app to own multiple clients simultaneously
/// (one per active session, for example). Each JS `createDeviceClient` call
/// produces exactly one registry entry; `dispose` removes it.
///
/// All public entry points are `@objc static` so they can be called from
/// both the TurboModule (`RNPingDeviceClient.mm`) and the classic bridge
/// (`RNPingDeviceClientClassic.mm`) without duplicating logic.
///
/// Ancillary logic lives in sibling files:
/// - ``DeviceErrorMapper`` — maps native errors to `GenericError`
/// - ``DeviceJsonCodec`` — encodes / decodes device payloads
/// - ``DeviceClientConfigNormalizer`` — tolerates sloppy `serverUrl` / `realm` input
@objcMembers
public class RNPingDeviceClientCommon: NSObject {

  /// Lock that serializes all access to ``registry``.
  ///
  /// React Native may invoke bridge methods on a background serial queue
  /// while `dispose` runs on the main thread, so every read/write of
  /// ``registry`` must be guarded by this lock.
  private static let registryLock = NSLock()

  /// Handle-keyed registry of live `DeviceClient` instances.
  ///
  /// Marked `nonisolated(unsafe)` because Swift 6 strict concurrency
  /// checking cannot see the manual `registryLock` protection. Access is
  /// always serialized through ``registryLock``.
  ///
  /// Kept local to this module (not promoted to `RNPingCore`) because no
  /// other package needs to resolve Device Client handles today. Revisit
  /// if a cross-module lookup use case emerges, similar to the shared
  /// logger registry.
  private nonisolated(unsafe) static var registry: [String: DeviceClient] = [:]

  // MARK: - Public entry points

  /// Creates a new `DeviceClient` and stores it in the handle registry.
  ///
  /// The returned handle is an opaque UUID string that JS must pass to every
  /// subsequent `get`, `update`, `deleteDevice`, and `dispose` call.
  ///
  /// - Parameters:
  ///   - config: Configuration dictionary. Required keys: `serverUrl`, `ssoToken`,
  ///     `cookieName`. Optional: `realm` (defaults to `"root"`).
  ///   - resolver: Promise resolver — receives the handle `String` on success.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public static func create(
    _ config: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSString>(resolver: resolver, rejecter: rejecter)
    guard
      let serverUrl = config["serverUrl"] as? String, !serverUrl.isEmpty,
      let ssoToken = config["ssoToken"] as? String, !ssoToken.isEmpty,
      let cookieName = config["cookieName"] as? String, !cookieName.isEmpty
    else {
      handlers.reject(
        GenericError(
          type: .argumentError,
          error: DeviceClientErrorCode.missingConfig.rawValue,
          message: "serverUrl, ssoToken, and cookieName are required."
        )
      )
      return
    }
    let normalizedServerUrl = DeviceClientConfigNormalizer.normalizeServerUrl(serverUrl)
    let realm = DeviceClientConfigNormalizer.normalizeRealm(config["realm"] as? String)

    // TODO: route JS `loggerId` → `LogManager.logger` (iOS SDK has no per-client
    //   logger field; same global-singleton pattern as the browser package).
    let deviceConfig = DeviceClientConfig(
      serverUrl: normalizedServerUrl,
      realm: realm,
      cookieName: cookieName,
      ssoToken: ssoToken
    )
    let client = DeviceClient(config: deviceConfig)
    let handleId = UUID().uuidString
    registryLock.lock()
    registry[handleId] = client
    registryLock.unlock()
    handlers.resolve(handleId as NSString)
  }

  /// Retrieves all devices of the given type from the server.
  ///
  /// The result is an `NSDictionary` with a single `"result"` key whose value
  /// is an array of encoded device objects.
  ///
  /// - Parameters:
  ///   - handleId: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  ///   - deviceType: One of `"oath"`, `"push"`, `"bound"`, `"profile"`, or `"webAuthn"`.
  ///   - resolver: Promise resolver — receives the result dictionary.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public static func get(
    _ handleId: String,
    deviceType: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    guard let client = lookup(handleId) else {
      handlers.reject(DeviceErrorMapper.handleNotFoundError())
      return
    }
    Task { @MainActor in
      await performGet(client: client, deviceType: deviceType, handlers: handlers)
    }
  }

  /// Updates a single device on the server.
  ///
  /// The `device` dictionary is decoded into the appropriate typed model
  /// (e.g. `OathDevice`, `PushDevice`) before being forwarded to the native SDK.
  ///
  /// - Parameters:
  ///   - handleId: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  ///   - deviceType: One of `"oath"`, `"push"`, `"bound"`, `"profile"`, or `"webAuthn"`.
  ///   - device: JS device payload to decode and send.
  ///   - resolver: Promise resolver — receives the updated device dictionary.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public static func update(
    _ handleId: String,
    deviceType: String,
    device: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    guard let client = lookup(handleId) else {
      handlers.reject(DeviceErrorMapper.handleNotFoundError())
      return
    }
    nonisolated(unsafe) let deviceSnapshot = device
    Task { @MainActor in
      await performUpdate(
        client: client,
        deviceType: deviceType,
        device: deviceSnapshot,
        handlers: handlers
      )
    }
  }

  /// Deletes a single device from the server.
  ///
  /// The `device` dictionary is decoded into the appropriate typed model
  /// before being forwarded to the native SDK for deletion.
  ///
  /// - Parameters:
  ///   - handleId: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  ///   - deviceType: One of `"oath"`, `"push"`, `"bound"`, `"profile"`, or `"webAuthn"`.
  ///   - device: JS device payload identifying the device to delete.
  ///   - resolver: Promise resolver — receives the deleted device dictionary.
  ///   - rejecter: Promise rejecter — receives a `GenericError` on failure.
  @objc
  public static func deleteDevice(
    _ handleId: String,
    deviceType: String,
    device: NSDictionary,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    guard let client = lookup(handleId) else {
      handlers.reject(DeviceErrorMapper.handleNotFoundError())
      return
    }
    nonisolated(unsafe) let deviceSnapshot = device
    Task { @MainActor in
      await performDelete(
        client: client,
        deviceType: deviceType,
        device: deviceSnapshot,
        handlers: handlers
      )
    }
  }

  /// Removes a `DeviceClient` from the handle registry, releasing its resources.
  ///
  /// After this call, any subsequent operation using the same handle will
  /// receive a `DEVICE_CLIENT_HANDLE_NOT_FOUND` error.
  ///
  /// - Parameters:
  ///   - handleId: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  ///   - resolver: Promise resolver — receives `NSNull` on success.
  ///   - rejecter: Promise rejecter (unused; dispose never fails).
  @objc
  public static func dispose(
    _ handleId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    registryLock.lock()
    registry.removeValue(forKey: handleId)
    registryLock.unlock()
    resolver(NSNull())
  }

  // MARK: - Dispatch

  /// Dispatches a `get` call to the correct device-type accessor on `client`.
  ///
  /// Runs on `@MainActor` via the calling `Task`. Resolves or rejects through
  /// `handlers` depending on the native SDK result.
  ///
  /// - Parameters:
  ///   - client: The `DeviceClient` instance looked up from the registry.
  ///   - deviceType: Device type key (`"oath"`, `"push"`, `"bound"`, `"profile"`, `"webAuthn"`).
  ///   - handlers: Promise bridge that resolves with an `NSDictionary` or rejects with a `GenericError`.
  private static func performGet(
    client: DeviceClient,
    deviceType: String,
    handlers: PromiseBridge<NSDictionary>
  ) async {
    do {
      switch deviceType {
      case "oath":
        let result = await client.oath.get()
        try handleGet(result: result, handlers: handlers)
      case "push":
        let result = await client.push.get()
        try handleGet(result: result, handlers: handlers)
      case "bound":
        let result = await client.bound.get()
        try handleGet(result: result, handlers: handlers)
      case "profile":
        let result = await client.profile.get()
        try handleGet(result: result, handlers: handlers)
      case "webAuthn":
        let result = await client.webAuthn.get()
        try handleGet(result: result, handlers: handlers)
      default:
        handlers.reject(DeviceErrorMapper.invalidDeviceType(deviceType))
      }
    } catch {
      handlers.reject(DeviceErrorMapper.mapError(error))
    }
  }

  /// Dispatches an `update` call to the correct device-type accessor on `client`.
  ///
  /// Decodes the JS `device` dictionary into the matching `Device` model, then
  /// forwards the typed value to the native SDK.
  ///
  /// - Parameters:
  ///   - client: The `DeviceClient` instance looked up from the registry.
  ///   - deviceType: Device type key (`"oath"`, `"push"`, `"bound"`, `"profile"`, `"webAuthn"`).
  ///   - device: Raw JS dictionary to decode into a typed device model.
  ///   - handlers: Promise bridge that resolves with an `NSDictionary` or rejects with a `GenericError`.
  private static func performUpdate(
    client: DeviceClient,
    deviceType: String,
    device: NSDictionary,
    handlers: PromiseBridge<NSDictionary>
  ) async {
    do {
      switch deviceType {
      case "oath":
        let typed: OathDevice = try DeviceJsonCodec.decode(device, kind: deviceType)
        let result = await client.oath.update(typed)
        try handleSingle(result: result, handlers: handlers)
      case "push":
        let typed: PushDevice = try DeviceJsonCodec.decode(device, kind: deviceType)
        let result = await client.push.update(typed)
        try handleSingle(result: result, handlers: handlers)
      case "bound":
        let typed: BoundDevice = try DeviceJsonCodec.decode(device, kind: deviceType)
        let result = await client.bound.update(typed)
        try handleSingle(result: result, handlers: handlers)
      case "profile":
        let typed: ProfileDevice = try DeviceJsonCodec.decode(device, kind: deviceType)
        let result = await client.profile.update(typed)
        try handleSingle(result: result, handlers: handlers)
      case "webAuthn":
        let typed: WebAuthnDevice = try DeviceJsonCodec.decode(device, kind: deviceType)
        let result = await client.webAuthn.update(typed)
        try handleSingle(result: result, handlers: handlers)
      default:
        handlers.reject(DeviceErrorMapper.invalidDeviceType(deviceType))
      }
    } catch {
      handlers.reject(DeviceErrorMapper.mapError(error))
    }
  }

  /// Dispatches a `delete` call to the correct device-type accessor on `client`.
  ///
  /// Decodes the JS `device` dictionary into the matching `Device` model, then
  /// forwards the typed value to the native SDK for deletion.
  ///
  /// - Parameters:
  ///   - client: The `DeviceClient` instance looked up from the registry.
  ///   - deviceType: Device type key (`"oath"`, `"push"`, `"bound"`, `"profile"`, `"webAuthn"`).
  ///   - device: Raw JS dictionary to decode into a typed device model.
  ///   - handlers: Promise bridge that resolves with an `NSDictionary` or rejects with a `GenericError`.
  private static func performDelete(
    client: DeviceClient,
    deviceType: String,
    device: NSDictionary,
    handlers: PromiseBridge<NSDictionary>
  ) async {
    do {
      switch deviceType {
      case "oath":
        let typed: OathDevice = try DeviceJsonCodec.decode(device, kind: deviceType)
        let result = await client.oath.delete(typed)
        try handleSingle(result: result, handlers: handlers)
      case "push":
        let typed: PushDevice = try DeviceJsonCodec.decode(device, kind: deviceType)
        let result = await client.push.delete(typed)
        try handleSingle(result: result, handlers: handlers)
      case "bound":
        let typed: BoundDevice = try DeviceJsonCodec.decode(device, kind: deviceType)
        let result = await client.bound.delete(typed)
        try handleSingle(result: result, handlers: handlers)
      case "profile":
        let typed: ProfileDevice = try DeviceJsonCodec.decode(device, kind: deviceType)
        let result = await client.profile.delete(typed)
        try handleSingle(result: result, handlers: handlers)
      case "webAuthn":
        let typed: WebAuthnDevice = try DeviceJsonCodec.decode(device, kind: deviceType)
        let result = await client.webAuthn.delete(typed)
        try handleSingle(result: result, handlers: handlers)
      default:
        handlers.reject(DeviceErrorMapper.invalidDeviceType(deviceType))
      }
    } catch {
      handlers.reject(DeviceErrorMapper.mapError(error))
    }
  }

  // MARK: - Result handling

  /// Processes a `get` result that contains an array of devices.
  ///
  /// Each device is individually encoded through ``DeviceJsonCodec/encode(_:)``
  /// (which normalizes timestamps and strips `urlSuffix`) before being wrapped
  /// in a `{ result: [...] }` payload for JS.
  ///
  /// - Parameters:
  ///   - result: Native SDK result containing an array of devices or a `DeviceError`.
  ///   - handlers: Promise bridge to resolve or reject.
  /// - Throws: Re-throws encoding errors from ``DeviceJsonCodec/encode(_:)``.
  private static func handleGet<T: Device & Encodable>(
    result: Result<[T], DeviceError>,
    handlers: PromiseBridge<NSDictionary>
  ) throws {
    switch result {
    case .success(let devices):
      let encoded = try devices.map { try DeviceJsonCodec.encode($0) }
      let payload: NSDictionary = ["result": encoded]
      handlers.resolve(payload)
    case .failure(let error):
      handlers.reject(DeviceErrorMapper.mapDeviceError(error))
    }
  }

  /// Processes an `update` or `delete` result that contains a single device.
  ///
  /// The device is encoded through ``DeviceJsonCodec/encode(_:)`` and wrapped
  /// in a `{ result: { ... } }` payload for JS.
  ///
  /// - Parameters:
  ///   - result: Native SDK result containing a single device or a `DeviceError`.
  ///   - handlers: Promise bridge to resolve or reject.
  /// - Throws: Re-throws encoding errors from ``DeviceJsonCodec/encode(_:)``.
  private static func handleSingle<T: Device & Encodable>(
    result: Result<T, DeviceError>,
    handlers: PromiseBridge<NSDictionary>
  ) throws {
    switch result {
    case .success(let device):
      let encoded = try DeviceJsonCodec.encode(device)
      let payload: NSDictionary = ["result": encoded]
      handlers.resolve(payload)
    case .failure(let error):
      handlers.reject(DeviceErrorMapper.mapDeviceError(error))
    }
  }

  // MARK: - Registry

  /// Thread-safe lookup of a `DeviceClient` by its handle.
  ///
  /// - Parameter handleId: Opaque handle returned by ``create(_:resolver:rejecter:)``.
  /// - Returns: The `DeviceClient` if present, or `nil` if the handle is unknown.
  private static func lookup(_ handleId: String) -> DeviceClient? {
    registryLock.lock()
    defer { registryLock.unlock() }
    return registry[handleId]
  }
}
