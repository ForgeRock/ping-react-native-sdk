/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  GenericError,
  OathPolicyEvaluatorHandle,
} from '@ping-identity/rn-types';
import { getNativeModule } from './NativeRNPingOath';
import type { OathMfaPolicy, OathPolicyEvaluatorConfig } from './types';

// MfaPolicy parity check — verified against ping-android-sdk@c939521 / ping-ios-sdk@2d6e3eb
const VALID_POLICY_KINDS = new Set<OathMfaPolicy['kind']>([
  'biometricAvailable',
  'deviceTampering',
]);

/**
 * Registers an OATH policy evaluator configuration with the native registry and
 * returns a branded handle that can be passed as `OathClientConfig.policyEvaluator`.
 *
 * @param config - Policy evaluator configuration specifying the policies to enforce.
 * @returns A branded {@link OathPolicyEvaluatorHandle} containing the native registry id.
 * @throws {@link GenericError} with `type: 'argument_error'` when `policies` is empty
 *   or contains an unrecognised kind.
 *
 * @remarks
 * The `score` threshold used by `deviceTampering` is read from the credential's
 * server-supplied `policies` JSON string at evaluation time — it is **not** a
 * config parameter here.
 *
 * When `loggerId` is omitted the evaluator inherits the logger supplied via
 * `OathClientConfig.logger` at client-creation time.
 *
 * This function is synchronous. The returned handle must be passed to
 * `createOathClient({ policyEvaluator: handle })`.
 *
 * @example
 * ```ts
 * import { configureOathPolicyEvaluator, createOathClient } from '@ping-identity/rn-oath';
 *
 * const evaluator = configureOathPolicyEvaluator({
 *   policies: [{ kind: 'biometricAvailable' }, { kind: 'deviceTampering' }],
 * });
 *
 * const client = await createOathClient({ policyEvaluator: evaluator });
 * ```
 *
 * @example
 * With an explicit logger id:
 * ```ts
 * import { logger } from '@ping-identity/rn-logger';
 * import { configureOathPolicyEvaluator, createOathClient } from '@ping-identity/rn-oath';
 *
 * const log = logger({ level: 'debug' });
 * const evaluator = configureOathPolicyEvaluator({
 *   policies: [{ kind: 'biometricAvailable' }],
 *   loggerId: log.nativeHandle.id,
 * });
 *
 * const client = await createOathClient({ policyEvaluator: evaluator });
 * ```
 */
export function configureOathPolicyEvaluator(
  config: OathPolicyEvaluatorConfig,
): OathPolicyEvaluatorHandle {
  if (
    !config ||
    !Array.isArray(config.policies) ||
    config.policies.length === 0
  ) {
    throw {
      type: 'argument_error',
      error: 'OATH_INVALID_PARAMETER',
      message:
        '[@ping-identity/rn-oath] configureOathPolicyEvaluator: policies must be a non-empty array.',
    } satisfies GenericError;
  }

  for (const policy of config.policies) {
    if (!VALID_POLICY_KINDS.has(policy.kind)) {
      throw {
        type: 'argument_error',
        error: 'OATH_INVALID_PARAMETER',
        message: `[@ping-identity/rn-oath] configureOathPolicyEvaluator: unknown policy kind "${policy.kind}". Valid kinds: ${[...VALID_POLICY_KINDS].join(', ')}.`,
      } satisfies GenericError;
    }
  }

  const id = getNativeModule().registerOathPolicyEvaluator({
    policies: config.policies.map((p) => p.kind),
    ...(config.loggerId !== undefined ? { loggerId: config.loggerId } : {}),
  });

  return {
    id,
    kind: 'oath_policy_evaluator',
  } as unknown as OathPolicyEvaluatorHandle;
}
