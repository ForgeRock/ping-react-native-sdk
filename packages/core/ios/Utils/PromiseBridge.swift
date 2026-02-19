/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// Sendable bridge for React Native promise resolver/rejecter closures.
///
/// This wrapper is intended for closures captured inside Swift concurrency
/// tasks where closure sendability must be explicit.
///
/// - Note: The bridge is intentionally `@unchecked Sendable` because React
///   promise callback closures are Objective-C blocks and are not statically
///   modeled as `Sendable`.
public final class PromiseBridge<Value>: @unchecked Sendable {
  private let resolver: (Value) -> Void
  private let rejecter: ((String, String, NSError?) -> Void)?

  /// Creates a promise bridge.
  ///
  /// - Parameters:
  ///   - resolver: Promise resolve callback.
  ///   - rejecter: Promise reject callback.
  public init(
    resolver: @escaping (Value) -> Void,
    rejecter: ((String, String, NSError?) -> Void)? = nil
  ) {
    self.resolver = resolver
    self.rejecter = rejecter
  }

  /// Resolves the bridged promise.
  ///
  /// - Parameter value: Resolved payload.
  public func resolve(_ value: Value) {
    resolver(value)
  }

  /// Rejects the bridged promise using the shared native error contract.
  ///
  /// - Parameters:
  ///   - error: Generic error payload.
  ///   - underlying: Optional underlying native error.
  public func reject(_ error: GenericError, underlying: NSError? = nil) {
    guard let rejecter else {
      return
    }
    let message = error.message ?? "Unknown error"
    rejecter(error.error, message, underlying ?? error.asNSError())
  }

  /// Rejects the bridged promise with explicit error code and message.
  ///
  /// - Parameters:
  ///   - code: Stable module error code.
  ///   - message: Human-readable error message.
  ///   - underlying: Optional underlying native error.
  public func reject(code: String, message: String, underlying: NSError? = nil) {
    rejecter?(code, message, underlying)
  }
}
