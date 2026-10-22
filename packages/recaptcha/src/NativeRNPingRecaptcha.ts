/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type { RecaptchaVerifyOptions, RecaptchaVerifyResult } from './types';

/**
 * Native module specification for RNPingRecaptcha.
 *
 * Defines the interface contract for the native reCAPTCHA module.
 * Extends TurboModule for New Architecture (Fabric) support.
 *
 * This interface is implemented by native code on both iOS and Android platforms,
 * providing reCAPTCHA Enterprise verification capabilities.
 *
 * @interface
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- RN TurboModule codegen requires Object in native spec signatures. */
export interface Spec extends TurboModule {
  /**
   * Executes an active Journey ReCaptchaEnterpriseCallback resolved from a Journey instance id.
   *
   * @param journeyId - Native Journey instance id.
   * @param options - Callback execution options (index, action, timeoutMs, payload).
   * @param config - Per-client runtime configuration (loggerId).
   * @returns A promise that resolves to the verify result payload.
   */
  verifyForJourney(
    journeyId: string,
    options: Object,
    config: Object,
  ): Promise<Object>;
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

/**
 * Native configuration shape sent over the bridge.
 */
export type NativeRecaptchaConfig = {
  /** Optional native logger handle id resolved by JavaScript. */
  loggerId?: string;
};

/**
 * Resolves the native module by probing TurboModule first, then falling back to the classic bridge module.
 * Result is cached — the native module does not change at runtime.
 */
let _nativeModule: Spec | null = null;
/** @internal — resets the module cache for testing only. */
export function _resetNativeModuleForTesting(): void {
  _nativeModule = null;
}
export function getNativeModule(): Spec {
  if (_nativeModule) return _nativeModule;

  const turbo = TurboModuleRegistry.get<Spec>('RNPingRecaptcha');
  if (turbo) {
    _nativeModule = turbo;
    return _nativeModule;
  }

  const classic = NativeModules.RNPingRecaptchaClassic as Spec | undefined;
  if (classic) {
    _nativeModule = classic;
    return _nativeModule;
  }

  const availableModules =
    '\nAvailable NativeModules: ' + JSON.stringify(Object.keys(NativeModules));
  throw new Error(
    '[@ping-identity/rn-recaptcha] Native module RNPingRecaptcha not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.' +
      availableModules,
  );
}

/**
 * Casts verification options to a codegen-compatible object.
 */
export function toNativeVerifyOptions(
  options: RecaptchaVerifyOptions,
): Record<string, unknown> {
  return options as unknown as Record<string, unknown>;
}

/**
 * Casts client config to a codegen-compatible object.
 */
export function toNativeClientConfig(
  config: NativeRecaptchaConfig,
): Record<string, unknown> {
  return config as unknown as Record<string, unknown>;
}

/**
 * Casts the native payload to the verify result union.
 */
export function fromNativeVerifyResult(result: object): RecaptchaVerifyResult {
  return result as unknown as RecaptchaVerifyResult;
}
