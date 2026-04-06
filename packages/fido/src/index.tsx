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
  toNativeAuthenticationOptions,
  toNativeJourneyAuthenticationOptions,
  toNativeJourneyRegistrationOptions,
  toNativeRegistrationOptions,
} from './NativeRNPingFido';
import type {
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
 * Registers a new FIDO credential using native platform APIs.
 *
 * @param options Registration options payload.
 * @returns A promise that resolves to the registration result payload.
 *
 * @remarks
 * Promise rejections use {@link FidoError}.
 *
 * @example
 * ```typescript
 * import { register } from '@ping-identity/rn-fido';
 *
 * const result = await register({
 *   challenge: '...',
 *   rp: { id: 'example.com', name: 'Example' },
 *   user: { id: 'user-id', name: 'user@example.com', displayName: 'User' },
 *   pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
 * });
 * console.log(result);
 * ```
 */
export async function register(
  options: FidoRegistrationOptions
): Promise<FidoRegistrationResult> {
  const result = await getNativeModule().registerCredential(
    toNativeRegistrationOptions(options)
  );
  return fromNativeRegistrationResult(result);
}

/**
 * Authenticates with an existing FIDO credential using native platform APIs.
 *
 * @param options Authentication options payload.
 * @returns A promise that resolves to the authentication result payload.
 *
 * @remarks
 * Promise rejections use {@link FidoError}.
 *
 * @example
 * ```typescript
 * import { authenticate } from '@ping-identity/rn-fido';
 *
 * const result = await authenticate({
 *   challenge: '...',
 *   rpId: 'example.com',
 *   allowCredentials: [],
 * });
 * console.log(result);
 * ```
 */
export async function authenticate(
  options: FidoAuthenticationOptions
): Promise<FidoAuthenticationResult> {
  const result = await getNativeModule().authenticateCredential(
    toNativeAuthenticationOptions(options)
  );
  return fromNativeAuthenticationResult(result);
}

/**
 * Executes an active Journey FIDO registration callback.
 *
 * @param journey - Active Journey instance.
 * @param options - Optional registration callback execution options.
 * @returns A promise that resolves when callback execution succeeds.
 */
export async function registerForJourney(
  journey: JourneyInstance,
  options: FidoJourneyRegistrationOptions = {}
): Promise<FidoJourneyResult> {
  const journeyId = await journey.getId();
  const result = await getNativeModule().registerCredentialForJourney(
    journeyId,
    toNativeJourneyRegistrationOptions(options)
  );
  return fromNativeJourneyResult(result);
}

/**
 * Executes an active Journey FIDO authentication callback.
 *
 * @param journey - Active Journey instance.
 * @param options - Optional authentication callback execution options.
 * @returns A promise that resolves when callback execution succeeds.
 */
export async function authenticateForJourney(
  journey: JourneyInstance,
  options: FidoJourneyAuthenticationOptions = {}
): Promise<FidoJourneyResult> {
  const journeyId = await journey.getId();
  const result = await getNativeModule().authenticateCredentialForJourney(
    journeyId,
    toNativeJourneyAuthenticationOptions(options)
  );
  return fromNativeJourneyResult(result);
}

export type {
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
