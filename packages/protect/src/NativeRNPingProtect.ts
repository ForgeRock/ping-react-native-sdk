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
  ProtectCollectOptions,
  ProtectConfig,
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
 * Casts collect options to a codegen-compatible object.
 */
export function toNativeCollectOptions(
  options: ProtectCollectOptions,
): Record<string, unknown> {
  return options as unknown as Record<string, unknown>;
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
 * Maps Protect SDK initialization fields from `ProtectConfig` to a native-compatible payload.
 * Logger, lifecycle flags (`pauseBehavioralDataOnSuccess`, `resumeBehavioralDataOnStart`) are
 * intentionally excluded — they are not forwarded to the native initialize call.
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
  return payload;
}

export default getNativeModule;
