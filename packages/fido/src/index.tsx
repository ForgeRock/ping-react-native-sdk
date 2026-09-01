/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import {
  fromNativeAuthenticationResult,
  fromNativeDaVinciResult,
  fromNativeJourneyResult,
  fromNativeRegistrationResult,
  getNativeModule,
  toNativeConfigOptions,
  toNativeAuthenticationOptions,
  toNativeDaVinciAuthenticationOptions,
  toNativeDaVinciRegistrationOptions,
  toNativeJourneyAuthenticationOptions,
  toNativeJourneyRegistrationOptions,
  toNativeRegistrationOptions,
} from './NativeRNPingFido';
import {
  noopLogger,
  registerIntegrationCollectorType,
} from '@ping-identity/rn-types';
import type {
  FidoClient,
  FidoClientConfig,
  FidoConfig,
  FidoAuthenticationOptions,
  FidoAuthenticationResult,
  FidoDaVinciAuthenticationOptions,
  FidoDaVinciRegistrationOptions,
  FidoDaVinciResult,
  FidoJourneyAuthenticationOptions,
  FidoJourneyRegistrationOptions,
  FidoJourneyResult,
  FidoRegistrationOptions,
  FidoRegistrationResult,
  JourneyInstance,
  DaVinciInstance,
} from './types';
import { FidoError, fidoCollectorType } from './types';

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
 * - The native logger id forwards to standalone iOS operations; Journey and
 *   DaVinci collector ceremonies keep their workflow-configured native logger.
 * - This call also registers `FIDO2` as an integration collector type, so
 *   DaVinci integration collectors activate as soon as a FIDO client exists.
 * - Client creation activates the FIDO integration, including native DaVinci
 *   serializer registration, so FIDO2 collectors serialize with their full
 *   payload as soon as a client exists.
 */
export function createFidoClient(config: FidoConfig = {}): FidoClient {
  registerIntegrationCollectorType(fidoCollectorType);
  getNativeModule().registerDaVinciSerializer();
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
    /**
     * Runs the native FIDO passkey ceremony for an active DaVinci `FIDO2` registration collector.
     *
     * @param daVinci Active DaVinci instance.
     * @param options Optional registration ceremony options.
     * @returns A promise that resolves to the WebAuthn attestation payload. Informational
     * only — submit natively by advancing the flow with `daVinci.next({ collectors: [] })`.
     * @throws FidoError when the ceremony fails or the collector cannot be resolved.
     */
    async registerForDaVinci(
      daVinci: DaVinciInstance,
      options: FidoDaVinciRegistrationOptions = {},
    ): Promise<FidoDaVinciResult> {
      logger.info('FIDO registerForDaVinci requested');
      try {
        const davinciId = await daVinci.getId();
        const result = await getNativeModule().registerCredentialForDaVinci(
          davinciId,
          toNativeDaVinciRegistrationOptions(options),
          toNativeConfigOptions(resolvedConfig),
        );
        logger.debug('FIDO registerForDaVinci success');
        return fromNativeDaVinciResult(result);
      } catch (error) {
        logger.error('FIDO registerForDaVinci failed');
        throw FidoError.from(error);
      }
    },
    /**
     * Runs the native FIDO passkey ceremony for an active DaVinci `FIDO2` authentication collector.
     *
     * @param daVinci Active DaVinci instance.
     * @param options Optional authentication ceremony options.
     * @returns A promise that resolves to the WebAuthn assertion payload. Informational
     * only — submit natively by advancing the flow with `daVinci.next({ collectors: [] })`.
     * @throws FidoError when the ceremony fails or the collector cannot be resolved.
     */
    async authenticateForDaVinci(
      daVinci: DaVinciInstance,
      options: FidoDaVinciAuthenticationOptions = {},
    ): Promise<FidoDaVinciResult> {
      logger.info('FIDO authenticateForDaVinci requested');
      try {
        const davinciId = await daVinci.getId();
        const result = await getNativeModule().authenticateCredentialForDaVinci(
          davinciId,
          toNativeDaVinciAuthenticationOptions(options),
          toNativeConfigOptions(resolvedConfig),
        );
        logger.debug('FIDO authenticateForDaVinci success');
        return fromNativeDaVinciResult(result);
      } catch (error) {
        logger.error('FIDO authenticateForDaVinci failed');
        throw FidoError.from(error);
      }
    },
  };
}

export { FidoError, fidoCollectorType } from './types';
export type {
  FidoAndroidConfig,
  FidoClient,
  FidoClientConfig,
  FidoConfig,
  FidoAuthenticationCollector,
  FidoAuthenticationOptions,
  FidoAuthenticationResult,
  FidoCollector,
  FidoDaVinciAuthenticationOptions,
  FidoDaVinciRegistrationOptions,
  FidoDaVinciResult,
  FidoErrorCode,
  FidoJourneyAuthenticationOptions,
  FidoJourneyRegistrationOptions,
  FidoJourneyResult,
  FidoJsonValue,
  FidoRegistrationCollector,
  FidoRegistrationOptions,
  FidoRegistrationResult,
  DaVinciInstance,
  JourneyInstance,
} from './types';
