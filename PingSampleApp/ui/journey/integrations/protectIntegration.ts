/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import {
  collectProtectForJourney,
  initializeProtectForJourney,
} from '@ping-identity/rn-protect';
import type { LoggerInstance } from '@ping-identity/rn-types';
import type { JourneyIntegration } from './types';

/**
 * Protect integration options.
 */
export type ProtectIntegrationOptions = {
  /**
   * Optional logger forwarded to the Protect Journey operations.
   */
  logger?: LoggerInstance;
};

/**
 * Builds the Journey integration for PingOne Protect initialize and
 * evaluation callbacks backed by `@ping-identity/rn-protect`.
 *
 * Both callbacks are auto-forwardable: neither renders a user-facing input.
 * The initialize callback is configured entirely by the tree, so there is no
 * app-supplied `ProtectConfig` fallback. A tree whose initialize callback
 * carries no usable configuration fails loudly instead of initializing Protect
 * against a different environment.
 *
 * @param options - Additional integration wiring options.
 * @returns Integration descriptor consumed by the auto-forwarder.
 */
export function protectIntegration(
  options: ProtectIntegrationOptions = {},
): JourneyIntegration {
  return {
    id: 'protect',
    callbackTypes: [
      'PingOneProtectInitializeCallback',
      'PingOneProtectEvaluationCallback',
    ],
    canAutoForwardField() {
      return true;
    },
    async run(field, journey) {
      if (field.type === 'PingOneProtectInitializeCallback') {
        await initializeProtectForJourney(journey, {
          logger: options.logger,
        });
        return {};
      }

      if (field.type === 'PingOneProtectEvaluationCallback') {
        await collectProtectForJourney(journey, {
          index: field.ref.typeIndex,
          logger: options.logger,
        });
        return {};
      }
      return {};
    },
  };
}
