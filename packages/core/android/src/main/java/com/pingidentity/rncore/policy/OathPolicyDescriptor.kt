/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

package com.pingidentity.rncore.policy

import com.pingidentity.rncore.registry.NativeHandle

/**
 * Sealed class representing a concrete MFA policy that can be registered via the React Native
 * bridge and later resolved into a native `MfaPolicy` instance.
 *
 * Both shipped policies (`BiometricAvailable` and `DeviceTampering`) are param-less at bridge
 * config time. The `DeviceTampering` score threshold is read from the credential's server-supplied
 * `policies` JSON string at evaluation time — it is not a bridge-config parameter.
 *
 * @remarks
 * Verified against `ping-android-sdk@c939521` — `mfa/commons/src/main/kotlin/com/pingidentity/mfa/commons/policy/`.
 * Add new arms here when the upstream SDK ships new concrete `MfaPolicy` implementations.
 */
sealed class OathPolicyDescriptor {
  /** Enforce that biometric authentication is available on the device. */
  object BiometricAvailable : OathPolicyDescriptor()

  /**
   * Enforce device integrity via tamper-detection scoring.
   *
   * The `score` threshold is supplied by the server in the credential's `policies` JSON field —
   * it is not a constructor parameter at bridge-config time.
   */
  object DeviceTampering : OathPolicyDescriptor()
}

/**
 * Native handle contract for an OATH policy evaluator configuration registered via the bridge.
 *
 * Implementors are stored in `CoreRuntime.oathPolicyEvaluatorRegistry` and resolved by
 * `RNPingOathCommon` at `OathClient.create` time.
 *
 * @remarks
 * The descriptor stores plain data (not the live `MfaPolicyEvaluator`) so that `Sendable`
 * requirements across actor/task boundaries are trivially satisfied on both Android and iOS.
 */
interface OathPolicyEvaluatorConfigHandleContract : NativeHandle {
  /** Ordered list of policies to enforce. Must be non-empty. */
  val policies: List<OathPolicyDescriptor>

  /**
   * Optional logger handle id from `CoreRuntime.loggerRegistry`.
   *
   * When `null`, the evaluator inherits the logger resolved from `OathClientConfig.loggerId`.
   */
  val loggerId: String?
}
