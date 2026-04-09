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
  const resolvedConfig: FidoClientConfig = {
    loggerId: config.logger?.nativeHandle?.id?.trim() || undefined,
    useFido2Client: config.android?.useFido2Client,
  };

  return {
    /**
     * Registers a new FIDO credential using native platform APIs.
     *
     * @param options Registration options payload.
     * @returns A promise that resolves to the registration result payload.
     * @throws FidoError when native registration fails.
     */
    async register(options: FidoRegistrationOptions): Promise<FidoRegistrationResult> {
      const result = await getNativeModule().registerCredential(
        toNativeRegistrationOptions(options),
        toNativeConfigOptions(resolvedConfig)
      );
      return fromNativeRegistrationResult(result);
    },
    /**
     * Authenticates with an existing FIDO credential using native platform APIs.
     *
     * @param options Authentication options payload.
     * @returns A promise that resolves to the authentication result payload.
     * @throws FidoError when native authentication fails.
     */
    async authenticate(
      options: FidoAuthenticationOptions
    ): Promise<FidoAuthenticationResult> {
      const result = await getNativeModule().authenticateCredential(
        toNativeAuthenticationOptions(options),
        toNativeConfigOptions(resolvedConfig)
      );
      return fromNativeAuthenticationResult(result);
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
      options: FidoJourneyRegistrationOptions = {}
    ): Promise<FidoJourneyResult> {
      const journeyId = await journey.getId();
      const result = await getNativeModule().registerCredentialForJourney(
        journeyId,
        toNativeJourneyRegistrationOptions(options),
        toNativeConfigOptions(resolvedConfig)
      );
      return fromNativeJourneyResult(result);
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
      options: FidoJourneyAuthenticationOptions = {}
    ): Promise<FidoJourneyResult> {
      const journeyId = await journey.getId();
      const result = await getNativeModule().authenticateCredentialForJourney(
        journeyId,
        toNativeJourneyAuthenticationOptions(options),
        toNativeConfigOptions(resolvedConfig)
      );
      return fromNativeJourneyResult(result);
    },
  };
}

export type {
  FidoAndroidConfig,
  FidoClient,
  FidoClientConfig,
  FidoConfig,
  FidoAuthenticationOptions,
  FidoAuthenticationResult,
  FidoError,
  FidoErrorCode,
  FidoJourneyAuthenticationOptions,
  FidoJourneyRegistrationOptions,
  FidoJourneyResult,
  FidoJsonValue,
  FidoRegistrationOptions,
  FidoRegistrationResult,
  JourneyInstance,
} from './types';
