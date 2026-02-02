/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingOidc
@testable import RNPingCore
@testable import RNPingOidc

@available(iOS 16.0, *)
final class OidcResponseMapperTests: XCTestCase {

  func testEncodeTokensUsesExpiresAt() {
    let token = Token(
      accessToken: "access",
      tokenType: "Bearer",
      scope: "openid",
      expiresIn: 60,
      refreshToken: "refresh",
      idToken: "id"
    )

    let map = OidcResponseMapper.encodeTokens(token)

    XCTAssertEqual(map["accessToken"] as? String, "access")
    XCTAssertEqual(map["refreshToken"] as? String, "refresh")
    XCTAssertEqual(map["idToken"] as? String, "id")
    XCTAssertEqual(map["tokenExpiry"] as? Int64, token.expiresAt)
  }

  func testEncodeUserinfoMapsNestedValues() {
    let info: UserInfo = [
      "name": "Jane",
      "age": 42,
      "roles": ["admin", "user"] as [String],
      "profile": ["city": "Austin"] as [String: String]
    ]

    let dict = OidcResponseMapper.encodeUserinfo(info)

    XCTAssertEqual(dict["name"] as? String, "Jane")
    XCTAssertEqual(dict["age"] as? Int, 42)
    let roles = dict["roles"] as? [String]
    XCTAssertEqual(roles, ["admin", "user"])
    let profile = dict["profile"] as? NSDictionary
    XCTAssertEqual(profile?["city"] as? String, "Austin")
  }
}
