/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';

/**
 * Native module contract for the OATH package.
 *
 * @remarks
 * All structured arguments and return values use `Object` to satisfy the
 * TurboModule codegen constraint. Typed wrappers are applied at the JS facade
 * layer in `oath.ts`.
 */
export interface Spec extends TurboModule {
  /**
   * Initialise a native OATH client and return its handle string.
   *
   * @param config - Client configuration payload.
   * @returns A promise that resolves to the opaque handle string for this client.
   */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  create(config: Object): Promise<string>;

  /**
   * Parse an `otpauth://` URI and register the credential in the native store.
   *
   * @param handle - OATH client handle returned by {@link create}.
   * @param uri - The `otpauth://` URI string.
   * @returns A promise that resolves to the newly created credential payload.
   */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  addCredentialFromUri(handle: string, uri: string): Promise<Object>;

  /**
   * Retrieve a single credential by its identifier.
   *
   * @param handle - OATH client handle returned by {@link create}.
   * @param credentialId - Unique identifier for the credential.
   * @returns A promise that resolves to the credential payload, or `null` if not found.
   */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  getCredential(handle: string, credentialId: string): Promise<Object | null>;

  /**
   * Retrieve all credentials stored in the native OATH store.
   *
   * @param handle - OATH client handle returned by {@link create}.
   * @returns A promise that resolves to an array of credential payloads.
   */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  getCredentials(handle: string): Promise<ReadonlyArray<Object>>;

  /**
   * Persist an updated credential to the native OATH store.
   *
   * @param handle - OATH client handle returned by {@link create}.
   * @param credential - Credential payload to save.
   * @returns A promise that resolves to the saved credential payload.
   */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  saveCredential(handle: string, credential: Object): Promise<Object>;

  /**
   * Remove a credential from the native OATH store.
   *
   * @param handle - OATH client handle returned by {@link create}.
   * @param credentialId - Unique identifier for the credential to delete.
   * @returns A promise that resolves to `true` when deletion succeeded.
   */
  deleteCredential(handle: string, credentialId: string): Promise<boolean>;

  /**
   * Generate a one-time password for a credential.
   *
   * @param handle - OATH client handle returned by {@link create}.
   * @param credentialId - Unique identifier for the credential.
   * @returns A promise that resolves to the OTP string.
   */
  generateCode(handle: string, credentialId: string): Promise<string>;

  /**
   * Generate a one-time password along with validity metadata.
   *
   * @param handle - OATH client handle returned by {@link create}.
   * @param credentialId - Unique identifier for the credential.
   * @returns A promise that resolves to a code-info payload containing the OTP and timing data.
   */
  generateCodeWithValidity(
    handle: string,
    credentialId: string,
    // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  ): Promise<Object>;

  /**
   * Release all resources held by the native OATH client.
   *
   * @param handle - OATH client handle returned by {@link create}.
   * @returns A promise that resolves when the client has been closed.
   */
  close(handle: string): Promise<void>;

  /**
   * Register an OATH policy evaluator configuration with the native registry.
   *
   * @param config - Serialised policy evaluator configuration payload.
   * @returns The opaque registry id for the registered evaluator configuration.
   *
   * @remarks
   * The `config` object contains a `policies` array of kind strings and an
   * optional `loggerId`. Pass the returned id as `policyEvaluatorId` in
   * the {@link create} config, or retrieve the descriptor later via
   * {@link configureOathPolicyEvaluator}.
   */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  registerOathPolicyEvaluator(config: Object): string;

  /**
   * Retrieve a previously registered policy evaluator descriptor by id.
   *
   * @param id - Registry id returned by {@link registerOathPolicyEvaluator}.
   * @returns The serialised policy evaluator descriptor payload.
   */
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
  configureOathPolicyEvaluator(id: string): Object;
}

/**
 * Resolve by probing TurboModule first, then falling back to the classic bridge module.
 *
 * @returns Native OATH module implementation for the current architecture.
 * @throws Error when no native OATH module is registered.
 */
let _nativeModule: Spec | null = null;
export function getNativeModule(): Spec {
  if (_nativeModule) return _nativeModule;

  const turbo = TurboModuleRegistry.get<Spec>('RNPingOath');
  if (turbo) {
    _nativeModule = turbo;
    return _nativeModule;
  }

  const classic = NativeModules.RNPingOathClassic as Spec | undefined;
  if (classic) {
    _nativeModule = classic;
    return _nativeModule;
  }

  const availableModules = __DEV__
    ? '\nAvailable NativeModules: ' + JSON.stringify(Object.keys(NativeModules))
    : '';
  throw new Error(
    '[@ping-identity/rn-oath] Native module RNPingOath not found.\n' +
      'Ensure the library is linked correctly and the app has been rebuilt.' +
      availableModules,
  );
}
