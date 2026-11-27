/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import {
  noopLogger,
  registerIntegrationCollectorType,
} from '@ping-identity/rn-types';
import {
  fromNativeRunResult,
  getNativeModule,
  toNativeClientConfig,
  toNativeRunOptions,
} from './NativeRNPingRecognize';
import type { NativeRecognizeConfig } from './NativeRNPingRecognize';
import {
  RecognizeError,
  recognizeCollectorType,
  recognizeErrorCodes,
} from './types';
import type {
  DaVinciInstance,
  JourneyInstance,
  RecognizeClient,
  RecognizeConfig,
  RecognizeResult,
  RecognizeRunOptions,
} from './types';

function requireJourneyInstance(journey: JourneyInstance): void {
  if (!journey || typeof journey.getId !== 'function') {
    throw new RecognizeError(
      'runForJourney requires a Journey instance exposing getId().',
      recognizeErrorCodes.error,
      'argument_error',
    );
  }
}

function requireDaVinciInstance(daVinci: DaVinciInstance): void {
  if (!daVinci || typeof daVinci.getId !== 'function') {
    throw new RecognizeError(
      'runForDaVinci requires a DaVinci instance exposing getId().',
      recognizeErrorCodes.error,
      'argument_error',
    );
  }
}

/**
 * Creates a Recognize client for Journey flows.
 *
 * @param config - Optional runtime configuration (logger).
 * @returns A {@link RecognizeClient}.
 * @throws Error when the native Recognize module is not linked.
 * @example
 * ```ts
 * const recognize = createRecognizeClient();
 * await recognize.runForJourney(journey, { index: 0 });
 * ```
 */
export function createRecognizeClient(
  config: RecognizeConfig = {},
): RecognizeClient {
  registerIntegrationCollectorType(recognizeCollectorType);
  const jsLogger = config.logger ?? noopLogger;
  const resolvedConfig: NativeRecognizeConfig = {
    loggerId: jsLogger.nativeHandle?.id?.trim() || undefined,
  };

  jsLogger.debug(
    `Recognize createClient config ${JSON.stringify(
      { hasLogger: Boolean(resolvedConfig.loggerId) },
      null,
      2,
    )}`,
  );

  // Resolve eagerly so factory-time failures (missing native module) surface
  // at creation, matching the other native-backed client factories.
  getNativeModule();

  jsLogger.info('Recognize createClient success');

  return {
    async runForJourney(
      journey: JourneyInstance,
      options: RecognizeRunOptions = {},
    ): Promise<RecognizeResult> {
      requireJourneyInstance(journey);
      jsLogger.info('Recognize runForJourney requested');
      try {
        const journeyId = await journey.getId();
        if (typeof journeyId !== 'string' || journeyId.trim().length === 0) {
          throw new RecognizeError(
            'runForJourney requires a non-empty Journey instance id.',
            recognizeErrorCodes.error,
            'argument_error',
          );
        }
        const result = await getNativeModule().runForJourney(
          journeyId,
          toNativeRunOptions(options),
          toNativeClientConfig(resolvedConfig),
        );
        jsLogger.debug('Recognize runForJourney success');
        return fromNativeRunResult(result);
      } catch (error) {
        jsLogger.error('Recognize runForJourney failed');
        throw RecognizeError.from(error);
      }
    },

    async runForDaVinci(
      daVinci: DaVinciInstance,
      options: RecognizeRunOptions = {},
    ): Promise<RecognizeResult> {
      requireDaVinciInstance(daVinci);
      jsLogger.info('Recognize runForDaVinci requested');
      try {
        const davinciId = await daVinci.getId();
        if (typeof davinciId !== 'string' || davinciId.trim().length === 0) {
          throw new RecognizeError(
            'runForDaVinci requires a non-empty DaVinci instance id.',
            recognizeErrorCodes.error,
            'argument_error',
          );
        }
        const result = await getNativeModule().runForDaVinci(
          davinciId,
          toNativeRunOptions(options),
          toNativeClientConfig(resolvedConfig),
        );
        jsLogger.debug('Recognize runForDaVinci success');
        return fromNativeRunResult(result);
      } catch (error) {
        jsLogger.error('Recognize runForDaVinci failed');
        throw RecognizeError.from(error);
      }
    },
  };
}
