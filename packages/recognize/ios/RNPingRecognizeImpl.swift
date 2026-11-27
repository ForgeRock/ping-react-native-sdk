/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import React

/// Swift entry point for the Recognize native module.
///
/// - Note: The Keyless ceremony presents its own camera UI, so
///   ``RNPingRecognizeCommon`` starts it from the main actor.
@objcMembers
public final class RNPingRecognizeImpl: NSObject, Sendable {

  /// Shared singleton instance.
  @objc public static let shared = RNPingRecognizeImpl()

  /// Creates the singleton bridge implementation instance.
  @objc private override init() {
    super.init()
  }

  /// Runs the active Journey Recognize callback.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Run options (`index`, `retrieveSelfie`).
  ///   - config: Per-call runtime configuration payload (currently unused).
  ///   - resolve: Promise resolver for the ceremony outcome payload.
  ///   - rejecter: Promise rejecter for bridge-level errors.
  @objc
  public func runForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingRecognizeCommon.runForJourney(
      journeyId,
      options: options,
      config: config,
      resolver: resolve,
      rejecter: rejecter
    )
  }
}
