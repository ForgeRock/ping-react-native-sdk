/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import {
  fromNativeAuthenticationResult,
  fromNativeJourneyResult,
  fromNativeRegistrationResult,
  getNativeModule,
  toNativeConfigOptions,
  toNativeAuthenticationOptions,
  toNativeJourneyAuthenticationOptions,
  toNativeJourneyRegistrationOptions,
  toNativeRegistrationOptions,
} from './NativeRNPingFido';
import type { LoggerInstance } from '@ping-identity/rn-types';
import type {
  FidoClient,
  FidoClientConfig,
  FidoConfig,
  FidoAuthenticationOptions,
  FidoAuthenticationResult,
  FidoJourneyAuthenticationOptions,
  FidoJourneyRegistrationOptions,
  FidoJourneyResult,
  FidoRegistrationOptions,
  FidoRegistrationResult,
  JourneyInstance,
} from './types';
import { FidoError } from './types';

const noopLogger: LoggerInstance = {
  nativeHandle: { id: '' },
  changeLevel: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

/**
 * Creates a reusable FIDO client instance.
 *
 * @param config Runtime FIDO configuration payload.
 * @returns A FIDO client bound to the resolved configuration.
 * @throws Error when the native FIDO module is unavailable.
 *
 * @remarks
 * Logger integration is optional and uses `logger(...).nativeHandle.id` when provided.
 *
 * Current runtime behavior:
 * - Android applies `useFido2Client` for standalone FIDO operations.
 * - iOS accepts this config shape, but no iOS-native client-level config is applied yet.
 */
export function createFidoClient(config: FidoConfig = {}): FidoClient {
  const logger = config.logger ?? noopLogger;
  const resolvedConfig: FidoClientConfig = {
    loggerId: logger.nativeHandle?.id?.trim() || undefined,
    useFido2Client: config.android?.useFido2Client,
  };

  logger.debug(
    `FIDO createClient config ${JSON.stringify(
      {
        hasLogger: Boolean(resolvedConfig.loggerId),
        android: { useFido2Client: resolvedConfig.useFido2Client },
      },
      null,
      2,
    )}`,
  );
  logger.info('FIDO createClient success');

  return {
    /**
     * Registers a new FIDO credential using native platform APIs.
     *
     * @param options Registration options payload.
     * @returns A promise that resolves to the registration result payload.
     * @throws FidoError when native registration fails.
     */
    async register(
      options: FidoRegistrationOptions,
    ): Promise<FidoRegistrationResult> {
      logger.info('FIDO register requested');
      try {
        const result = await getNativeModule().registerCredential(
          toNativeRegistrationOptions(options),
          toNativeConfigOptions(resolvedConfig),
        );
        logger.debug('FIDO register success');
        return fromNativeRegistrationResult(result);
      } catch (error) {
        logger.error('FIDO register failed');
        throw FidoError.from(error);
      }
    },
    /**
     * Authenticates with an existing FIDO credential using native platform APIs.
     *
     * @param options Authentication options payload.
     * @returns A promise that resolves to the authentication result payload.
     * @throws FidoError when native authentication fails.
     */
    async authenticate(
      options: FidoAuthenticationOptions,
    ): Promise<FidoAuthenticationResult> {
      logger.info('FIDO authenticate requested');
      try {
        const result = await getNativeModule().authenticateCredential(
          toNativeAuthenticationOptions(options),
          toNativeConfigOptions(resolvedConfig),
        );
        logger.debug('FIDO authenticate success');
        return fromNativeAuthenticationResult(result);
      } catch (error) {
        logger.error('FIDO authenticate failed');
        throw FidoError.from(error);
      }
    },
    /**
     * Executes an active Journey FIDO registration callback.
     *
     * @param journey Active Journey instance.
     * @param options Optional registration callback execution options.
     * @returns A promise that resolves when callback execution succeeds.
     * @throws FidoError when callback execution fails.
     */
    async registerForJourney(
      journey: JourneyInstance,
      options: FidoJourneyRegistrationOptions = {},
    ): Promise<FidoJourneyResult> {
      logger.info('FIDO registerForJourney requested');
      try {
        const journeyId = await journey.getId();
        const result = await getNativeModule().registerCredentialForJourney(
          journeyId,
          toNativeJourneyRegistrationOptions(options),
          toNativeConfigOptions(resolvedConfig),
        );
        logger.debug('FIDO registerForJourney success');
        return fromNativeJourneyResult(result);
      } catch (error) {
        logger.error('FIDO registerForJourney failed');
        throw FidoError.from(error);
      }
    },
    /**
     * Executes an active Journey FIDO authentication callback.
     *
     * @param journey Active Journey instance.
     * @param options Optional authentication callback execution options.
     * @returns A promise that resolves when callback execution succeeds.
     * @throws FidoError when callback execution fails.
     */
    async authenticateForJourney(
      journey: JourneyInstance,
      options: FidoJourneyAuthenticationOptions = {},
    ): Promise<FidoJourneyResult> {
      logger.info('FIDO authenticateForJourney requested');
      try {
        const journeyId = await journey.getId();
        const result = await getNativeModule().authenticateCredentialForJourney(
          journeyId,
          toNativeJourneyAuthenticationOptions(options),
          toNativeConfigOptions(resolvedConfig),
        );
        logger.debug('FIDO authenticateForJourney success');
        return fromNativeJourneyResult(result);
      } catch (error) {
        logger.error('FIDO authenticateForJourney failed');
        throw FidoError.from(error);
      }
    },
  };
}

export { FidoError } from './types';
export type {
  FidoAndroidConfig,
  FidoClient,
  FidoClientConfig,
  FidoConfig,
  FidoAuthenticationOptions,
  FidoAuthenticationResult,
  FidoErrorCode,
  FidoJourneyAuthenticationOptions,
  FidoJourneyRegistrationOptions,
  FidoJourneyResult,
  FidoJsonValue,
  FidoRegistrationOptions,
  FidoRegistrationResult,
  JourneyInstance,
} from './types';
