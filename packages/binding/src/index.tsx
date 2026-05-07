/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import {
  fromNativeJourneyResult,
  fromNativeUserKeys,
  getNativeModule,
  toNativeBindOptions,
  toNativeConfigOptions,
  toNativeSignOptions,
} from './NativeRNPingBinding';
import { DeviceEventEmitter } from 'react-native';
import type { LoggerInstance } from '@ping-identity/rn-types';
import type {
  BindingClient,
  BindingClientConfig,
  BindingConfig,
  BindingPrompt,
  UserKeyOption,
  BindingJourneyBindOptions,
  BindingJourneyResult,
  BindingJourneySignOptions,
  JourneyInstance,
} from './types';

type PinRequiredEvent = {
  requestId: string;
  title: string;
  subtitle: string;
  description: string;
};

type UserKeyRequiredEvent = {
  requestId: string;
  userKeys: UserKeyOption[];
};

const PIN_REQUIRED_EVENT = 'RNPingBinding_PinRequired';
const USER_KEY_REQUIRED_EVENT = 'RNPingBinding_UserKeyRequired';

// TODO: Move collectors inside the client instance and route events by requestId so
// multiple concurrent clients with different ui callbacks are each handled correctly.
let _activePinCollector: ((prompt: BindingPrompt) => Promise<string>) | null =
  null;
let _pinListenerSetup = false;

let _activeUserKeySelector:
  | ((keys: UserKeyOption[]) => Promise<UserKeyOption>)
  | null = null;
let _userKeySelectorListenerSetup = false;

function ensurePinListenerSetup(): void {
  if (_pinListenerSetup) return;
  _pinListenerSetup = true;
  DeviceEventEmitter.addListener(
    PIN_REQUIRED_EVENT,
    async (event: PinRequiredEvent) => {
      const collector = _activePinCollector;
      if (!collector) {
        getNativeModule().cancelPin(event.requestId);
        return;
      }
      try {
        const pin = await collector({
          title: event.title,
          subtitle: event.subtitle,
          description: event.description,
        });
        getNativeModule().resolvePin(event.requestId, pin);
      } catch {
        getNativeModule().cancelPin(event.requestId);
      }
    },
  );
}

function ensureUserKeySelectorListenerSetup(): void {
  if (_userKeySelectorListenerSetup) return;
  _userKeySelectorListenerSetup = true;
  DeviceEventEmitter.addListener(
    USER_KEY_REQUIRED_EVENT,
    async (event: UserKeyRequiredEvent) => {
      const selector = _activeUserKeySelector;
      if (!selector) {
        getNativeModule().cancelUserKey(event.requestId);
        return;
      }
      try {
        const selected = await selector(event.userKeys);
        getNativeModule().selectUserKey(event.requestId, selected.id);
      } catch {
        getNativeModule().cancelUserKey(event.requestId);
      }
    },
  );
}

