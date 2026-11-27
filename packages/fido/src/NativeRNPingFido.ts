/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type {
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
/**
 * Keys carried by the per-call `config` payload of every FIDO Spec method:
 *
 * - `loggerId` (string, optional): native logger handle id resolved by JS.
 * - `useFido2ApiClient` (boolean, optional): authentication API routing;
 *   emitted on Android only, as the per-call flag when defined, else the
 *   client-level flag. Omitted lets native auto-detect the route; iOS omits
 *   the key entirely. The `android` blocks never change the route.
 * - `preferImmediatelyAvailableCredentials` (boolean, optional): credential
 *   preference. Android applies it to registration via the Credential Manager
 *   create request; Android logs it as unsupported on authentication. iOS
 *   applies it to authentication and reports it on registration.
 * - `android` (Object, optional): `{ credentialManager?, playServices? }`
 *   ceremony blocks. Android only; authentication accepts both blocks and
 *   applies the one matching the selected route, registration only
 *   `credentialManager`. Pruned with a warning on iOS.
 */
export interface Spec extends TurboModule {
  /**
   * Registers a new FIDO credential.
   *
   * @param options Registration options payload.
   * @param config Per-call FIDO runtime configuration payload.
   * @returns A promise that resolves to the registration result payload.
   */
  registerCredential(options: Object, config: Object): Promise<Object>;

  /**
   * Authenticates with an existing FIDO credential.
   *
   * @param options Authentication options payload.
   * @param config Per-call FIDO runtime configuration payload.
   * @returns A promise that resolves to the authentication result payload.
   */
  authenticateCredential(options: Object, config: Object): Promise<Object>;

  /**
   * Registers a Journey-scoped FIDO callback resolved from a Journey instance id.
   *
   * @param journeyId Native Journey instance id.
   * @param options Registration callback execution options.
   * @param config Per-call FIDO runtime configuration payload.
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
   * @param config Per-call FIDO runtime configuration payload.
   * @returns A promise that resolves to a Journey success payload.
   */
  authenticateCredentialForJourney(
    journeyId: string,
    options: Object,
    config: Object,
  ): Promise<Object>;

  /**
   * Runs the native FIDO registration ceremony for an active DaVinci FIDO2
   * registration collector resolved from a DaVinci instance id.
   *
   * @param davinciId Native DaVinci instance id.
   * @param options Registration ceremony options.
   * @param config Per-call FIDO runtime configuration payload.
   * @returns A promise that resolves to the WebAuthn attestation payload.
   * @remarks On ceremony failure the rejection carries an optional
   * `userInfo.clientError` string with the WebAuthn DOMException name reported
   * by the native collector. Absent for resolution failures.
   */
  registerCredentialForDaVinci(
    davinciId: string,
    options: Object,
    config: Object,
  ): Promise<Object>;

  /**
   * Runs the native FIDO authentication ceremony for an active DaVinci FIDO2
   * authentication collector resolved from a DaVinci instance id.
   *
   * @param davinciId Native DaVinci instance id.
   * @param options Authentication ceremony options.
   * @param config Per-call FIDO runtime configuration payload.
   * @returns A promise that resolves to the WebAuthn assertion payload.
   * @remarks On ceremony failure the rejection carries an optional
   * `userInfo.clientError` string with the WebAuthn DOMException name reported
   * by the native collector. Absent for resolution failures.
   */
  authenticateCredentialForDaVinci(
    davinciId: string,
    options: Object,
    config: Object,
  ): Promise<Object>;

  /**
   * Registers the DaVinci FIDO2 collector serializer on the native side.
   *
   * @remarks
   * Idempotent: repeat calls are no-ops once registered. Internal activation
   * method invoked by the FIDO client factory; not part of the public API.
   * Synchronous by design: serializer registration is an in-memory registry
   * append with no I/O, so no promise round-trip is needed and the factory
   * call completes the registration within client creation itself.
   */
  registerDaVinciSerializer(): void;
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

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

  const availableModules =
    '\nAvailable NativeModules: ' + JSON.stringify(Object.keys(NativeModules));
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

/**
 * Casts DaVinci registration options to a codegen-compatible object.
 */
export function toNativeDaVinciRegistrationOptions(
  options: FidoDaVinciRegistrationOptions,
): Record<string, unknown> {
  return options as unknown as Record<string, unknown>;
}

/**
 * Casts DaVinci authentication options to a codegen-compatible object.
 */
export function toNativeDaVinciAuthenticationOptions(
  options: FidoDaVinciAuthenticationOptions,
): Record<string, unknown> {
  return options as unknown as Record<string, unknown>;
}

/**
 * Casts the native payload to a DaVinci ceremony result type.
 */
export function fromNativeDaVinciResult(result: object): FidoDaVinciResult {
  return result as unknown as FidoDaVinciResult;
}
