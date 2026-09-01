/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingFido
@testable import RNPingCore
@testable import RNPingFido

/// Unit tests for the bridge-facing DaVinci serializer registration contract:
/// calling `registerDaVinciSerializer` in isolation produces a registered
/// serializer whose payload carries the top-level `action` field, without any
/// other FIDO method having run.
///
/// Each test resets the one-shot guard and the `CoreRuntime` serializer store,
/// keeping the suite hermetic regardless of test order.
@MainActor
final class RNPingFidoSerializerRegistrationTests: XCTestCase {

  // MARK: - Setup / Teardown

  override func setUp() {
    super.setUp()
    CoreRuntime.resetDaVinciCollectorSerializersForTesting()
    RNPingFidoCommon.resetSerializerRegistrationForTesting()
  }

  override func tearDown() {
    CoreRuntime.resetDaVinciCollectorSerializersForTesting()
    RNPingFidoCommon.resetSerializerRegistrationForTesting()
    super.tearDown()
  }

  // MARK: - Registration-only serialization

  /// Ensures registration alone serializes a registration collector with the
  /// action-discriminated payload and top-level `action`.
  func testRegisterAloneSerializesRegistrationCollectorWithAction() {
    RNPingFidoCommon.registerDaVinciSerializer()

    let payload = CoreRuntime.serializeDaVinciCollector(
      FidoRegistrationCollector(with: makeRegistrationJson())
    )

    let map = try? XCTUnwrap(payload)
    XCTAssertEqual(map?["key"] as? String, "fido-register-key")
    XCTAssertEqual(map?["type"] as? String, "FIDO2")
    XCTAssertEqual(map?["action"] as? String, "REGISTER")
    XCTAssertEqual(map?["label"] as? String, "Set up passkeys")
    XCTAssertEqual(map?["required"] as? Bool, true)

    let options = try? XCTUnwrap(map?["publicKeyCredentialCreationOptions"] as? NSDictionary)
    XCTAssertEqual((options?["rp"] as? NSDictionary)?["id"] as? String, "example.com")
    // transform() emits standard base64: bytes [72, 101] encode to "SGU=".
    XCTAssertEqual(options?["challenge"] as? String, "SGU=")
  }

  /// Ensures registration alone serializes an authentication collector with the
  /// `AUTHENTICATE` action and request options.
  func testRegisterAloneSerializesAuthenticationCollectorWithAction() {
    RNPingFidoCommon.registerDaVinciSerializer()

    let payload = CoreRuntime.serializeDaVinciCollector(
      FidoAuthenticationCollector(with: makeAuthenticationJson())
    )

    let map = try? XCTUnwrap(payload)
    XCTAssertEqual(map?["key"] as? String, "fido-auth-key")
    XCTAssertEqual(map?["type"] as? String, "FIDO2")
    XCTAssertEqual(map?["action"] as? String, "AUTHENTICATE")
    XCTAssertEqual(map?["label"] as? String, "Sign in with passkey")
    XCTAssertEqual(map?["required"] as? Bool, false)

    let options = try? XCTUnwrap(map?["publicKeyCredentialRequestOptions"] as? NSDictionary)
    XCTAssertEqual(options?["rpId"] as? String, "example.com")
    // transform() emits standard base64: bytes [1, 2] encode to "AQI=".
    XCTAssertEqual(options?["challenge"] as? String, "AQI=")
  }

  /// Ensures the registered serializer returns `nil` for non-FIDO collectors so
  /// other serializers and the DaVinci mapper fallback remain in control.
  func testRegisterAloneReturnsNilForNonFidoCollector() {
    RNPingFidoCommon.registerDaVinciSerializer()

    XCTAssertNil(CoreRuntime.serializeDaVinciCollector("not a collector"))
  }

  /// Ensures repeat registration calls are no-ops: the payload is unchanged
  /// after a second registration.
  func testRepeatRegistrationKeepsSerializerPayloadStable() {
    RNPingFidoCommon.registerDaVinciSerializer()
    let first = CoreRuntime.serializeDaVinciCollector(
      FidoRegistrationCollector(with: makeRegistrationJson())
    )

    RNPingFidoCommon.registerDaVinciSerializer()
    let second = CoreRuntime.serializeDaVinciCollector(
      FidoRegistrationCollector(with: makeRegistrationJson())
    )

    let firstMap = try? XCTUnwrap(first)
    let secondMap = try? XCTUnwrap(second)
    XCTAssertEqual(firstMap?["action"] as? String, secondMap?["action"] as? String)
    XCTAssertEqual(firstMap?["key"] as? String, secondMap?["key"] as? String)
  }

  // MARK: - Serializer Fixtures

  /// Server-style registration collector JSON with int-array binary fields that
  /// the native `transform()` converts to standard base64.
  private func makeRegistrationJson() -> [String: Any] {
    return [
      "type": "FIDO2",
      "action": "REGISTER",
      "key": "fido-register-key",
      "label": "Set up passkeys",
      "required": true,
      "publicKeyCredentialCreationOptions": [
        "rp": ["id": "example.com", "name": "Example"],
        "challenge": [72, 101]
      ]
    ]
  }

  /// Server-style authentication collector JSON with int-array binary fields that
  /// the native `transform()` converts to standard base64.
  private func makeAuthenticationJson() -> [String: Any] {
    return [
      "type": "FIDO2",
      "action": "AUTHENTICATE",
      "key": "fido-auth-key",
      "label": "Sign in with passkey",
      "required": false,
      "publicKeyCredentialRequestOptions": [
        "rpId": "example.com",
        "challenge": [1, 2]
      ]
    ]
  }
}
