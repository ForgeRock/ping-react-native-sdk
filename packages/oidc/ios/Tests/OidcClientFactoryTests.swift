/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingLogger
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
        revocationEndpoint: nil,
        deviceAuthorizationEndpoint: nil
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

    let config = OidcClientFactory.buildOidcClient(payload, logger: nil)

    // `openIdOverride` only runs after a successful `discover()` (see OidcClientConfig.oidcInitialize),
    // so it is exercised directly here against a stand-in discovered configuration rather than
    // through `config.openId`, which stays nil until discovery completes.
    var discovered = OpenIdConfiguration(
      authorizationEndpoint: "",
      tokenEndpoint: "",
      userinfoEndpoint: "",
      endSessionEndpoint: "",
      revocationEndpoint: ""
    )
    config.openIdOverride?(&discovered)

    XCTAssertEqual(discovered.authorizationEndpoint, "https://example.com/oauth2/authorize")
    XCTAssertEqual(discovered.tokenEndpoint, "https://example.com/oauth2/token")
    XCTAssertEqual(discovered.userinfoEndpoint, "https://example.com/oauth2/userinfo")
    XCTAssertEqual(discovered.endSessionEndpoint, "")
    XCTAssertEqual(discovered.revocationEndpoint, "")
    XCTAssertNil(discovered.pingEndsessionEndpoint)
  }

  func testBuildOidcClientMergesPartialOpenIdOverrideOntoDiscovery() {
    // A partial openId override (only deviceAuthorizationEndpoint set, the
    // field Advanced Identity Cloud's discovery document omits) must merge
    // onto discovery -- leaving authorizationEndpoint/tokenEndpoint/
    // userinfoEndpoint at their discovered values -- rather than requiring
    // every field to be supplied.
    let payload = OidcClientPayload(
      clientId: "client-id",
      discoveryEndpoint: "https://example.com/.well-known/openid-configuration",
      openId: OpenIdPayload(
        authorizationEndpoint: nil,
        tokenEndpoint: nil,
        userinfoEndpoint: nil,
        endSessionEndpoint: nil,
        pingEndIdpSessionEndpoint: nil,
        revocationEndpoint: nil,
        deviceAuthorizationEndpoint: "https://example.com/device/code"
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

    let config = OidcClientFactory.buildOidcClient(payload, logger: nil)

    var discovered = OpenIdConfiguration(
      authorizationEndpoint: "https://discovered.example.com/authorize",
      tokenEndpoint: "https://discovered.example.com/token",
      userinfoEndpoint: "https://discovered.example.com/userinfo",
      endSessionEndpoint: "",
      revocationEndpoint: ""
    )
    config.openIdOverride?(&discovered)

    XCTAssertEqual(discovered.authorizationEndpoint, "https://discovered.example.com/authorize")
    XCTAssertEqual(discovered.tokenEndpoint, "https://discovered.example.com/token")
    XCTAssertEqual(discovered.userinfoEndpoint, "https://discovered.example.com/userinfo")
    XCTAssertEqual(discovered.deviceAuthorizationEndpoint, "https://example.com/device/code")
  }

  func testBuildWebClientMapsBrowserOptions() {
    let payload = basePayload(
      browserType: "ephemeralAuthSession",
      browserMode: "logout"
    )

    let web = OidcClientFactory.buildWebClient(payload, logger: nil)
    let config = web.config as? OidcWebClientConfig

    XCTAssertEqual(config?.browserType, .ephemeralAuthSession)
    XCTAssertEqual(config?.browserMode, .logout)
  }

  func testBuildWebClientDefaultsBrowserOptionsWhenUnsupported() {
    let payload = basePayload(
      browserType: "unknown",
      browserMode: "unsupported"
    )

    let web = OidcClientFactory.buildWebClient(payload, logger: nil)
    let config = web.config as? OidcWebClientConfig

    XCTAssertEqual(config?.browserType, .authSession)
    XCTAssertEqual(config?.browserMode, .login)
  }

  func testBuildOidcClientAdditionalParametersOnlyWhenProvided() {
    var payload = basePayload(additionalParameters: [:])
    let config = OidcClientFactory.buildOidcClient(payload, logger: nil)

    XCTAssertTrue(config.additionalParameters.isEmpty)

    payload = basePayload(additionalParameters: ["foo": "bar"])
    let updated = OidcClientFactory.buildOidcClient(payload, logger: nil)

    XCTAssertEqual(updated.additionalParameters["foo"] as? String, "bar")
    XCTAssertEqual(updated.additionalParameters.count, 1)
  }

  func testBuildOidcClientAppliesLoggerWhenProvided() {
    let payload = basePayload()
    let config = OidcClientFactory.buildOidcClient(payload, logger: LogManager.standard)

    XCTAssertNotNil(config.logger)
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

    XCTAssertNotNil(config.storage)
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
