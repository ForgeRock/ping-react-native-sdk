//
//  DefaultBrowserLauncherAdapter.swift
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

/// Default adapter that delegates to the Ping BrowserLauncher singleton.
public struct DefaultBrowserLauncherAdapter: BrowserLaunching {
  public init() {}

  // TODO: Accept a `logger:` parameter so the JS-resolved logger can be
  // forwarded to BrowserLauncher.launch() instead of the global LogManager
  // singleton. Requires extending the BrowserLaunching protocol too.
  public func launch(
    url: URL,
    customParams: [String: String]?,
    browserType: BrowserType,
    browserMode: BrowserMode,
    callbackURLScheme: String
  ) async throws -> URL {
    return try await BrowserLauncher.currentBrowser.launch(
      url: url,
      customParams: customParams,
      browserType: browserType,
      browserMode: browserMode,
      callbackURLScheme: callbackURLScheme,
      logger: LogManager.logger
    )
  }

  public func reset() {
    BrowserLauncher.currentBrowser.reset()
  }
}
