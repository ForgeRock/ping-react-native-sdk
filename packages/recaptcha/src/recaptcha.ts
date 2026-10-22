/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { noopLogger } from '@ping-identity/rn-types';
import {
  fromNativeVerifyResult,
  getNativeModule,
  toNativeClientConfig,
  toNativeVerifyOptions,
} from './NativeRNPingRecaptcha';
import type { NativeRecaptchaConfig } from './NativeRNPingRecaptcha';
import { RecaptchaError, recaptchaErrorCodes } from './types';
import type {
  JourneyInstance,
  RecaptchaClient,
  RecaptchaConfig,
  RecaptchaVerifyOptions,
  RecaptchaVerifyResult,
} from './types';

/**
 * Validates a Journey instance before any native call is made.
 *
 * @param journey - Journey instance to validate.
 * @throws RecaptchaError with an `argument_error` type when the instance is
 * missing or does not expose a callable `getId`.
 */
function requireJourneyInstance(journey: JourneyInstance): void {
  if (!journey || typeof journey.getId !== 'function') {
    throw new RecaptchaError(
      'verifyForJourney requires a Journey instance exposing getId().',
      recaptchaErrorCodes.error,
      'argument_error',
    );
  }
}

/**
 * Creates a reusable reCAPTCHA Enterprise client.
 *
 * @param config - Optional runtime configuration (logger).
 * @returns A reCAPTCHA client bound to the resolved configuration.
 * @throws Error when the native reCAPTCHA module is unavailable.
 *
 * @remarks
 * Logger integration is optional and uses `logger(...).nativeHandle.id` when provided.
 *
 * No registration call is needed at factory time: the native reCAPTCHA callback
 * registers itself with the Journey runtime as soon as the native module is
 * linked (Android App Startup `CallbackInitializer`; iOS plugin probe in
 * PingJourney), unlike FIDO's explicit `registerDaVinciSerializer()` call.
 *
 * Only Journey-scoped verification is exposed — the native `verify()` reads the
 * site key from the callback payload and auto-submits token/action/clientError
 * into the callback inputs, so there is no callback-free verification entry
 * point in either native SDK.
 *
 * @example
 * ```ts
 * import { createRecaptchaClient } from '@ping-identity/rn-recaptcha';
 *
 * const recaptcha = createRecaptchaClient();
 * const journey = await createJourneyClient({ server: serverConfig });
 * const result = await recaptcha.verifyForJourney(journey, { index: 0 });
 * if (result.type === 'failure') {
 *   // Callback inputs already carry the client error; proceed to next() and
 *   // let the server decide whether to re-issue the Captcha node.
 * }
 * ```
 */
export function createRecaptchaClient(
  config: RecaptchaConfig = {},
): RecaptchaClient {
  const jsLogger = config.logger ?? noopLogger;
  const resolvedConfig: NativeRecaptchaConfig = {
    loggerId: jsLogger.nativeHandle?.id?.trim() || undefined,
  };

  jsLogger.debug(
    `reCAPTCHA createClient config ${JSON.stringify(
      { hasLogger: Boolean(resolvedConfig.loggerId) },
      null,
      2,
    )}`,
  );

  // Resolve eagerly so factory-time failures (missing native module) surface
  // at creation, matching the FIDO factory contract.
  getNativeModule();

  jsLogger.info('reCAPTCHA createClient success');

  return {
    /**
     * Executes the active Journey ReCaptchaEnterpriseCallback.
     *
     * @param journey - Active Journey instance (from `useJourney`'s client).
     * @param options - Optional verification options (index, action, timeoutMs, payload).
     * @returns Resolves to a discriminated result; see {@link RecaptchaVerifyResult}.
     * @throws RecaptchaError when the journey id is empty, no active
     * ReCaptchaEnterpriseCallback exists at `index`, or the native module is missing.
     */
    async verifyForJourney(
      journey: JourneyInstance,
      options: RecaptchaVerifyOptions = {},
    ): Promise<RecaptchaVerifyResult> {
      requireJourneyInstance(journey);
      jsLogger.info('reCAPTCHA verifyForJourney requested');
      try {
        const journeyId = await journey.getId();
        if (typeof journeyId !== 'string' || journeyId.trim().length === 0) {
          throw new RecaptchaError(
            'verifyForJourney requires a non-empty Journey instance id.',
            recaptchaErrorCodes.error,
            'argument_error',
          );
        }
        const result = await getNativeModule().verifyForJourney(
          journeyId,
          toNativeVerifyOptions(options),
          toNativeClientConfig(resolvedConfig),
        );
        jsLogger.debug('reCAPTCHA verifyForJourney success');
        return fromNativeVerifyResult(result);
      } catch (error) {
        jsLogger.error('reCAPTCHA verifyForJourney failed');
        throw RecaptchaError.from(error);
      }
    },
  };
}
