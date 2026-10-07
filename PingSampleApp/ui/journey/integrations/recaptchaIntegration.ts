/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { RecaptchaClient } from '@ping-identity/rn-recaptcha';
import type { JourneyIntegration } from './types';

/**
 * Builds the Journey integration for reCAPTCHA Enterprise callbacks backed by
 * `@ping-identity/rn-recaptcha`.
 *
 * Verification is non-interactive (no native UI), so the field is
 * auto-forwardable: the runner executes it as soon as the node has no other
 * manual input to collect. The site key is read natively from the callback
 * payload; no caller-supplied value is needed.
 *
 * @param recaptcha - reCAPTCHA client created via `createRecaptchaClient(...)`.
 * @returns Integration descriptor consumed by the auto-forwarder.
 */
export function recaptchaIntegration(
  recaptcha: RecaptchaClient,
): JourneyIntegration {
  return {
    id: 'recaptcha',
    callbackTypes: ['ReCaptchaEnterpriseCallback'],
    canAutoForwardField(field) {
      return field.type === 'ReCaptchaEnterpriseCallback';
    },
    async run(field, journey) {
      if (field.type !== 'ReCaptchaEnterpriseCallback') {
        return {};
      }
      const result = await recaptcha.verifyForJourney(journey, {
        index: field.ref.typeIndex,
      });
      return { cancelled: false, result };
    },
  };
}
