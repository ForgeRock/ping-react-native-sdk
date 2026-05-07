/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import Foundation

/// A concrete MFA policy that can be registered via the React Native bridge and later
/// resolved into a native `MfaPolicy` instance.
///
/// Both shipped policies (`biometricAvailable` and `deviceTampering`) are param-less at
/// bridge config time. The `DeviceTampering` score threshold is read from the credential's
/// server-supplied `policies` JSON string at evaluation time — it is not a bridge-config
/// parameter.
///
/// - Note: Verified against `ping-ios-sdk@2d6e3eb` — `Commons/Commons/Policy/` and
///   `TamperDetector/TamperDetector/`. Add new cases here when the upstream SDK ships new
///   concrete `MfaPolicy` implementations.
public enum OathPolicyDescriptor: Sendable {
  /// Enforce that biometric authentication is available on the device.
  case biometricAvailable

  /// Enforce device integrity via tamper-detection scoring.
  ///
  /// The `score` threshold is supplied by the server in the credential's `policies` JSON
  /// field — it is not a constructor parameter at bridge-config time.
  case deviceTampering
}

/// Native handle contract for an OATH policy evaluator configuration registered via the bridge.
///
/// Conforming types are stored in `CoreRuntime.oathPolicyEvaluatorRegistry` and resolved by
/// `RNPingOathCommon` at `OathClient.createClient` time.
///
/// - Note: The descriptor stores plain `Sendable` data (not the live `MfaPolicyEvaluator`
///   actor) so that capture across `Task` boundaries satisfies Swift 6 strict concurrency.
public protocol OathPolicyEvaluatorConfigHandleContract: NativeHandle, Sendable {
  /// Ordered list of policies to enforce. Must be non-empty.
  var policies: [OathPolicyDescriptor] { get }

  /// Optional logger handle id from `CoreRuntime.loggerRegistry`.
  ///
  /// When `nil`, the evaluator inherits the logger resolved from `OathClientConfig.loggerId`.
  var loggerId: String? { get }
}
