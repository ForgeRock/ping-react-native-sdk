/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type {
  BindingClientConfig,
  BindingJourneyBindOptions,
  BindingJourneyResult,
  BindingJourneySignOptions,
  UserKeyOption,
} from './types';

/**
 * Native module specification for RNPingBinding.
 *
 * Defines the interface contract for the native Binding module.
 * Extends TurboModule for New Architecture (Fabric) support.
 *
 * This interface is implemented by native code on both iOS and Android platforms,
 * providing device binding and signing-verifier capabilities.
 *
 * @interface
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- RN TurboModule codegen requires Object in native spec signatures. */
export interface Spec extends TurboModule {
  /**
   * Executes a Journey-scoped DeviceBindingCallback resolved from a Journey instance id.
   *
   * @param journeyId - Native Journey instance id.
   * @param options - Bind callback execution options.
   * @param config - Per-client binding runtime configuration payload.
   * @returns A promise that resolves to a Journey success payload.
   */
  bindForJourney(
    journeyId: string,
    options: Object,
    config: Object,
  ): Promise<Object>;

  /**
   * Executes a Journey-scoped DeviceSigningVerifierCallback resolved from a Journey instance id.
   *
   * @param journeyId - Native Journey instance id.
   * @param options - Sign callback execution options.
   * @param config - Per-client binding runtime configuration payload.
   * @returns A promise that resolves to a Journey success payload.
   */
  signForJourney(
    journeyId: string,
    options: Object,
    config: Object,
  ): Promise<Object>;

  /**
   * Resolves a pending PIN collection request with the user-entered PIN.
   *
   * @param requestId - Opaque request id emitted with RNPingBinding_PinRequired.
   * @param pin - The PIN string entered by the user.
   */
  resolvePin(requestId: string, pin: string): void;

  /**
   * Cancels a pending PIN collection request.
   *
   * @param requestId - Opaque request id emitted with RNPingBinding_PinRequired.
   */
  cancelPin(requestId: string): void;

  /**
   * Resolves a pending user key selection request with the selected key id.
   *
   * @param requestId - Opaque request id emitted with RNPingBinding_UserKeyRequired.
   * @param keyId - The `id` of the selected UserKeyOption.
   */
  selectUserKey(requestId: string, keyId: string): void;

  /**
   * Cancels a pending user key selection request.
   *
   * @param requestId - Opaque request id emitted with RNPingBinding_UserKeyRequired.
   */
  cancelUserKey(requestId: string): void;

  /**
   * Returns all locally stored device binding keys.
   *
   * @returns A promise resolving to an array of stored user key payloads.
   */
  getAllKeys(): Promise<Object>;

  /**
   * Deletes a single locally stored device binding key by userId and keyId.
   *
   * @param userId - The user identifier associated with the key.
   * @param keyId - The unique key identifier (kid).
   * @returns A promise that resolves when the key has been deleted.
   */
  deleteKey(userId: string, keyId: string): Promise<Object>;

  /**
   * Deletes all locally stored device binding keys.
   *
   * @returns A promise that resolves when all keys have been deleted.
   */
  deleteAllKeys(): Promise<Object>;
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

/**
 * Native configuration shape sent over the bridge.
 */
export type NativeBindingConfig = {
  /** Optional native logger handle id resolved by JavaScript. */
  loggerId?: string;
  /** Optional registered user-key storage handle id. */
  userKeyStorageId?: string;
};

/**
 * Resolves the native module by probing TurboModule first, then falling back to the classic bridge module.
 * Result is cached — the native module does not change at runtime.
 *
 * @returns The resolved native binding module.
 * @throws Error when the native module is unavailable.
 */
let _nativeModule: Spec | null = null;
export function getNativeModule(): Spec {
  if (_nativeModule) return _nativeModule;

  const turbo = TurboModuleRegistry.get<Spec>('RNPingBinding');
  if (turbo) {
    _nativeModule = turbo;
    return _nativeModule;
  }

  const classic = NativeModules.RNPingBindingClassic as Spec | undefined;
  if (classic) {
    _nativeModule = classic;
    return _nativeModule;
  }

  const availableModules = __DEV__
    ? '\nAvailable NativeModules: ' + JSON.stringify(Object.keys(NativeModules))
    : '';
  throw new Error(
    '[@ping-identity/rn-binding] Native module RNPingBinding not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.' +
      availableModules,
  );
}

/**
 * Casts bind options to a codegen-compatible object.
 *
 * @param options - Journey bind callback execution options.
 * @returns Codegen-compatible object.
 */
export function toNativeBindOptions(
  options: BindingJourneyBindOptions,
): Record<string, unknown> {
  return options as unknown as Record<string, unknown>;
}

/**
 * Casts sign options to a codegen-compatible object.
 *
 * @param options - Journey sign callback execution options.
 * @returns Codegen-compatible object.
 */
export function toNativeSignOptions(
  options: BindingJourneySignOptions,
): Record<string, unknown> {
  return options as unknown as Record<string, unknown>;
}

/**
 * Casts configure options to a codegen-compatible object.
 *
 * @param config - Resolved per-client binding configuration.
 * @returns Codegen-compatible object.
 */
export function toNativeConfigOptions(
  config: BindingClientConfig,
): Record<string, unknown> {
  return config as unknown as Record<string, unknown>;
}

/**
 * Casts the native payload to a Journey success result type.
 *
 * @param result - Native result payload.
 * @returns Typed Journey result.
 */
export function fromNativeJourneyResult(result: object): BindingJourneyResult {
  return result as unknown as BindingJourneyResult;
}

/**
 * Casts the native user keys array payload to a typed array.
 *
 * @param result - Native result payload.
 * @returns Typed array of user key options.
 */
export function fromNativeUserKeys(result: object): UserKeyOption[] {
  return result as unknown as UserKeyOption[];
}
