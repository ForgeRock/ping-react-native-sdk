/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingDeviceClient
@testable import RNPingDeviceClient

/// Unit tests for ``DeviceJsonCodec``.
///
/// Covers the `_id ↔ id` / `alias ↔ deviceName` remap at the bridge
/// boundary, the `urlSuffix` strip, and the generic encode/decode path.
final class DeviceJsonCodecTests: XCTestCase {

  // MARK: - encode: JS-friendly remap using real device types

  /// Decodes a known-good `OathDevice` JSON payload (AM-shaped, with `_id`),
  /// then verifies ``DeviceJsonCodec/encode(_:)`` flips `_id` back to `id`.
  func testEncodeOathDeviceRemapsIdFromUnderscorePrefix() throws {
    let amJson = """
    {
      "_id": "oath-1",
      "deviceName": "iPhone",
      "uuid": "uuid-1",
      "createdDate": 1700000000000,
      "lastAccessDate": 1700000100000
    }
    """
    let oath = try JSONDecoder().decode(OathDevice.self, from: Data(amJson.utf8))

    let dict = try DeviceJsonCodec.encode(oath)

    XCTAssertEqual(dict["id"] as? String, "oath-1")
    XCTAssertNil(dict["_id"])
    XCTAssertEqual(dict["deviceName"] as? String, "iPhone")
  }

  /// `ProfileDevice` renames `deviceName` → `alias` via `CodingKeys`. Verify
  /// ``DeviceJsonCodec/encode(_:)`` flips it back to `deviceName`.
  func testEncodeProfileDeviceRemapsAliasToDeviceName() throws {
    let amJson = """
    {
      "_id": "profile-1",
      "alias": "Samsung",
      "identifier": "ident-xyz",
      "metadata": {"k": "v"},
      "lastSelectedDate": 1700000000000
    }
    """
    let profile = try JSONDecoder().decode(ProfileDevice.self, from: Data(amJson.utf8))

    let dict = try DeviceJsonCodec.encode(profile)

    XCTAssertEqual(dict["id"] as? String, "profile-1")
    XCTAssertEqual(dict["deviceName"] as? String, "Samsung")
    XCTAssertNil(dict["alias"])
    XCTAssertNil(dict["_id"])
  }

  // MARK: - decode: JS-friendly → native remap

  /// JS passes `{ id, deviceName, ... }`; decode must remap `id` → `_id`
  /// before handing to `JSONDecoder` so native `OathDevice` can parse it.
  func testDecodeOathDeviceAcceptsJsFriendlyKeys() throws {
    let source: NSDictionary = [
      "id": "oath-1",
      "deviceName": "iPhone",
      "uuid": "uuid-1",
      "createdDate": 1_700_000_000_000,
      "lastAccessDate": 1_700_000_100_000,
    ]
    let decoded: OathDevice = try DeviceJsonCodec.decode(source, kind: "oath")
    XCTAssertEqual(decoded.id, "oath-1")
    XCTAssertEqual(decoded.deviceName, "iPhone")
  }

  /// JS passes `{ id, deviceName, ... }` for profile; decode must remap both
  /// `id` → `_id` AND `deviceName` → `alias` (profile-only).
  func testDecodeProfileDeviceAcceptsJsFriendlyKeys() throws {
    let source: NSDictionary = [
      "id": "profile-1",
      "deviceName": "Samsung",
      "identifier": "ident-xyz",
      "metadata": [:],
      "lastSelectedDate": 1_700_000_000_000,
    ]
    let decoded: ProfileDevice = try DeviceJsonCodec.decode(source, kind: "profile")
    XCTAssertEqual(decoded.id, "profile-1")
    XCTAssertEqual(decoded.deviceName, "Samsung")
  }

  // MARK: - urlSuffix strip (defensive)

  /// Fixture that exposes `urlSuffix` in its encoded form to confirm the strip.
  private struct UrlSuffixFixture: Encodable {
    let id: String
    let urlSuffix: String
  }

  func testEncodeStripsUrlSuffix() throws {
    let fixture = UrlSuffixFixture(id: "abc", urlSuffix: "/oath/123")
    let dict = try DeviceJsonCodec.encode(fixture)
    XCTAssertNil(dict["urlSuffix"])
    XCTAssertEqual(dict["id"] as? String, "abc")
  }

  // MARK: - generic decode

  /// Uses a test-local type whose field names don't collide with the remap
  /// rules, to pin down the generic JSON passthrough independent of the
  /// device remaps.
  private struct Simple: Codable, Equatable {
    let name: String
    let value: Int
  }

  func testDecodeGenericShape() throws {
    let source: NSDictionary = ["name": "Alice", "value": 7]
    let decoded: Simple = try DeviceJsonCodec.decode(source, kind: "oath")
    XCTAssertEqual(decoded, Simple(name: "Alice", value: 7))
  }

  func testDecodeThrowsOnShapeMismatch() {
    struct RequiresName: Decodable { let name: String }
    let source: NSDictionary = ["unexpected": true]
    XCTAssertThrowsError(try (DeviceJsonCodec.decode(source, kind: "oath") as RequiresName))
  }
}
