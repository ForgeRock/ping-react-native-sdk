/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type {
  FidoClientConfig,
  FidoAuthenticationOptions,
  FidoAuthenticationResult,
  FidoJourneyAuthenticationOptions,
  FidoJourneyRegistrationOptions,
  FidoJourneyResult,
  FidoRegistrationOptions,
  FidoRegistrationResult,
} from './types';

/**
 * Native module specification for RNPingFido.
 *
 * Defines the interface contract for the native FIDO module.
 * Extends TurboModule for New Architecture (Fabric) support.
 *
 * This interface is implemented by native code on both iOS and Android platforms,
 * providing FIDO capabilities.
 *
 * @interface
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- RN TurboModule codegen requires Object in native spec signatures. */
export interface Spec extends TurboModule {
  /**
   * Registers a new FIDO credential.
   *
   * @param options Registration options payload.
   * @param config Per-client FIDO runtime configuration payload.
   * @returns A promise that resolves to the registration result payload.
   */
  registerCredential(options: Object, config: Object): Promise<Object>;

  /**
   * Authenticates with an existing FIDO credential.
   *
   * @param options Authentication options payload.
   * @param config Per-client FIDO runtime configuration payload.
   * @returns A promise that resolves to the authentication result payload.
   */
  authenticateCredential(options: Object, config: Object): Promise<Object>;

  /**
   * Registers a Journey-scoped FIDO callback resolved from a Journey instance id.
   *
   * @param journeyId Native Journey instance id.
   * @param options Registration callback execution options.
   * @param config Per-client FIDO runtime configuration payload.
   * @returns A promise that resolves to a Journey success payload.
   */
  registerCredentialForJourney(
    journeyId: string,
    options: Object,
    config: Object,
  ): Promise<Object>;

  /**
   * Authenticates a Journey-scoped FIDO callback resolved from a Journey instance id.
   *
   * @param journeyId Native Journey instance id.
   * @param options Authentication callback execution options.
   * @param config Per-client FIDO runtime configuration payload.
   * @returns A promise that resolves to a Journey success payload.
   */
  authenticateCredentialForJourney(
    journeyId: string,
    options: Object,
    config: Object,
  ): Promise<Object>;
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

/**
 * Native configuration shape sent over the bridge.
 */
export type NativeFidoConfig = {
  /** Optional native logger handle id resolved by JavaScript. */
  loggerId?: string;
  /** Optional Android-only API selection toggle. */
  useFido2Client?: boolean;
};

/**
 * Resolves the native module by probing TurboModule first, then falling back to the classic bridge module.
 * Result is cached — the native module does not change at runtime.
 */
let _nativeModule: Spec | null = null;
export function getNativeModule(): Spec {
  if (_nativeModule) return _nativeModule;

  const turbo = TurboModuleRegistry.get<Spec>('RNPingFido');
  if (turbo) {
    _nativeModule = turbo;
    return _nativeModule;
  }

  const classic = NativeModules.RNPingFidoClassic as Spec | undefined;
  if (classic) {
    _nativeModule = classic;
    return _nativeModule;
  }

  const availableModules = __DEV__
    ? '\nAvailable NativeModules: ' + JSON.stringify(Object.keys(NativeModules))
    : '';
  throw new Error(
    '[@ping-identity/rn-fido] Native module RNPingFido not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.' +
      availableModules,
  );
}

/**
 * Casts registration options to a codegen-compatible object.
 */
export function toNativeRegistrationOptions(
  options: FidoRegistrationOptions,
): Record<string, unknown> {
  return options as unknown as Record<string, unknown>;
}

/**
 * Casts configure options to a codegen-compatible object.
 */
export function toNativeConfigOptions(
  config: FidoClientConfig,
): Record<string, unknown> {
  return config as unknown as Record<string, unknown>;
}

/**
 * Casts authentication options to a codegen-compatible object.
 */
export function toNativeAuthenticationOptions(
  options: FidoAuthenticationOptions,
): Record<string, unknown> {
  return options as unknown as Record<string, unknown>;
}

/**
 * Casts the native payload to registration result type.
 */
export function fromNativeRegistrationResult(
  result: object,
): FidoRegistrationResult {
  return result as unknown as FidoRegistrationResult;
}

/**
 * Casts the native payload to authentication result type.
 */
export function fromNativeAuthenticationResult(
  result: object,
): FidoAuthenticationResult {
  return result as unknown as FidoAuthenticationResult;
}

/**
 * Casts Journey registration options to a codegen-compatible object.
 */
export function toNativeJourneyRegistrationOptions(
  options: FidoJourneyRegistrationOptions,
): Record<string, unknown> {
  return options as unknown as Record<string, unknown>;
}

/**
 * Casts Journey authentication options to a codegen-compatible object.
 */
export function toNativeJourneyAuthenticationOptions(
  options: FidoJourneyAuthenticationOptions,
): Record<string, unknown> {
  return options as unknown as Record<string, unknown>;
}

/**
 * Casts the native payload to a Journey success result type.
 */
export function fromNativeJourneyResult(result: object): FidoJourneyResult {
  return result as unknown as FidoJourneyResult;
}
