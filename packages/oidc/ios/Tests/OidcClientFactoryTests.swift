/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingOidc
import RNPingCore
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

  func testBuildOidcClientResolvesStorageFromCoreRegistry() async {
    let key = DispatchSpecificKey<Void>()
    let queue = DispatchQueue(label: "com.ping.tests.oidc.storage")
    queue.setSpecific(key: key, value: ())
    let handle = TestStorageHandle(cacheable: false, account: "oidc-test-account", encryptor: true)
    let storageId = await CoreRuntime.oidcStorageConfigRegistry.register(handle)
    defer {
      Task {
        await CoreRuntime.oidcStorageConfigRegistry.remove(storageId)
      }
    }

    let payload = basePayload().withStorageId(storageId)
    let config = queue.sync {
      OidcClientFactory.buildOidcClient(payload, logger: nil, queueKey: key)
    }

    XCTAssertNotNil(config.storage)
  }

  func testBuildOidcClientSkipsStorageWhenIdUnknown() {
    let key = DispatchSpecificKey<Void>()
    let queue = DispatchQueue(label: "com.ping.tests.oidc.storage.unknown")
    queue.setSpecific(key: key, value: ())
    let payload = basePayload().withStorageId("missing-storage")
    let config = queue.sync {
      OidcClientFactory.buildOidcClient(payload, logger: nil, queueKey: key)
    }

    XCTAssertNil(config.storage)
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

  private final class TestStorageHandle: StorageConfigHandleContract, @unchecked Sendable {
    let cacheable: Bool?
    let account: String?
    let encryptor: Bool?

    init(cacheable: Bool?, account: String?, encryptor: Bool?) {
      self.cacheable = cacheable
      self.account = account
      self.encryptor = encryptor
    }
  }
}

private extension OidcClientPayload {
  func withStorageId(_ storageId: String?) -> OidcClientPayload {
    return OidcClientPayload(
      clientId: clientId,
      discoveryEndpoint: discoveryEndpoint,
      openId: openId,
      redirectUri: redirectUri,
      scopes: scopes,
      storageId: storageId,
      loggerId: loggerId,
      browserType: browserType,
      browserMode: browserMode,
      acrValues: acrValues,
      signOutRedirectUri: signOutRedirectUri,
      state: state,
      nonce: nonce,
      uiLocales: uiLocales,
      refreshThreshold: refreshThreshold,
      loginHint: loginHint,
      display: display,
      prompt: prompt,
      additionalParameters: additionalParameters
    )
  }
}
