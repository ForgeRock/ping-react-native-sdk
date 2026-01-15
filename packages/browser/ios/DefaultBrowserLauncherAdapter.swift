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

/// Default adapter that delegates to the Ping BrowserLauncher singleton.
public struct DefaultBrowserLauncherAdapter: @MainActor BrowserLaunching {
  public init() {}

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
      callbackURLScheme: callbackURLScheme
    )
  }

  @MainActor public func reset() {
    BrowserLauncher.currentBrowser.reset()
  }
}
