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

  /// Stable error codes emitted by the Browser module.
  ///
  /// Keep these in sync with JS `BrowserErrorCode` and Android `BrowserErrorCodes`.
  private enum BrowserErrorCode: String {
    case openError = "BROWSER_OPEN_ERROR"
  }

  /// Adapter used to launch and reset the native browser session.
  internal static var browserLauncher: BrowserLaunching = DefaultBrowserLauncherAdapter()

#if DEBUG
  /// Replace the browser launcher for unit tests.
  public static func _setBrowserLauncherForTesting(_ launcher: BrowserLaunching) {
    browserLauncher = launcher
  }

  /// Reset the browser launcher after tests.
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
    // Validate required options before launching.
    guard let callbackScheme = options["callbackUrlScheme"] as? String,
          !callbackScheme.isEmpty else {
      let error = GenericError(
        type: .argumentError,
        error: BrowserErrorCode.openError.rawValue,
        message: "callbackUrlScheme is required"
      )
      reject(error, rejecter: rejecter)
      return
    }

    guard let launchUrl = URL(string: url) else {
      let error = GenericError(
        type: .argumentError,
        error: BrowserErrorCode.openError.rawValue,
        message: "Invalid URL"
      )
      reject(error, rejecter: rejecter)
      return
    }

    let iosOptions = options["ios"] as? NSDictionary
    let browserTypeRaw = iosOptions?["browserType"] as? String
    let browserModeRaw = iosOptions?["browserMode"] as? String

    let browserType: BrowserType
    if browserTypeRaw == "ephemeralAuthSession" {
      browserType = .ephemeralAuthSession
    } else {
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

        resolver([
          "type": "success",
          "url": result.absoluteString
        ])
      } catch let error as BrowserError {
        if case .externalUserAgentCancelled = error {
          resolver(["type": "cancel"])
        } else {
          // Browser errors are mapped to the shared native error contract.
          let mapped = GenericError(
            type: .internalError,
            error: BrowserErrorCode.openError.rawValue,
            message: error.localizedDescription
          )
          reject(mapped, rejecter: rejecter, underlyingError: error as NSError)
        }
      } catch let error as ASWebAuthenticationSessionError {
        if error.code == .canceledLogin {
          resolver(["type": "cancel"])
        } else {
          let mapped = GenericError(
            type: .internalError,
            error: BrowserErrorCode.openError.rawValue,
            message: error.localizedDescription,
            code: error.code.rawValue
          )
          reject(mapped, rejecter: rejecter, underlyingError: error as NSError)
        }
      } catch {
        let mapped = GenericError(
          type: .internalError,
          error: BrowserErrorCode.openError.rawValue,
          message: error.localizedDescription
        )
        reject(mapped, rejecter: rejecter, underlyingError: error as NSError)
      }
    }
  }
}