const noopLogger: LoggerInstance = {
  nativeHandle: { id: '' },
  changeLevel: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

/**
 * Creates a reusable Binding client instance.
 *
 * @param config - Runtime binding configuration payload.
 * @returns A Binding client bound to the resolved configuration.
 * @throws Error when the native Binding module is unavailable.
 *
 * @remarks
 * Logger integration is optional and uses `logger(...).nativeHandle.id` when provided.
 */
export function createBindingClient(config: BindingConfig = {}): BindingClient {
  const logger = config.logger ?? noopLogger;

  if (config.ui?.pinCollector) {
    _activePinCollector = config.ui.pinCollector;
    ensurePinListenerSetup();
  }
  if (config.ui?.userKeySelector) {
    _activeUserKeySelector = config.ui.userKeySelector;
    ensureUserKeySelectorListenerSetup();
  }

  const resolvedConfig: BindingClientConfig = {
    loggerId: logger.nativeHandle?.id?.trim() || undefined,
    hasPinCollector: Boolean(config.ui?.pinCollector),
    hasUserKeySelector: Boolean(config.ui?.userKeySelector),
    userKeyStorageId: config.userKeyStorage?.id,
  };

  logger.debug(
    `Binding createClient config ${JSON.stringify(
      { hasLogger: Boolean(resolvedConfig.loggerId) },
      null,
      2,
    )}`,
  );
  logger.info('Binding createClient success');

  return {
    /**
     * Executes an active Journey DeviceBindingCallback.
     *
     * @param journey - Active Journey instance.
     * @param options - Optional bind callback execution options.
     * @returns A promise that resolves when callback execution succeeds.
     * @throws BindingError when native callback execution fails.
     */
    async bindForJourney(
      journey: JourneyInstance,
      options: BindingJourneyBindOptions = {},
    ): Promise<BindingJourneyResult> {
      logger.info('Binding bindForJourney requested');
      try {
        const journeyId = await journey.getId();
        const result = await getNativeModule().bindForJourney(
          journeyId,
          toNativeBindOptions({
            index: options.index,
            deviceName: options.deviceName,
            signingAlgorithm: options.signingAlgorithm,
            appPin: options.appPin,
            biometric: options.biometric,
            jwt: options.jwt,
          }),
          toNativeConfigOptions(resolvedConfig),
        );
        logger.debug('Binding bindForJourney success');
        return fromNativeJourneyResult(result);
      } catch (error) {
        logger.error('Binding bindForJourney failed');
        throw error;
      }
    },

    /**
     * Executes an active Journey DeviceSigningVerifierCallback.
     *
     * @param journey - Active Journey instance.
     * @param options - Optional sign callback execution options.
     * @returns A promise that resolves when callback execution succeeds.
     * @throws BindingError when native callback execution fails.
     */
    async signForJourney(
      journey: JourneyInstance,
      options: BindingJourneySignOptions = {},
    ): Promise<BindingJourneyResult> {
      logger.info('Binding signForJourney requested');
      try {
        const journeyId = await journey.getId();
        const result = await getNativeModule().signForJourney(
          journeyId,
          toNativeSignOptions({
            index: options.index,
            claims: options.claims,
            signingAlgorithm: options.signingAlgorithm,
            appPin: options.appPin,
            biometric: options.biometric,
            jwt: options.jwt,
          }),
          toNativeConfigOptions(resolvedConfig),
        );
        logger.debug('Binding signForJourney success');
        return fromNativeJourneyResult(result);
      } catch (error) {
        logger.error('Binding signForJourney failed');
        throw error;
      }
    },
  };
}

/**
 * Returns all locally stored device binding keys.
 *
 * @returns A promise resolving to an array of stored user key options.
 * @throws BindingError when the native module is unavailable or the operation fails.
 */
export async function getAllKeys(): Promise<UserKeyOption[]> {
  const result = await getNativeModule().getAllKeys();
  return fromNativeUserKeys(result);
}

/**
 * Deletes a single locally stored device binding key.
 *
 * @param key - The user key option to delete, as returned by {@link getAllKeys}.
 * @returns A promise that resolves when the key has been deleted.
 * @throws BindingError when the key is not found or deletion fails.
 */
export async function deleteKey(key: UserKeyOption): Promise<void> {
  await getNativeModule().deleteKey(key.userId, key.id);
}

/**
 * Deletes all locally stored device binding keys.
 *
 * @returns A promise that resolves when all keys have been deleted.
 * @throws BindingError when the native module is unavailable or the operation fails.
 */
export async function deleteAllKeys(): Promise<void> {
  await getNativeModule().deleteAllKeys();
}

export type {
  BindingAppPinConfig,
  BindingBiometricAndroidConfig,
  BindingBiometricBindConfig,
  BindingBiometricIosBindConfig,
  BindingBiometricIosSignConfig,
  BindingBiometricSignConfig,
  BindingClient,
  BindingClientConfig,
  BindingConfig,
  BindingError,
  BindingErrorCode,
  BindingJourneyBindOptions,
  BindingJourneyResult,
  BindingJourneySignOptions,
  BindingJwtConfig,
  BindingPrompt,
  BindingUiConfig,
  UserKeyOption,
  JourneyInstance,
} from './types';
