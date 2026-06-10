//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.

import XCTest
import AuthenticationServices
import PingBrowser
import PingLogger
import RNPingBrowser
import RNPingLogger

@MainActor
final class RNPingBrowserCommonTests: XCTestCase {
  private let testUrl = "https://example.com"
  private var loggerId: String!

  override func setUp() {
    super.setUp()
    loggerId = RNPingLoggerImpl.shared.registerLogger(["level": "STANDARD"])
  }

  override func tearDown() {
    RNPingBrowserCommon._resetBrowserLauncherForTesting()
    super.tearDown()
  }

  func testOpenRejectsWhenCallbackSchemeMissing() {
    let expectation = expectation(description: "reject called")
    let options: NSDictionary = ["loggerId": loggerId ?? ""]

    RNPingBrowserCommon._setBrowserLauncherForTesting(FakeBrowserLauncher())
    RNPingBrowserCommon.open(
      testUrl,
      options: options,
      resolver: { _ in XCTFail("resolver should not be called") },
      rejecter: { code, message, _ in
        XCTAssertEqual(code, "BROWSER_OPEN_ERROR")
        XCTAssertEqual(message, "callbackUrlScheme is required")
        expectation.fulfill()
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testOpenRejectsWhenUrlInvalid() {
    let expectation = expectation(description: "reject called")
    let options: NSDictionary = [
      "callbackUrlScheme": "com.example.app",
      "loggerId": loggerId ?? ""
    ]

    RNPingBrowserCommon._setBrowserLauncherForTesting(FakeBrowserLauncher())
    RNPingBrowserCommon.open(
      "not a url",
      options: options,
      resolver: { _ in XCTFail("resolver should not be called") },
      rejecter: { code, message, _ in
        XCTAssertEqual(code, "BROWSER_OPEN_ERROR")
        XCTAssertEqual(
          message,
          "Unsupported URL scheme. Only HTTP and HTTPS URLs are supported."
        )
        expectation.fulfill()
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testOpenResolvesSuccess() {
    let expectation = expectation(description: "resolver called")
    let options: NSDictionary = [
      "callbackUrlScheme": "com.example.app",
      "loggerId": loggerId ?? ""
    ]
    let launcher = FakeBrowserLauncher()
    launcher.result = .success(URL(string: "com.example.app://callback")!)

    RNPingBrowserCommon._setBrowserLauncherForTesting(launcher)
    RNPingBrowserCommon.open(
      testUrl,
      options: options,
      resolver: { payload in
        XCTAssertEqual(payload["type"] as? String, "success")
        XCTAssertEqual(payload["url"] as? String, "com.example.app://callback")
        expectation.fulfill()
      },
      rejecter: { _, _, _ in XCTFail("rejecter should not be called") }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testOpenResolvesCancelForBrowserError() {
    let expectation = expectation(description: "resolver called")
    let options: NSDictionary = [
      "callbackUrlScheme": "com.example.app",
      "loggerId": loggerId ?? ""
    ]
    let launcher = FakeBrowserLauncher()
    launcher.result = .failure(BrowserError.externalUserAgentCancelled)

    RNPingBrowserCommon._setBrowserLauncherForTesting(launcher)
    RNPingBrowserCommon.open(
      testUrl,
      options: options,
      resolver: { payload in
        XCTAssertEqual(payload["type"] as? String, "cancel")
        expectation.fulfill()
      },
      rejecter: { _, _, _ in XCTFail("rejecter should not be called") }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testOpenResolvesCancelForAuthSessionCancel() {
    let expectation = expectation(description: "resolver called")
    let options: NSDictionary = [
      "callbackUrlScheme": "com.example.app",
      "loggerId": loggerId ?? ""
    ]
    let launcher = FakeBrowserLauncher()
    launcher.result = .failure(ASWebAuthenticationSessionError(.canceledLogin))

    RNPingBrowserCommon._setBrowserLauncherForTesting(launcher)
    RNPingBrowserCommon.open(
      testUrl,
      options: options,
      resolver: { payload in
        XCTAssertEqual(payload["type"] as? String, "cancel")
        expectation.fulfill()
      },
      rejecter: { _, _, _ in XCTFail("rejecter should not be called") }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testOpenRejectsOnUnhandledError() {
    let expectation = expectation(description: "reject called")
    let options: NSDictionary = [
      "callbackUrlScheme": "com.example.app",
      "loggerId": loggerId ?? ""
    ]
    let launcher = FakeBrowserLauncher()
    launcher.result = .failure(NSError(domain: "test", code: 1))

    RNPingBrowserCommon._setBrowserLauncherForTesting(launcher)
    RNPingBrowserCommon.open(
      testUrl,
      options: options,
      resolver: { _ in XCTFail("resolver should not be called") },
      rejecter: { code, message, _ in
        XCTAssertEqual(code, "BROWSER_OPEN_ERROR")
        XCTAssertEqual(message, "The operation couldn’t be completed. (test error 1.)")
        expectation.fulfill()
      }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testOpenPassesIosOptions() {
    let expectation = expectation(description: "resolver called")
    let options: NSDictionary = [
      "callbackUrlScheme": "com.example.app",
      "loggerId": loggerId ?? "",
      "ios": [
        "browserType": "ephemeralAuthSession",
        "browserMode": "logout"
      ]
    ]

    let launcher = FakeBrowserLauncher()
    launcher.result = .success(URL(string: "com.example.app://callback")!)

    RNPingBrowserCommon._setBrowserLauncherForTesting(launcher)
    RNPingBrowserCommon.open(
      testUrl,
      options: options,
      resolver: { _ in
        XCTAssertEqual(launcher.lastBrowserType, .ephemeralAuthSession)
        XCTAssertEqual(launcher.lastBrowserMode, .logout)
        XCTAssertEqual(launcher.lastCallbackScheme, "com.example.app")
        expectation.fulfill()
      },
      rejecter: { _, _, _ in XCTFail("rejecter should not be called") }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testOpenForwardsResolvedLoggerWhenLoggerIdProvided() {
    let expectation = expectation(description: "resolver called")
    let options: NSDictionary = [
      "callbackUrlScheme": "com.example.app",
      "loggerId": loggerId ?? ""
    ]
    let launcher = FakeBrowserLauncher()
    launcher.result = .success(URL(string: "com.example.app://callback")!)

    RNPingBrowserCommon._setBrowserLauncherForTesting(launcher)
    RNPingBrowserCommon.open(
      testUrl,
      options: options,
      resolver: { _ in
        XCTAssertNotNil(launcher.lastLogger, "resolved logger should be forwarded to launch()")
        expectation.fulfill()
      },
      rejecter: { _, _, _ in XCTFail("rejecter should not be called") }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testOpenForwardsNoneLoggerWhenNoLoggerIdProvided() {
    let expectation = expectation(description: "resolver called")
    let options: NSDictionary = ["callbackUrlScheme": "com.example.app"]
    let launcher = FakeBrowserLauncher()
    launcher.result = .success(URL(string: "com.example.app://callback")!)

    RNPingBrowserCommon._setBrowserLauncherForTesting(launcher)
    RNPingBrowserCommon.open(
      testUrl,
      options: options,
      resolver: { _ in
        XCTAssertNotNil(launcher.lastLogger, "LogManager.none fallback should still be forwarded to launch()")
        expectation.fulfill()
      },
      rejecter: { _, _, _ in XCTFail("rejecter should not be called") }
    )

    wait(for: [expectation], timeout: 1)
  }

  func testResetDelegatesToLauncher() {
    let expectation = expectation(description: "reset delegated")
    let launcher = FakeBrowserLauncher()
    launcher.resetExpectation = expectation
    RNPingBrowserCommon._setBrowserLauncherForTesting(launcher)

    RNPingBrowserCommon.reset()

    wait(for: [expectation], timeout: 1)
    XCTAssertTrue(launcher.resetCalled)
  }
}

@MainActor
private final class FakeBrowserLauncher: BrowserLaunching {
  var result: Result<URL, Error> = .success(URL(string: "com.example.app://callback")!)
  var resetCalled = false
  var resetExpectation: XCTestExpectation?
  var lastBrowserType: BrowserType?
  var lastBrowserMode: BrowserMode?
  var lastCallbackScheme: String?
  var lastLogger: Logger?

  func launch(
    url: URL,
    customParams: [String : String]?,
    browserType: BrowserType,
    browserMode: BrowserMode,
    callbackURLScheme: String,
    logger: Logger
  ) async throws -> URL {
    lastBrowserType = browserType
    lastBrowserMode = browserMode
    lastCallbackScheme = callbackURLScheme
    lastLogger = logger
    return try result.get()
  }

  func reset() {
    resetCalled = true
    resetExpectation?.fulfill()
  }
}
