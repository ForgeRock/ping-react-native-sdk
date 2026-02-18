//
//  RNPingBrowserCommon.swift
//  RNPingBrowser
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation
import PingBrowser
import AuthenticationServices
import RNPingCore

/// Common iOS implementation for the Ping Browser React Native module.
@objcMembers
public class RNPingBrowserCommon: NSObject {
  /// Sendable wrapper around React Native resolver/rejecter closures.
  ///
  /// Swift 6 treats `Task` closures as `@Sendable`. Wrapping bridge callbacks keeps
  /// the closure capture surface explicit while preserving the existing JS promise contract.
  private final class PromiseHandlers: @unchecked Sendable {
    private let resolver: (NSDictionary) -> Void
    private let rejecter: (String, String, NSError?) -> Void

    init(
      resolver: @escaping (NSDictionary) -> Void,
      rejecter: @escaping (String, String, NSError?) -> Void
    ) {
      self.resolver = resolver
      self.rejecter = rejecter
    }

    @MainActor
    func resolve(_ value: NSDictionary) {
      resolver(value)
    }

    @MainActor
    func reject(_ error: GenericError, underlying: NSError? = nil) {
      RNPingCore.reject(error, rejecter: rejecter, underlyingError: underlying)
    }
  }

  /// Stable error codes emitted by the Browser module.
  ///
  /// Keep these in sync with JS `BrowserErrorCode` and Android `BrowserErrorCodes`.
  private enum BrowserErrorCode: String {
    case openError = "BROWSER_OPEN_ERROR"
  }

  /// Adapter used to launch and reset the native browser session.
  @MainActor
  internal static var browserLauncher: BrowserLaunching = DefaultBrowserLauncherAdapter()

#if DEBUG
  /// Replace the browser launcher for unit tests.
  @MainActor
  public static func _setBrowserLauncherForTesting(_ launcher: BrowserLaunching) {
    browserLauncher = launcher
  }

  /// Reset the browser launcher after tests.
  @MainActor
  public static func _resetBrowserLauncherForTesting() {
    browserLauncher = DefaultBrowserLauncherAdapter()
  }
#endif

  /// Accepts configuration from JavaScript (currently a no-op on iOS).
  ///
  /// - Parameter config: Optional configuration payload from the JS layer.
  @objc
  public static func configure(_ config: NSDictionary) {
    // Reserved for future iOS customization.
  }

  /// Resets any in-flight browser session.
  ///
  /// This cancels the current browser flow when supported by the native launcher.
  @objc
  public static func reset() {
    Task { @MainActor in
      browserLauncher.reset()
    }
  }

  /// Launches a browser session and reports success, cancel, or error.
  ///
  /// - Parameters:
  ///   - url: The URL to launch in the system browser.
  ///   - options: Launch options including callback scheme and iOS settings.
  ///   - resolver: Callback invoked with the result payload.
  ///   - rejecter: Callback invoked for validation or launch errors.
  @objc
  public static func open(
    _ url: String,
    options: NSDictionary,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    let handlers = PromiseHandlers(resolver: resolver, rejecter: rejecter)

    // Validate required options before launching.
    guard let callbackScheme = options["callbackUrlScheme"] as? String,
          !callbackScheme.isEmpty else {
      let error = GenericError(
        type: .argumentError,
        error: BrowserErrorCode.openError.rawValue,
        message: "callbackUrlScheme is required"
      )
      Task { @MainActor in
        handlers.reject(error)
      }
      return
    }

    guard let launchUrl = URL(string: url) else {
      let error = GenericError(
        type: .argumentError,
        error: BrowserErrorCode.openError.rawValue,
        message: "Invalid URL"
      )
      Task { @MainActor in
        handlers.reject(error)
      }
      return
    }

    let iosOptions = options["ios"] as? NSDictionary
    let browserTypeRaw = iosOptions?["browserType"] as? String
    let browserModeRaw = iosOptions?["browserMode"] as? String

    let browserType: BrowserType
    switch browserTypeRaw {
    case "ephemeralAuthSession":
      browserType = .ephemeralAuthSession
    case "nativeBrowserApp":
      browserType = .nativeBrowserApp
    case "sfViewController":
      browserType = .sfViewController
    default:
      browserType = .authSession
    }
    let browserMode: BrowserMode
    switch browserModeRaw {
    case "logout":
      browserMode = .logout
    case "custom":
      browserMode = .custom
    default:
      browserMode = .login
    }

    Task { @MainActor in
      do {
        let result = try await browserLauncher.launch(
          url: launchUrl,
          customParams: nil,
          browserType: browserType,
          browserMode: browserMode,
          callbackURLScheme: callbackScheme
        )

        handlers.resolve([
          "type": "success",
          "url": result.absoluteString
        ])
      } catch let error as BrowserError {
        if case .externalUserAgentCancelled = error {
          handlers.resolve(["type": "cancel"])
        } else {
          // Browser errors are mapped to the shared native error contract.
          let mapped = GenericError(
            type: .internalError,
            error: BrowserErrorCode.openError.rawValue,
            message: error.localizedDescription
          )
          handlers.reject(mapped, underlying: error as NSError)
        }
      } catch let error as ASWebAuthenticationSessionError {
        if error.code == .canceledLogin {
          handlers.resolve(["type": "cancel"])
        } else {
          let mapped = GenericError(
            type: .internalError,
            error: BrowserErrorCode.openError.rawValue,
            message: error.localizedDescription,
            code: error.code.rawValue
          )
          handlers.reject(mapped, underlying: error as NSError)
        }
      } catch {
        let mapped = GenericError(
          type: .internalError,
          error: BrowserErrorCode.openError.rawValue,
          message: error.localizedDescription
        )
        handlers.reject(mapped, underlying: error as NSError)
      }
    }
  }
}
