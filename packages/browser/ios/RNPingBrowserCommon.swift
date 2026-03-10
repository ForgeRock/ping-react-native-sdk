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
import PingLogger
import AuthenticationServices
import RNPingCore
import RNPingLogger

/// Common iOS implementation for the Ping Browser React Native module.
@objcMembers
public class RNPingBrowserCommon: NSObject {
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
  ///   - options: Launch options including callback scheme, iOS settings, and optional loggerId.
  ///   - resolver: Callback invoked with the result payload.
  ///   - rejecter: Callback invoked for validation or launch errors.
  @objc
  public static func open(
    _ url: String,
    options: NSDictionary,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    let handlers = PromiseBridge<NSDictionary>(resolver: resolver, rejecter: rejecter)
    let loggerId = options["loggerId"] as? String

    // Validate required options before launching.
    guard let callbackScheme = options["callbackUrlScheme"] as? String,
          !callbackScheme.isEmpty else {
      let error = GenericError(
        type: .argumentError,
        error: BrowserErrorCode.openError.rawValue,
        message: "callbackUrlScheme is required"
      )
      handlers.reject(error)
      return
    }

    guard let launchUrl = URL(string: url) else {
      let error = GenericError(
        type: .argumentError,
        error: BrowserErrorCode.openError.rawValue,
        message: "Invalid URL"
      )
      handlers.reject(error)
      return
    }
    guard isSupportedHttpUrl(launchUrl) else {
      let error = GenericError(
        type: .argumentError,
        error: BrowserErrorCode.openError.rawValue,
        message: "Unsupported URL scheme. Only HTTP and HTTPS URLs are supported."
      )
      handlers.reject(error)
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
      // TODO: When PingBrowser exposes `BrowserLauncher.logger` as public, switch to per-call logger wiring.
      // Example future implementation:
      // if let loggerId = options["loggerId"] as? String,
      //    RNPingLoggerImpl.shared.applyLogger(loggerId) {
      //   BrowserLauncher.logger = LogManager.logger
      // } else {
      //   BrowserLauncher.logger = LogManager.none
      // }
      // TODO: Apply loggerId once Browser can support non-global logger wiring.
      // Intentionally disabled for now to avoid SDK-wide logger side effects.
      // _ = RNPingLoggerImpl.shared.applyLogger(loggerId)

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
        ] as NSDictionary)
      } catch let error as BrowserError {
        if case .externalUserAgentCancelled = error {
          handlers.resolve(["type": "cancel"] as NSDictionary)
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
          handlers.resolve(["type": "cancel"] as NSDictionary)
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

  /// Validates that a URL uses an HTTP(S) scheme.
  ///
  /// - Parameter url: URL provided from JavaScript.
  /// - Returns: `true` when the URL scheme is `http` or `https`.
  private static func isSupportedHttpUrl(_ url: URL) -> Bool {
    guard let scheme = url.scheme?.lowercased() else {
      return false
    }
    return scheme == "http" || scheme == "https"
  }
}
