/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type {
  ProtectClientConfig,
  ProtectConfig,
  ProtectJourneyResult,
} from './types';

/**
 * Native module specification for RNPingProtect.
 *
 * Defines the interface contract for the native Protect module.
 * Extends TurboModule for New Architecture support.
 *
 * @interface
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- RN TurboModule codegen requires Object in native spec signatures. */
export interface Spec extends TurboModule {
  /**
   * Runs Protect SDK data collection for the active `ProtectCollector` in a DaVinci flow.
   *
   * The collected payload is set internally on the native collector so that
   * `daVinci.next({})` picks it up automatically via `collector.payload()`.
   *
   * @param davinciId Native DaVinci instance id.
   * @param options Per-call options payload (index).
   * @param config Per-client runtime configuration payload (loggerId).
   * @returns A promise that resolves to void when collection completes.
   */
  collectForDaVinci(
    davinciId: string,
    options: Object,
    config: Object,
  ): Promise<void>;

  /**
   * Runs PingOne Protect data collection for a Journey evaluation callback
   * resolved from a Journey instance id.
   *
   * The collected risk signal is written natively into the Journey callback
   * (or its sibling hidden-value fields) and is never returned to JavaScript.
   *
   * @param journeyId Native Journey instance id.
   * @param options Per-call options payload (index).
   * @param config Per-client runtime configuration payload (loggerId).
   * @returns A promise that resolves to a Journey success payload.
   */
  collectForJourney(
    journeyId: string,
    options: Object,
    config: Object,
  ): Promise<Object>;

  /**
   * Executes a Journey initialize callback resolved from a Journey instance id.
   *
   * The callback carries its own server-driven configuration (parsed from the
   * direct `output[]` form or the MetadataCallback-derived form), so no app
   * `ProtectConfig` is passed.
   *
   * @param journeyId Native Journey instance id.
   * @param config Per-client runtime configuration payload (loggerId).
   * @returns A promise that resolves to a Journey success payload.
   */
  initializeForJourney(journeyId: string, config: Object): Promise<Object>;

  /**
   * Initializes the Protect SDK with the provided configuration.
   *
   * @param protectConfig Protect SDK initialization config payload (envId, behavioralDataCollection, etc.).
   * @param clientConfig Per-client runtime configuration payload (loggerId).
   * @returns A promise that resolves to void when initialization completes.
   */
  initialize(protectConfig: Object, clientConfig: Object): Promise<void>;

  /**
   * Pauses behavioral data collection.
   *
   * @param clientConfig Per-client runtime configuration payload (loggerId).
   * @returns A promise that resolves to void.
   */
  pauseBehavioralData(clientConfig: Object): Promise<void>;

  /**
   * Resumes behavioral data collection.
   *
   * @param clientConfig Per-client runtime configuration payload (loggerId).
   * @returns A promise that resolves to void.
   */
  resumeBehavioralData(clientConfig: Object): Promise<void>;

  /**
   * Registers the Protect collector serializer with the shared native DaVinci mapper.
   *
   * @returns A promise that resolves once registration completes. Idempotent.
   */
  registerDaVinciSerializer(): Promise<null>;

  /**
   * Registers the Protect callbacks with the native Journey callback registry without
   * initializing the Protect SDK.
   *
   * @returns A promise that resolves once registration is requested. Idempotent. On
   * Android the native SDK registers its callbacks at app launch, so this only resolves.
   */
  registerJourneyCallbacks(): Promise<null>;
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

/**
 * Resolves the native module by probing TurboModule first, then falling back to the classic bridge module.
 * Result is cached — the native module does not change at runtime.
 *
 * @returns Native module implementation for the current architecture.
 * @throws Error when no native module is registered.
 */
let _nativeModule: Spec | null = null;
/** @internal — resets the module cache for testing only. */
export function _resetNativeModuleForTesting(): void {
  _nativeModule = null;
}
export function getNativeModule(): Spec {
  if (_nativeModule) return _nativeModule;

  const turbo = TurboModuleRegistry.get<Spec>('RNPingProtect');
  if (turbo) {
    _nativeModule = turbo;
    return _nativeModule;
  }

  const classic = NativeModules.RNPingProtectClassic as Spec | undefined;
  if (classic) {
    _nativeModule = classic;
    return _nativeModule;
  }

  const availableModules =
    '\nAvailable NativeModules: ' + JSON.stringify(Object.keys(NativeModules));
  throw new Error(
    '[@ping-identity/rn-protect] Native module RNPingProtect not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.' +
      availableModules,
  );
}

/**
 * Casts client config to a codegen-compatible object.
 */
export function toNativeConfig(
  config: ProtectClientConfig,
): Record<string, unknown> {
  return config as unknown as Record<string, unknown>;
}

/**
 * Casts the native payload to a Journey success result type.
 *
 * @param result - Payload resolved by the native `collectForJourney` or `initializeForJourney` call.
 * @returns The payload typed as {@link ProtectJourneyResult}.
 *
 * @remarks
 * The cast is safe because both platforms resolve these calls only with
 * `{ type: 'success' }` (`createJourneyResultPayload`) and reject for every other
 * outcome, so no non-success payload can reach this function.
 *
 * @internal
 */
export function fromNativeJourneyResult(result: object): ProtectJourneyResult {
  return result as unknown as ProtectJourneyResult;
}

/**
 * Maps Protect SDK initialization and lifecycle fields from `ProtectConfig` to a native-compatible payload.
 */
export function toNativeProtectConfig(
  config: ProtectConfig,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (config.envId !== undefined) payload['envId'] = config.envId;
  if (config.isBehavioralDataCollection !== undefined)
    payload['isBehavioralDataCollection'] = config.isBehavioralDataCollection;
  if (config.isLazyMetadata !== undefined)
    payload['isLazyMetadata'] = config.isLazyMetadata;
  if (config.customHost !== undefined)
    payload['customHost'] = config.customHost;
  if (config.isConsoleLogEnabled !== undefined)
    payload['isConsoleLogEnabled'] = config.isConsoleLogEnabled;
  if (config.deviceAttributesToIgnore !== undefined)
    payload['deviceAttributesToIgnore'] = config.deviceAttributesToIgnore;
  if (config.pauseBehavioralDataOnSuccess !== undefined)
    payload['pauseBehavioralDataOnSuccess'] =
      config.pauseBehavioralDataOnSuccess;
  if (config.resumeBehavioralDataOnStart !== undefined)
    payload['resumeBehavioralDataOnStart'] = config.resumeBehavioralDataOnStart;
  return payload;
}

export default getNativeModule;
