//
//  BrowserLaunching.swift
//  RNPingBrowser
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation
import PingBrowser

/// Abstraction over the Ping Browser launcher for testability.
public protocol BrowserLaunching {
  func launch(
    url: URL,
    customParams: [String: String]?,
    browserType: BrowserType,
    browserMode: BrowserMode,
    callbackURLScheme: String
  ) async throws -> URL

  func reset()
}
