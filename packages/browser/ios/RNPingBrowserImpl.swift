//
//  RNPingBrowserImpl.swift
//  RNPingBrowser
//
//  Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
//  This software may be modified and distributed under the terms
//  of the MIT license. See the LICENSE file for details.
//

import Foundation

/// Swift entry point used by the Obj-C++ bridges.
@MainActor
@objcMembers
public class RNPingBrowserImpl: NSObject {

  /// Shared singleton instance.
  public static let shared = RNPingBrowserImpl()

  private override init() {
    super.init()
  }

  /// Apply global configuration (currently a no-op on iOS).
  public func configure(_ config: NSDictionary) {
    RNPingBrowserCommon.configure(config)
  }

  /// Reset any in-flight browser session.
  public func reset() {
    RNPingBrowserCommon.reset()
  }

  /// Launch the browser flow.
  public func open(
    _ url: String,
    options: NSDictionary,
    resolver: @escaping (NSDictionary) -> Void,
    rejecter: @escaping (String, String, NSError?) -> Void
  ) {
    RNPingBrowserCommon.open(url, options: options, resolver: resolver, rejecter: rejecter)
  }
}
