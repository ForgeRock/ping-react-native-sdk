/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import Foundation
import React
import RNPingCore

/// Implementation of the native FIDO bridge for React Native.
@available(iOS 16.0.0, *)
@objcMembers
public class RNPingFidoImpl: NSObject, @unchecked Sendable {

  /// Shared singleton instance.
  @objc public static let shared = RNPingFidoImpl()

  /// Stable error codes emitted by the FIDO module.
  ///
  /// Keep these in sync with JS `FidoErrorCode` and Android `FidoErrorCodes`.
  private enum FidoErrorCode: String {
    case fidoError = "FIDO_ERROR"
  }

  @objc private override init() {
    super.init()
  }

  /// Returns the default FIDO identifier.
  /// - Parameters:
  ///   - resolve: Promise resolver for the identifier string.
  ///   - rejecter: Promise rejecter for errors.
  @objc
  @MainActor
  public func getDefaultFido(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let mapped = GenericError(
      type: .fidoError,
      error: FidoErrorCode.fidoError.rawValue,
      message: "FIDO bridge is scaffolded but not implemented."
    )
    reject(mapped, rejecter: rejecter, underlyingError: mapped.asNSError())
  }
}
