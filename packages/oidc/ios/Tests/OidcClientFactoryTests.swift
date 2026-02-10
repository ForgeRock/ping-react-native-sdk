/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingOidc
@testable import RNPingOidc

final class OidcClientFactoryTests: XCTestCase {

  func testBuildOidcClientDefaultsOptionalOpenIdEndpoints() {
    let payload = OidcClientPayload(
      clientId: "client-id",
      discoveryEndpoint: "https://example.com/.well-known/openid-configuration",
      openId: OpenIdPayload(
        authorizationEndpoint: "https://example.com/oauth2/authorize",
        tokenEndpoint: "https://example.com/oauth2/token",
        userinfoEndpoint: "https://example.com/oauth2/userinfo",
        endSessionEndpoint: nil,
        pingEndIdpSessionEndpoint: nil,
        revocationEndpoint: nil
      ),
      redirectUri: "com.example.app://callback",
      scopes: ["openid"],
      storageId: nil,
      loggerId: nil,
      browserType: nil,
      browserMode: nil,
      acrValues: nil,
      signOutRedirectUri: nil,
      state: nil,
      nonce: nil,
      uiLocales: nil,
      refreshThreshold: nil,
      loginHint: nil,
      display: nil,
      prompt: nil,
      additionalParameters: [:]
    )

    let config = OidcClientFactory.buildOidcClient(payload)

    XCTAssertEqual(config.openId?.endSessionEndpoint, "")
    XCTAssertEqual(config.openId?.revocationEndpoint, "")
    XCTAssertNil(config.openId?.pingEndsessionEndpoint)
  }

  func testBuildWebClientMapsBrowserOptions() {
    let payload = basePayload(
      browserType: "ephemeralAuthSession",
      browserMode: "logout"
    )

    let web = OidcClientFactory.buildWebClient(payload)
    let config = web.config as? OidcWebConfig

    XCTAssertEqual(config?.browserType, .ephemeralAuthSession)
    XCTAssertEqual(config?.browserMode, .logout)
  }

  func testBuildWebClientDefaultsBrowserOptionsWhenUnsupported() {
    let payload = basePayload(
      browserType: "unknown",
      browserMode: "unsupported"
    )

    let web = OidcClientFactory.buildWebClient(payload)
    let config = web.config as? OidcWebConfig

    XCTAssertEqual(config?.browserType, .authSession)
    XCTAssertEqual(config?.browserMode, .login)
  }

  func testBuildOidcClientAdditionalParametersOnlyWhenProvided() {
    var payload = basePayload(additionalParameters: [:])
    let config = OidcClientFactory.buildOidcClient(payload)

    XCTAssertEqual(config.additionalParameters, [:])

    payload = basePayload(additionalParameters: ["foo": "bar"])
    let updated = OidcClientFactory.buildOidcClient(payload)

    XCTAssertEqual(updated.additionalParameters, ["foo": "bar"])
  }

  private func basePayload(
    browserType: String? = nil,
    browserMode: String? = nil,
    additionalParameters: [String: String] = [:]
  ) -> OidcClientPayload {
    return OidcClientPayload(
      clientId: "client-id",
      discoveryEndpoint: "https://example.com/.well-known/openid-configuration",
      openId: nil,
      redirectUri: "com.example.app://callback",
      scopes: ["openid"],
      storageId: nil,
      loggerId: nil,
      browserType: browserType,
      browserMode: browserMode,
      acrValues: nil,
      signOutRedirectUri: nil,
      state: nil,
      nonce: nil,
      uiLocales: nil,
      refreshThreshold: nil,
      loginHint: nil,
      display: nil,
      prompt: nil,
      additionalParameters: additionalParameters
    )
  }
}
