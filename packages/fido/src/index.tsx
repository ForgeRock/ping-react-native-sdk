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
  toNativeAuthenticationOptions,
  toNativeDaVinciAuthenticationOptions,
  toNativeDaVinciRegistrationOptions,
  toNativeJourneyAuthenticationOptions,
  toNativeJourneyRegistrationOptions,
  toNativeRegistrationOptions,
} from './NativeRNPingFido';
import {
  buildNativeConfig,
  validateWorkflowOptionsBag,
} from './ceremonyConfig';
import {
  noopLogger,
  registerIntegrationCollectorType,
} from '@ping-identity/rn-types';
import type {
  FidoClient,
  FidoNativeCeremonyConfig,
  FidoConfig,
  FidoAuthenticationOptions,
  FidoAuthenticationResult,
  FidoAuthenticationCeremonyOptions,
  FidoDaVinciAuthenticationOptions,
  FidoDaVinciRegistrationOptions,
  FidoDaVinciResult,
  FidoJourneyAuthenticationOptions,
  FidoJourneyRegistrationOptions,
  FidoJourneyResult,
  FidoRegistrationOptions,
  FidoRegistrationCeremonyOptions,
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
 * The client-level configuration (`loggerId`, `useFido2ApiClient`) is resolved
 * once here and never mutated; every operation composes its own native call
 * configuration from this base plus its ceremony options, so one call never
 * leaks into another.
 *
 * Current runtime behavior:
 * - Android selects the FIDO2 API for standalone `authenticate`,
 *   `authenticateForJourney` and `authenticateForDaVinci` from the per-call
 *   `android.useFido2ApiClient` ceremony option, else the client-level
 *   `useFido2ApiClient`, else native auto-detection (Play Services when the
 *   host app includes `play-services-fido`). The `android.credentialManager`
 *   and `android.playServices` blocks never change the route; a block for the
 *   route that is not selected is not applied and a warning is logged.
 *   Registration has no API selection.
 * - Journey and DaVinci ceremonies keep their workflow-configured native
 *   logger for the ceremony itself on both platforms. The logger id still
 *   routes the warnings about ignored or invalid ceremony options.
 * - This call also registers `FIDO2` as an integration collector type, so
 *   DaVinci integration collectors activate as soon as a FIDO client exists.
 * - Client creation activates the FIDO integration, including native DaVinci
 *   serializer registration, so FIDO2 collectors serialize with their full
 *   payload as soon as a client exists.
 *
 * @example
 * ```ts
 * const fido = createFidoClient({ android: { useFido2ApiClient: true } });
 * await fido.authenticate(
 *   { challenge: 'abc' },
 *   { preferImmediatelyAvailableCredentials: true },
 * );
 * ```
 */
export function createFidoClient(config: FidoConfig = {}): FidoClient {
  registerIntegrationCollectorType(fidoCollectorType);
  getNativeModule().registerDaVinciSerializer();
  const logger = config.logger ?? noopLogger;
  const resolvedConfig: FidoNativeCeremonyConfig = {
    loggerId: logger.nativeHandle?.id?.trim() || undefined,
    useFido2ApiClient: config.android?.useFido2ApiClient,
  };

  logger.debug(
    `FIDO createClient config ${JSON.stringify(
      {
        hasLogger: Boolean(resolvedConfig.loggerId),
        android: { useFido2ApiClient: resolvedConfig.useFido2ApiClient },
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
     * @param ceremonyOptions Optional ceremony options; see
     *   {@link FidoRegistrationCeremonyOptions}.
     * @returns A promise that resolves to the registration result payload.
     * @throws FidoError with `argument_error` for invalid ceremony options, or
     *   with code `FIDO_REGISTER_ERROR` when native registration fails,
     *   including user cancellation.
     */
    async register(
      options: FidoRegistrationOptions,
      ceremonyOptions: FidoRegistrationCeremonyOptions = {},
    ): Promise<FidoRegistrationResult> {
      logger.info('FIDO register requested');
      try {
        const result = await getNativeModule().registerCredential(
          toNativeRegistrationOptions(options),
          buildNativeConfig(
            resolvedConfig,
            'registration',
            ceremonyOptions,
            logger,
          ),
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
     * @param ceremonyOptions Optional ceremony options; see
     *   {@link FidoAuthenticationCeremonyOptions}.
     * @returns A promise that resolves to the authentication result payload.
     * @throws FidoError with `argument_error` for invalid ceremony options or
     *   routing conflicts; or with `FIDO_AUTHENTICATE_ERROR` for any native
     *   authentication failure, including user cancellation. Standalone
     *   authentication has no cancellation-specific code; only
     *   `authenticateForJourney` and `authenticateForDaVinci` reject with
     *   `FIDO_AUTHENTICATE_CANCELLED`.
     */
    async authenticate(
      options: FidoAuthenticationOptions,
      ceremonyOptions: FidoAuthenticationCeremonyOptions = {},
    ): Promise<FidoAuthenticationResult> {
      logger.info('FIDO authenticate requested');
      try {
        const result = await getNativeModule().authenticateCredential(
          toNativeAuthenticationOptions(options),
          buildNativeConfig(
            resolvedConfig,
            'authentication',
            ceremonyOptions,
            logger,
          ),
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
     * @param options Optional registration callback execution options,
     *   including ceremony options; see {@link FidoRegistrationCeremonyOptions}.
     * @returns A promise that resolves when callback execution succeeds.
     * @throws FidoError with `argument_error` for invalid ceremony options, or
     *   when callback execution fails.
     */
    async registerForJourney(
      journey: JourneyInstance,
      options: FidoJourneyRegistrationOptions = {},
    ): Promise<FidoJourneyResult> {
      logger.info('FIDO registerForJourney requested');
      try {
        validateWorkflowOptionsBag('registerForJourney', options);
        const { index: _index, deviceName: _deviceName, ...ceremony } = options;
        const nativeConfig = buildNativeConfig(
          resolvedConfig,
          'registration',
          ceremony,
          logger,
        );
        const journeyId = await journey.getId();
        const result = await getNativeModule().registerCredentialForJourney(
          journeyId,
          toNativeJourneyRegistrationOptions({
            index: options.index,
            deviceName: options.deviceName,
          }),
          nativeConfig,
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
     * @param options Optional authentication callback execution options,
     *   including ceremony options; see
     *   {@link FidoAuthenticationCeremonyOptions}.
     * @returns A promise that resolves when callback execution succeeds.
     * @throws FidoError with `argument_error` for invalid ceremony options or
     *   routing conflicts; with code `FIDO_AUTHENTICATE_CANCELLED` when the user
     *   cancels or no usable credential is available; or with
     *   `FIDO_AUTHENTICATE_ERROR` for any other callback execution failure.
     *   Unlike standalone `authenticate`, this scope carries a
     *   cancellation-specific code.
     */
    async authenticateForJourney(
      journey: JourneyInstance,
      options: FidoJourneyAuthenticationOptions = {},
    ): Promise<FidoJourneyResult> {
      logger.info('FIDO authenticateForJourney requested');
      try {
        validateWorkflowOptionsBag('authenticateForJourney', options);
        const { index: _index, ...ceremony } = options;
        const nativeConfig = buildNativeConfig(
          resolvedConfig,
          'authentication',
          ceremony,
          logger,
        );
        const journeyId = await journey.getId();
        const result = await getNativeModule().authenticateCredentialForJourney(
          journeyId,
          toNativeJourneyAuthenticationOptions({ index: options.index }),
          nativeConfig,
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
     * @param options Optional registration ceremony options, including
     *   ceremony options; see {@link FidoRegistrationCeremonyOptions}.
     * @returns A promise that resolves to the WebAuthn attestation payload. Informational
     * only — submit natively by advancing the flow with `daVinci.next({ collectors: [] })`.
     * @throws FidoError when the ceremony fails or the collector cannot be resolved.
     * @remarks The ceremony logger is not overridden: DaVinci ceremonies keep the
     * workflow-configured native logger on both platforms, and the client logger id
     * only receives the warnings about ignored or invalid ceremony options.
     * Android applies `android.credentialManager` (create-request overrides) and
     * `preferImmediatelyAvailableCredentials`. iOS ignores
     * `preferImmediatelyAvailableCredentials` for registration and ignores the
     * whole `android` block, each with a warning.
     * On ceremony failure the rejection carries `clientError`, the WebAuthn
     * DOMException name reported by the native collector (see `FidoClientErrorName`).
     * When `clientError` is defined, report the failure to the server by advancing
     * the flow with `daVinci.next({ collectors: [] })` so the flow can branch on it;
     * do not submit the node's collectors, a `SUBMIT_BUTTON` shadows the FIDO error.
     * Without propagation the failure stays client-side and the server never observes
     * it. Resolution failures such as `FIDO_COLLECTOR_NOT_FOUND` carry no `clientError`
     * and must not be propagated.
     */
    async registerForDaVinci(
      daVinci: DaVinciInstance,
      options: FidoDaVinciRegistrationOptions = {},
    ): Promise<FidoDaVinciResult> {
      logger.info('FIDO registerForDaVinci requested');
      try {
        validateWorkflowOptionsBag('registerForDaVinci', options);
        const { index: _index, ...ceremony } = options;
        const nativeConfig = buildNativeConfig(
          resolvedConfig,
          'registration',
          ceremony,
          logger,
        );
        const davinciId = await daVinci.getId();
        const result = await getNativeModule().registerCredentialForDaVinci(
          davinciId,
          toNativeDaVinciRegistrationOptions({ index: options.index }),
          nativeConfig,
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
     * @param options Optional authentication ceremony options, including
     *   ceremony options; see {@link FidoAuthenticationCeremonyOptions}.
     * @returns A promise that resolves to the WebAuthn assertion payload. Informational
     * only — submit natively by advancing the flow with `daVinci.next({ collectors: [] })`.
     * @throws FidoError with code `FIDO_AUTHENTICATE_CANCELLED` when the user
     *   cancels or no usable credential is available, with
     *   `FIDO_AUTHENTICATE_ERROR` for any other ceremony failure, or when the
     *   collector cannot be resolved.
     * @remarks The ceremony logger is not overridden: DaVinci ceremonies keep the
     * workflow-configured native logger on both platforms, and the client logger id
     * only receives the warnings about ignored or invalid ceremony options.
     * Android applies the per-call `android.useFido2ApiClient` (else the client-level
     * flag) and the `android.credentialManager` or `android.playServices` block for
     * the selected route, and ignores `preferImmediatelyAvailableCredentials` with a
     * warning. iOS applies `preferImmediatelyAvailableCredentials` and ignores the
     * whole `android` block with a warning.
     * On ceremony failure the rejection carries `clientError`, the WebAuthn
     * DOMException name reported by the native collector (see `FidoClientErrorName`).
     * When `clientError` is defined, report the failure to the server by advancing
     * the flow with `daVinci.next({ collectors: [] })` so the flow can branch on it;
     * do not submit the node's collectors, a `SUBMIT_BUTTON` shadows the FIDO error.
     * Without propagation the failure stays client-side and the server never observes
     * it. Resolution failures such as `FIDO_COLLECTOR_NOT_FOUND` carry no `clientError`
     * and must not be propagated.
     */
    async authenticateForDaVinci(
      daVinci: DaVinciInstance,
      options: FidoDaVinciAuthenticationOptions = {},
    ): Promise<FidoDaVinciResult> {
      logger.info('FIDO authenticateForDaVinci requested');
      try {
        validateWorkflowOptionsBag('authenticateForDaVinci', options);
        const { index: _index, ...ceremony } = options;
        const nativeConfig = buildNativeConfig(
          resolvedConfig,
          'authentication',
          ceremony,
          logger,
        );
        const davinciId = await daVinci.getId();
        const result = await getNativeModule().authenticateCredentialForDaVinci(
          davinciId,
          toNativeDaVinciAuthenticationOptions({ index: options.index }),
          nativeConfig,
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
  FidoAndroidCredentialManagerOptions,
  FidoAndroidPlayServicesOptions,
  FidoAndroidRegistrationOptions,
  FidoClient,
  FidoClientConfig,
  FidoConfig,
  FidoAuthenticationCeremonyOptions,
  FidoAuthenticationCollector,
  FidoAuthenticationOptions,
  FidoAuthenticationResult,
  FidoCollector,
  FidoDaVinciAuthenticationOptions,
  FidoDaVinciRegistrationOptions,
  FidoDaVinciResult,
  FidoErrorCode,
  FidoClientErrorName,
  FidoJourneyAuthenticationOptions,
  FidoJourneyRegistrationOptions,
  FidoJourneyResult,
  FidoJsonValue,
  FidoRegistrationCeremonyOptions,
  FidoRegistrationCollector,
  FidoRegistrationOptions,
  FidoRegistrationResult,
  DaVinciInstance,
  JourneyInstance,
} from './types';
