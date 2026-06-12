/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { Platform } from 'react-native';
import { noopLogger } from '@ping-identity/rn-types';
import { getNativeModule } from './NativeRNPingOath';
import { OathError } from './types';
import type {
  OathClient,
  OathClientConfig,
  OathCodeInfo,
  OathCredential,
} from './types';

/**
 * Assert that the client has not been closed.
 *
 * @param closed - Current closed state of the client.
 * @throws {@link OathError} with `type: 'state_error'` when the client is closed.
 */
function assertOpen(closed: boolean): void {
  if (closed) {
    throw new OathError(
      '[@ping-identity/rn-oath] Client is closed.',
      'OATH_STATE_ERROR',
      'state_error',
    );
  }
}

/**
 * Create a native-backed OATH client.
 *
 * @remarks
 * The factory is `async` because it calls the native `create` method to
 * initialise the OATH session and obtain an opaque handle string. Keep a
 * reference to the returned client and call {@link OathClient.close} when it is
 * no longer needed to release native resources.
 *
 * @param config - Optional OATH client configuration.
 * @returns A promise that resolves to an {@link OathClient} handle.
 * @throws {@link OathError} when the native OATH module fails to initialise.
 *
 * @example
 * Basic usage:
 * ```ts
 * const client = await createOathClient();
 * const credentials = await client.getCredentials();
 * await client.close();
 * ```
 *
 * @example
 * With a logger:
 * ```ts
 * import { logger } from '@ping-identity/rn-logger';
 *
 * const log = logger({ level: 'debug' });
 * const client = await createOathClient({ logger: log });
 * const code = await client.generateCode('my-credential-id');
 * await client.close();
 * ```
 */
