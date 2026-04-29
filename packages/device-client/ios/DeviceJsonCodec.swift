/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import PingDeviceClient

/// JSON codec used to shuttle device payloads between the React Native
/// bridge and the native `PingDeviceClient` SDK.
///
/// Translates between the JS-friendly contract (`id`, `deviceName`) and
/// the native Swift `CodingKeys` names (`_id`, and for `ProfileDevice`,
/// `alias`). Also strips `urlSuffix` to match the Android shape.
internal enum DeviceJsonCodec {

  /// Shared `JSONDecoder` instance used by ``decode(_:kind:)``.
  private static let decoder: JSONDecoder = {
    let d = JSONDecoder()
    return d
  }()

  /// Shared `JSONEncoder` instance used by ``encode(_:)``.
  private static let encoder: JSONEncoder = {
    let e = JSONEncoder()
    return e
  }()

  /// Decodes an `NSDictionary` from JS into a typed `Decodable` device model.
  ///
  /// The dictionary is remapped from JS-friendly keys (`id`, `deviceName`)
  /// to the names the native Swift `CodingKeys` expect (`_id`, and for
  /// `ProfileDevice`, `alias`), then decoded through `JSONDecoder`.
  ///
  /// - Parameters:
  ///   - dict: Raw dictionary received from the JS bridge (JS-friendly shape).
  ///   - kind: Device kind string (`DeviceType.oath`, `DeviceType.push`, `DeviceType.bound`, `DeviceType.profile`, `DeviceType.webAuthn`).
  /// - Returns: A decoded instance of `T`.
  /// - Throws: `DecodingError` if the dictionary shape does not match `T`.
  internal static func decode<T: Decodable>(_ dict: NSDictionary, kind: String) throws -> T {
    let remapped = remapForNative(dict, kind: kind)
    let data = try JSONSerialization.data(withJSONObject: remapped, options: [])
    return try decoder.decode(T.self, from: data)
  }

  /// Encodes a typed device model into an `NSDictionary` for the JS bridge.
  ///
  /// After `JSONEncoder` serialization (which uses the native Swift
  /// `CodingKeys`), two post-processing steps normalize the output so JS
  /// consumers see a consistent shape across iOS and Android:
  ///
  /// 1. **Key remap** — `_id` → `id` (all device kinds) and `alias` →
  ///    `deviceName` (ProfileDevice only). JS types declare the friendly
  ///    names; without this remap, `device.id` would be `undefined` on iOS.
  /// 2. **`urlSuffix` stripping** — The `urlSuffix` field is internal to the
  ///    Android data classes; iOS exposes it publicly, so we strip it here
  ///    for parity.
  ///
  /// - Parameter value: The `Encodable` device model to serialize.
  /// - Returns: An `NSDictionary` suitable for returning through the React Native bridge.
  /// - Throws: `EncodingError` or `DeviceError.decodingFailed` if the encoded
  ///   value is not a JSON object.
  internal static func encode<T: Encodable>(_ value: T) throws -> NSDictionary {
    let data = try encoder.encode(value)
    guard
      let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      throw DeviceError.decodingFailed(
        error: NSError(
          domain: "RNPingDeviceClient",
          code: 0,
          userInfo: [NSLocalizedDescriptionKey: "Expected JSON object"]
        )
      )
    }
    var normalized = obj
    // Native `CodingKeys` rename `id` → `_id` across all device kinds, and
    // `deviceName` → `alias` on `ProfileDevice`. Flip those back so JS sees
    // the contract declared in `@ping-identity/rn-device-client` types.
    if let v = normalized.removeValue(forKey: "_id") {
      normalized["id"] = v
    }
    if let v = normalized.removeValue(forKey: "alias") {
      normalized["deviceName"] = v
    }
    // TODO-PARITY: iOS device structs expose `urlSuffix` publicly while Android
    //   keeps it internal to the data classes. Make it internal on iOS too so
    //   this bridge-level strip isn't needed.
    normalized.removeValue(forKey: "urlSuffix")
    return normalized as NSDictionary
  }

  /// Remaps a JS-friendly dictionary to the keys expected by native Swift
  /// `CodingKeys` so `JSONDecoder` can decode it.
  ///
  /// Inverse of the remap applied in ``encode(_:)``:
  /// - `id` → `_id` (always)
  /// - `deviceName` → `alias` (only when `kind == DeviceType.profile`)
  ///
  /// - Parameters:
  ///   - dict: Input dictionary in JS-friendly shape.
  ///   - kind: Device kind string.
  /// - Returns: A new `[String: Any]` with native-compatible keys.
  private static func remapForNative(_ dict: NSDictionary, kind: String) -> [String: Any] {
    var result = (dict as? [String: Any]) ?? [:]
    if let v = result.removeValue(forKey: "id") {
      result["_id"] = v
    }
    if kind == DeviceType.profile, let v = result.removeValue(forKey: "deviceName") {
      result["alias"] = v
    }
    return result
  }
}
