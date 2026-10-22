/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation
import React

/// Swift entry point for the reCAPTCHA native module.
///
/// - Note: No `@MainActor` is used — reCAPTCHA verification is headless, so
///   unlike FIDO the bridge methods carry no main-actor requirement.
@objcMembers
public final class RNPingRecaptchaImpl: NSObject, Sendable {

  /// Shared singleton instance.
  @objc public static let shared = RNPingRecaptchaImpl()

  /// Creates the singleton bridge implementation instance.
  @objc private override init() {
    super.init()
  }

  /// Executes the active Journey `ReCaptchaEnterpriseCallback`.
  ///
  /// - Parameters:
  ///   - journeyId: Native Journey instance id.
  ///   - options: Callback execution options (index, action, timeoutMs, payload).
  ///   - config: Per-call runtime configuration payload (loggerId).
  ///   - resolve: Promise resolver for the verification outcome payload.
  ///   - rejecter: Promise rejecter for bridge-level errors.
  @objc
  public func verifyForJourney(
    _ journeyId: String,
    options: NSDictionary,
    config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    RNPingRecaptchaCommon.verifyForJourney(
      journeyId,
      options: options,
      config: config,
      resolver: resolve,
      rejecter: rejecter
    )
  }
}
