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

  override func setUp() {
    super.setUp()
    IdpHandlerRegistry.shared.removeAll()
  }

  override func tearDown() {
    IdpHandlerRegistry.shared.removeAll()
    super.tearDown()
  }

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

  // MARK: - IdpHandlerRegistry

  /// Asserts the resolved handler is the exact spy instance. Identity is
  /// compared through the concrete class because `IdpHandler` is not
  /// class-constrained, so `===` cannot be applied to `any IdpHandler` directly.
  private func assertResolved(
    _ resolved: (any IdpHandler)?,
    is expected: IdpHandlerSpy,
    file: StaticString = #filePath,
    line: UInt = #line
  ) {
    let resolvedSpy = resolved as? IdpHandlerSpy
    XCTAssertTrue(resolvedSpy === expected, file: file, line: line)
  }

  func testRegisteredProviderResolvesToSameInstance() throws {
    let handler = IdpHandlerSpy()

    try IdpHandlerRegistry.shared.register("line", handler: handler)

    assertResolved(IdpHandlerRegistry.shared.handler(for: "line"), is: handler)
  }

  func testUnregisteredProviderReturnsNil() {
    XCTAssertNil(IdpHandlerRegistry.shared.handler(for: "line"))
  }

  /// Exact-match contract: a superstring of a registered name must not resolve.
  /// The reserved guard is substring-based by design (it mirrors how built-ins
  /// route), but resolution itself is exact — this pins that distinction.
  func testSuperstringOfRegisteredNameReturnsNil() throws {
    let handler = IdpHandlerSpy()

    try IdpHandlerRegistry.shared.register("line", handler: handler)

    XCTAssertNil(IdpHandlerRegistry.shared.handler(for: "line2"))
  }

  func testReservedNamesAreRejectedAtRegistration() {
    let reservedNames = [
      "apple", "siwa", "google", "facebook", "fb-limited",
      "APPLE", "My-Google", "pineapple-sso", "facebookish",
    ]

    for name in reservedNames {
      XCTAssertThrowsError(
        try IdpHandlerRegistry.shared.register(name, handler: IdpHandlerSpy()),
        "Expected registration to be rejected for '\(name)'"
      ) { error in
        guard case IdpHandlerRegistrationError.reservedProvider = error else {
          return XCTFail(
            "Expected reservedProvider for '\(name)', got \(error)"
          )
        }
      }
    }
  }

  func testBlankNamesAreRejectedAtRegistration() {
    XCTAssertThrowsError(
      try IdpHandlerRegistry.shared.register("", handler: IdpHandlerSpy())
    ) { error in
      guard case IdpHandlerRegistrationError.reservedProvider = error else {
        return XCTFail("Expected reservedProvider for blank name, got \(error)")
      }
    }
    XCTAssertThrowsError(
      try IdpHandlerRegistry.shared.register("   ", handler: IdpHandlerSpy())
    ) { error in
      guard case IdpHandlerRegistrationError.reservedProvider = error else {
        return XCTFail("Expected reservedProvider for whitespace name, got \(error)")
      }
    }
  }

  func testReservedProviderErrorLocalizedDescriptionContainsReason() {
    XCTAssertThrowsError(
      try IdpHandlerRegistry.shared.register("pineapple-sso", handler: IdpHandlerSpy())
    ) { error in
      XCTAssertTrue(
        error.localizedDescription.contains("pineapple-sso"),
        "Expected localizedDescription to name the provider, got '\(error.localizedDescription)'"
      )
      XCTAssertTrue(
        error.localizedDescription.contains("conflicts with the built-in"),
        "Expected localizedDescription to state the conflict, got '\(error.localizedDescription)'"
      )
    }
  }

  func testBlankProviderErrorLocalizedDescriptionContainsReason() {
    XCTAssertThrowsError(
      try IdpHandlerRegistry.shared.register("", handler: IdpHandlerSpy())
    ) { error in
      XCTAssertTrue(
        error.localizedDescription.contains("must not be blank"),
        "Expected localizedDescription to state the blank-name reason, got '\(error.localizedDescription)'"
      )
    }
  }

  func testRegistrationNormalizesNameToTrimmedLowercase() throws {
    let handler = IdpHandlerSpy()

    try IdpHandlerRegistry.shared.register("  LINE  ", handler: handler)

    assertResolved(IdpHandlerRegistry.shared.handler(for: " line "), is: handler)
  }

  func testResolutionNormalizesNameToTrimmedLowercase() throws {
    let handler = IdpHandlerSpy()

    try IdpHandlerRegistry.shared.register("line", handler: handler)

    assertResolved(IdpHandlerRegistry.shared.handler(for: "LINE"), is: handler)
  }

  func testReRegistrationReplacesHandler() throws {
    let first = IdpHandlerSpy()
    let second = IdpHandlerSpy()

    try IdpHandlerRegistry.shared.register("line", handler: first)
    try IdpHandlerRegistry.shared.register("line", handler: second)

    assertResolved(IdpHandlerRegistry.shared.handler(for: "line"), is: second)
    let resolvedSpy = IdpHandlerRegistry.shared.handler(for: "line") as? IdpHandlerSpy
    XCTAssertFalse(resolvedSpy === first)
  }

  func testRemoveAllResetsRegistry() throws {
    let handler = IdpHandlerSpy()

    try IdpHandlerRegistry.shared.register("line", handler: handler)
    IdpHandlerRegistry.shared.removeAll()

    XCTAssertNil(IdpHandlerRegistry.shared.handler(for: "line"))
  }

  // MARK: - Custom handler routing through the authorize path

  @MainActor
  func testAuthorizeForJourneyRoutesToRegisteredHandler() async throws {
    let spy = IdpHandlerSpy()
    try RNPingExternalIdpCommon.registerIdpHandler("stubprovider", handler: spy)
    let callback = try await makeIdpCallback(
      provider: "stubprovider",
      nonce: "",
      redirectUri: "com.example.app://server"
    )

    let result = await RNPingExternalIdpCommon.authorizeForJourney(
      callback: callback,
      redirectUri: ""
    )

    guard case .success(let idpResult) = result else {
      return XCTFail("Expected success, got \(result)")
    }
    XCTAssertTrue(spy.authorizeCalled)
    XCTAssertEqual(idpResult.token, "token")
    // The callback captured the handler token into its own input state, which
    // is what journey.next() submits.
    let inputs = callback.payload()["input"] as? [[String: Any]]
    XCTAssertEqual(inputs?.first?["value"] as? String, "token")
    XCTAssertEqual(inputs?.last?["value"] as? String, "id_token")
  }

  @MainActor
  func testAuthorizeForJourneyAppliesRedirectOverrideToRegisteredHandler() async throws {
    let spy = IdpHandlerSpy()
    try RNPingExternalIdpCommon.registerIdpHandler("stubprovider", handler: spy)
    let callback = try await makeIdpCallback(
      provider: "stubprovider",
      nonce: "",
      redirectUri: "com.example.app://server"
    )

    let result = await RNPingExternalIdpCommon.authorizeForJourney(
      callback: callback,
      redirectUri: "com.example.app://jsconfigured"
    )

    guard case .success = result else {
      return XCTFail("Expected success, got \(result)")
    }
    XCTAssertEqual(spy.receivedRedirectUri, "com.example.app://jsconfigured")
  }

  @MainActor
  func testAuthorizeForJourneyUnregisteredCustomProviderFailsWithUnsupportedProvider() async throws {
    let callback = try await makeIdpCallback(
      provider: "twitter",
      nonce: "",
      redirectUri: "com.example.app://server"
    )

    let noRedirectResult = await RNPingExternalIdpCommon.authorizeForJourney(
      callback: callback,
      redirectUri: ""
    )
    guard case .failure(let noRedirectError) = noRedirectResult else {
      return XCTFail("Expected failure, got \(noRedirectResult)")
    }
    let noRedirectMapped = RNPingExternalIdpCommon.mapIdpError(noRedirectError)
    XCTAssertEqual(noRedirectMapped.error, "EXTERNAL_IDP_UNSUPPORTED_PROVIDER")

    let withRedirectResult = await RNPingExternalIdpCommon.authorizeForJourney(
      callback: callback,
      redirectUri: "com.example.app://jsconfigured"
    )
    guard case .failure(let withRedirectError) = withRedirectResult else {
      return XCTFail("Expected failure, got \(withRedirectResult)")
    }
    let withRedirectMapped = RNPingExternalIdpCommon.mapIdpError(withRedirectError)
    XCTAssertEqual(withRedirectMapped.error, "EXTERNAL_IDP_UNSUPPORTED_PROVIDER")
  }

  @MainActor
  func testAuthorizeForJourneyDeliversNonceToRegisteredHandler() async throws {
    let spy = IdpHandlerSpy()
    try RNPingExternalIdpCommon.registerIdpHandler("stubprovider", handler: spy)
    let callback = try await makeIdpCallback(
      provider: "stubprovider",
      nonce: "known-nonce",
      redirectUri: ""
    )

    let result = await RNPingExternalIdpCommon.authorizeForJourney(
      callback: callback,
      redirectUri: ""
    )

    guard case .success = result else {
      return XCTFail("Expected success, got \(result)")
    }
    XCTAssertEqual(spy.receivedNonce, "known-nonce")
  }

  @MainActor
  func testAuthorizeForJourneyMapsHandlerFailureToAuthorizeError() async throws {
    let spy = IdpHandlerSpy()
    spy.errorToThrow = IdpExceptions.idpCanceledException(
      message: "user cancelled"
    )
    try RNPingExternalIdpCommon.registerIdpHandler("stubprovider", handler: spy)
    let callback = try await makeIdpCallback(
      provider: "stubprovider",
      nonce: "",
      redirectUri: ""
    )

    let result = await RNPingExternalIdpCommon.authorizeForJourney(
      callback: callback,
      redirectUri: ""
    )

    guard case .failure(let error) = result else {
      return XCTFail("Expected failure, got \(result)")
    }
    // The native IdpCallback.authorize catch-all wraps every handler-thrown
    // error as illegalStateException, so even a cancellation-shaped failure
    // surfaces as EXTERNAL_IDP_AUTHORIZE_ERROR on this path.
    let mapped = RNPingExternalIdpCommon.mapIdpError(error)
    XCTAssertEqual(mapped.error, "EXTERNAL_IDP_AUTHORIZE_ERROR")
    XCTAssertTrue(error.localizedDescription.contains("user cancelled"))
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

private final class IdpHandlerSpy: NSObject, IdpHandler, @unchecked Sendable {
  var tokenType: String = "id_token"
  private(set) var receivedRedirectUri: String?
  private(set) var receivedNonce: String?
  private(set) var authorizeCalled = false
  /// When set, authorize throws this error instead of returning a token.
  var errorToThrow: Error?

  /// Captures the client payload passed through the bridge wrapper.
  /// - Parameter idpClient: Native IDP client payload.
  /// - Returns: Stubbed authorization result.
  func authorize(idpClient: IdpClient) async throws -> IdpResult {
    authorizeCalled = true
    receivedRedirectUri = idpClient.redirectUri
    receivedNonce = idpClient.nonce
    if let errorToThrow {
      throw errorToThrow
    }
    return IdpResult(token: "token", additionalParameters: nil)
  }
}

private func makeIdpCallback(
  provider: String,
  nonce: String,
  redirectUri: String
) async throws -> IdpCallback {
  let callback = IdpCallback()
  _ = await callback.initialize(
    with: [
      "type": "IdPCallback",
      // The input slots the callback's payload() fills with the handler token
      // and token type, mirroring the server-provided callback shape.
      "input": [
        ["name": "token"],
        ["name": "token_type"],
      ],
      "output": [
        ["name": "provider", "value": provider],
        ["name": "clientId", "value": "client-id"],
        ["name": "redirectUri", "value": redirectUri],
        ["name": "scopes", "value": ["openid"]],
        ["name": "nonce", "value": nonce],
      ],
    ]
  )
  return callback
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