export async function createOathClient(
  config?: OathClientConfig,
): Promise<OathClient> {
  const jsLogger = config?.logger ?? noopLogger;
  const rawLoggerId = jsLogger.nativeHandle?.id;
  const loggerId = rawLoggerId?.trim() ? rawLoggerId : undefined;

  const timeout = config?.timeout;
  if (timeout !== undefined && timeout < 0) {
    // Validate before calling native — see code-standards.md: "Validate inputs
    // before calling native; throw argument_error for caller mistakes."
    throw new OathError(
      `timeout must be >= 0 (received ${timeout}).`,
      'OATH_INVALID_PARAMETER',
      'argument_error',
    );
  }
  const enableCredentialCache = config?.enableCredentialCache;
  // encryptionEnabled is iOS-only. Drop it in JS so Android never sees the key
  // — keeps the native bridge clean and avoids Android dead-code reads.
  const encryptionEnabled =
    Platform.OS === 'ios' ? config?.encryptionEnabled : undefined;
  const storageId = config?.storage?.id;
  const policyEvaluatorId = config?.policyEvaluator?.id;

  jsLogger.debug('OATH createOathClient requested');

  let handle: string;
  try {
    handle = await getNativeModule().create({
      loggerId,
      timeout,
      enableCredentialCache,
      encryptionEnabled,
      ...(storageId !== undefined ? { storageId } : {}),
      ...(policyEvaluatorId !== undefined ? { policyEvaluatorId } : {}),
    });
  } catch (error) {
    jsLogger.error('OATH createOathClient failed');
    throw OathError.from(error);
  }

  jsLogger.info('OATH createOathClient success');

  let closed = false;

  return {
    addCredentialFromUri: async (uri: string): Promise<OathCredential> => {
      assertOpen(closed);
      jsLogger.debug('OATH addCredentialFromUri requested');
      try {
        const result = await getNativeModule().addCredentialFromUri(
          handle,
          uri,
        );
        jsLogger.info('OATH addCredentialFromUri success');
        return result as OathCredential;
      } catch (error) {
        jsLogger.error('OATH addCredentialFromUri failed');
        throw OathError.from(error);
      }
    },

    getCredential: async (
      credentialId: string,
    ): Promise<OathCredential | null> => {
      assertOpen(closed);
      jsLogger.debug('OATH getCredential requested');
      try {
        const result = await getNativeModule().getCredential(
          handle,
          credentialId,
        );
        jsLogger.info('OATH getCredential success');
        return result as OathCredential | null;
      } catch (error) {
        jsLogger.error('OATH getCredential failed');
        throw OathError.from(error);
      }
    },

    getCredentials: async (): Promise<OathCredential[]> => {
      assertOpen(closed);
      jsLogger.debug('OATH getCredentials requested');
      try {
        const result = await getNativeModule().getCredentials(handle);
        jsLogger.info('OATH getCredentials success');
        return result as OathCredential[];
      } catch (error) {
        jsLogger.error('OATH getCredentials failed');
        throw OathError.from(error);
      }
    },

    saveCredential: async (
      credential: OathCredential,
    ): Promise<OathCredential> => {
      assertOpen(closed);
      // Validate before calling native — mirrors the native OathCredential init checks.
      // digits must be 6 or 8 (RFC 4226/6238); period must be > 0 for TOTP;
      // counter must be >= 0 for HOTP.
      if (credential.digits !== 6 && credential.digits !== 8) {
        throw new OathError(
          `[@ping-identity/rn-oath] saveCredential: digits must be 6 or 8 (received ${credential.digits}).`,
          'OATH_INVALID_PARAMETER',
          'argument_error',
        );
      }
      if (credential.type === 'TOTP' && credential.period <= 0) {
        throw new OathError(
          `[@ping-identity/rn-oath] saveCredential: period must be > 0 for TOTP (received ${credential.period}).`,
          'OATH_INVALID_PARAMETER',
          'argument_error',
        );
      }
      if (credential.type === 'HOTP' && credential.counter < 0) {
        throw new OathError(
          `[@ping-identity/rn-oath] saveCredential: counter must be >= 0 for HOTP (received ${credential.counter}).`,
          'OATH_INVALID_PARAMETER',
          'argument_error',
        );
      }
      jsLogger.debug('OATH saveCredential requested');
      try {
        const result = await getNativeModule().saveCredential(
          handle,
          credential,
        );
        jsLogger.info('OATH saveCredential success');
        return result as OathCredential;
      } catch (error) {
        jsLogger.error('OATH saveCredential failed');
        throw OathError.from(error);
      }
    },

    deleteCredential: async (credentialId: string): Promise<boolean> => {
      assertOpen(closed);
      jsLogger.debug('OATH deleteCredential requested');
      try {
        const result = await getNativeModule().deleteCredential(
          handle,
          credentialId,
        );
        jsLogger.info('OATH deleteCredential success');
        return result;
      } catch (error) {
        jsLogger.error('OATH deleteCredential failed');
        throw OathError.from(error);
      }
    },

    generateCode: async (credentialId: string): Promise<string> => {
      assertOpen(closed);
      jsLogger.debug('OATH generateCode requested');
      try {
        const result = await getNativeModule().generateCode(
          handle,
          credentialId,
        );
        jsLogger.info('OATH generateCode success');
        return result;
      } catch (error) {
        jsLogger.error('OATH generateCode failed');
        throw OathError.from(error);
      }
    },

    generateCodeWithValidity: async (
      credentialId: string,
    ): Promise<OathCodeInfo> => {
      assertOpen(closed);
      jsLogger.debug('OATH generateCodeWithValidity requested');
      try {
        const result = await getNativeModule().generateCodeWithValidity(
          handle,
          credentialId,
        );
        jsLogger.info('OATH generateCodeWithValidity success');
        return result as OathCodeInfo;
      } catch (error) {
        jsLogger.error('OATH generateCodeWithValidity failed');
        throw OathError.from(error);
      }
    },

    close: async (): Promise<void> => {
      assertOpen(closed);
      jsLogger.debug('OATH close requested');
      try {
        await getNativeModule().close(handle);
        closed = true;
        jsLogger.info('OATH close success');
      } catch (error) {
        jsLogger.error('OATH close failed');
        throw OathError.from(error);
      }
    },
  };
}
