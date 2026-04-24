/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import XCTest
import PingExternalIdP
import RNPingCore
import PingNetwork
@testable import RNPingExternalIdp

final class RNPingExternalIdpCommonTests: XCTestCase {

  @MainActor
  func testRedirectUriOverridingHandlerReplacesClientRedirectUri() async throws {
    let baseHandler = IdpHandlerSpy()
    let handler = RedirectUriOverridingIdpHandler(
      baseHandler: baseHandler,
      redirectUri: "com.example.app://override"
    )

    let idpClient = try makeIdpClient(
      clientId: "client-id",
      redirectUri: "com.example.app://original",
      scopes: ["openid"],
      nonce: "nonce"
    )

    _ = try await handler.authorize(idpClient: idpClient)

    XCTAssertEqual(baseHandler.receivedRedirectUri, "com.example.app://override")
  }

  func testParseCallConfigTrimsRedirectUriAndLoggerId() {
    let config = RNPingExternalIdpCommon.parseCallConfig(
      [
        "redirectUri": "  com.example.app://callback  ",
        "loggerId": "  logger-123  ",
      ]
    )

    XCTAssertEqual(config.redirectUri, "com.example.app://callback")
    XCTAssertEqual(config.loggerId, "logger-123")
  }

  func testParseCallConfigDefaultsMissingRedirectUriToEmptyString() {
    let config = RNPingExternalIdpCommon.parseCallConfig([:])

    XCTAssertEqual(config.redirectUri, "")
    XCTAssertNil(config.loggerId)
  }

  // MARK: - parseCallbackIndex

  func testParseCallbackIndexFromNSNumber() {
    let result = RNPingExternalIdpCommon.parseCallbackIndex(["index": NSNumber(value: 2)])
    XCTAssertEqual(result, 2)
  }

  func testParseCallbackIndexFromNumericString() {
    let result = RNPingExternalIdpCommon.parseCallbackIndex(["index": "3"])
    XCTAssertEqual(result, 3)
  }

  func testParseCallbackIndexDefaultsToZeroWhenAbsent() {
    let result = RNPingExternalIdpCommon.parseCallbackIndex([:])
    XCTAssertEqual(result, 0)
  }

  // MARK: - mapIdpError

  func testMapIdpErrorCancelledEmitsCancelledCode() {
    let result = RNPingExternalIdpCommon.mapIdpError(.idpCanceledException())
    XCTAssertEqual(result.error, "EXTERNAL_IDP_CANCELLED")
    XCTAssertEqual(result.type.rawValue, ErrorType.authError.rawValue)
  }

  func testMapIdpErrorUnsupportedProviderEmitsUnsupportedCode() {
    let result = RNPingExternalIdpCommon.mapIdpError(.unsupportedIdpException(message: "twitter"))
    XCTAssertEqual(result.error, "EXTERNAL_IDP_UNSUPPORTED_PROVIDER")
    XCTAssertEqual(result.type.rawValue, ErrorType.authError.rawValue)
  }

  func testMapIdpErrorIllegalArgumentEmitsConfigErrorCode() {
    let result = RNPingExternalIdpCommon.mapIdpError(.illegalArgumentException())
    XCTAssertEqual(result.error, "EXTERNAL_IDP_CONFIG_ERROR")
    XCTAssertEqual(result.type.rawValue, ErrorType.argumentError.rawValue)
  }

  func testMapIdpErrorIllegalStateEmitsAuthorizeErrorCode() {
    let result = RNPingExternalIdpCommon.mapIdpError(.illegalStateException())
    XCTAssertEqual(result.error, "EXTERNAL_IDP_AUTHORIZE_ERROR")
    XCTAssertEqual(result.type.rawValue, ErrorType.authError.rawValue)
  }

  // MARK: - createAuthorizeResultPayload

  func testCreateAuthorizeResultPayloadIncludesToken() {
    let result = RNPingExternalIdpCommon.createAuthorizeResultPayload(
      IdpResult(token: "test-token", additionalParameters: nil)
    )
    XCTAssertEqual(result["token"] as? String, "test-token")
    XCTAssertNil(result["additionalParameters"])
  }

  func testCreateAuthorizeResultPayloadIncludesAdditionalParameters() {
    let result = RNPingExternalIdpCommon.createAuthorizeResultPayload(
      IdpResult(token: "test-token", additionalParameters: ["key": "value"])
    )
    XCTAssertEqual(result["token"] as? String, "test-token")
    XCTAssertEqual((result["additionalParameters"] as? [String: String])?["key"], "value")
  }

  // MARK: - resolveIdpHandler

  @MainActor
  func testResolveIdpHandlerForUnknownProviderReturnsNil() {
    XCTAssertNil(RNPingExternalIdpCommon.resolveIdpHandler(for: "twitter"))
  }

  @MainActor
  func testResolveIdpHandlerForKnownProvidersDoNotCrash() {
    // Provider SDKs are not linked in the test target, so nil is expected.
    // These assertions confirm routing runs without crashing for each known provider.
    XCTAssertNil(RNPingExternalIdpCommon.resolveIdpHandler(for: "apple"))
    XCTAssertNil(RNPingExternalIdpCommon.resolveIdpHandler(for: "siwa"))
    XCTAssertNil(RNPingExternalIdpCommon.resolveIdpHandler(for: "google"))
    XCTAssertNil(RNPingExternalIdpCommon.resolveIdpHandler(for: "facebook"))
  }
}

private func makeIdpClient(
  clientId: String,
  redirectUri: String,
  scopes: [String],
  nonce: String
) throws -> IdpClient {
  let body = try JSONSerialization.data(
    withJSONObject: [
      "idp": [
        "clientId": clientId,
        "redirectUri": redirectUri,
        "scopes": scopes,
        "nonce": nonce,
      ],
      "_links": [
        "next": [
          "href": "",
        ],
      ],
    ]
  )

  return try IdpClient(response: HttpResponseStub(body: body))
}

private final class IdpHandlerSpy: NSObject, @preconcurrency IdpHandler, @unchecked Sendable {
  var tokenType: String = "id_token"
  private(set) var receivedRedirectUri: String?

  /// Captures the redirect URI passed through the bridge wrapper.
  /// - Parameter idpClient: Native IDP client payload.
  /// - Returns: Stubbed authorization result.
  func authorize(idpClient: IdpClient) async throws -> IdpResult {
    receivedRedirectUri = idpClient.redirectUri
    return IdpResult(token: "token", additionalParameters: nil)
  }
}

private final class HttpResponseStub: HttpResponse, @unchecked Sendable {
  let request: HttpRequest
  let status: Int
  let body: Data?

  init(body: Data?, status: Int = 200) {
    self.request = URLSessionHttpRequest()
    self.status = status
    self.body = body
  }

  func getHeader(name: String) -> String? {
    nil
  }

  func getHeaders(name: String) -> [String]? {
    nil
  }

  func getCookies() -> [HTTPCookie] {
    []
  }

  func getCookieStrings() -> [String] {
    []
  }

  func bodyAsString() -> String {
    guard let body else {
      return ""
    }

    return String(data: body, encoding: .utf8) ?? ""
  }
}
