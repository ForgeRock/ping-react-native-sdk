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

@objcMembers
public class RNPingBrowserCommon: NSObject {

  /// iOS has no global configuration for this SDK yet (no-op).
  @objc
  public static func configure(_ config: NSDictionary) {
    // Reserved for future iOS customization.
  }

  /// Reset any in-flight browser session.
  @objc
  public static func reset() {
    Task { @MainActor in
      BrowserLauncher.currentBrowser.reset()
    }
  }

  /// Launch a browser session and resolve with success/cancel, or reject on error.
  @objc
  public static func open(
    _ url: String,
    options: NSDictionary,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    guard let callbackScheme = options["callbackUrlScheme"] as? String,
          !callbackScheme.isEmpty else {
      rejecter("OPEN_ERROR", "callbackUrlScheme is required", nil)
      return
    }

    guard let launchUrl = URL(string: url) else {
      rejecter("OPEN_ERROR", "Invalid URL", nil)
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
        let result = try await BrowserLauncher.currentBrowser.launch(
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
          rejecter("OPEN_ERROR", error.localizedDescription, error as NSError)
        }
      } catch let error as ASWebAuthenticationSessionError {
        if error.code == .canceledLogin {
          resolver(["type": "cancel"])
        } else {
          rejecter("OPEN_ERROR", error.localizedDescription, error as NSError)
        }
      } catch {
        rejecter("OPEN_ERROR", error.localizedDescription, error as NSError)
      }
    }
  }
}
