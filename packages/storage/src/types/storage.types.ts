/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { BaseStorageConfig } from '../NativeRNPingStorage';
import { CacheStrategy } from '../NativeRNPingStorage';
import { PingError } from '@ping-identity/rn-types';
import type { LoggerInstance } from '@ping-identity/rn-types';
import type {
  BindingUserKeyStorageHandle,
  OidcStorageHandle,
  SessionStorageHandle,
} from '@ping-identity/rn-types';

/**
 * Storage configuration type for Journey session data.
 *
 * Opaque handle returned by {@link configureSessionStorage}.
 *
 * Used by native-backed modules to resolve a previously registered
 * session storage configuration.
 *
 * Session storage typically stores temporary authentication state and session
 * data during Journey flows.
 *
 * @remarks
 * Includes a `kind` discriminator and compile-time brand so callers cannot
 * accidentally pass a plain config object where a registered handle is required.
 *
 * @see {@link BaseStorageConfig} for configuration input options
 * @see {@link configureSessionStorage} to register and resolve a configuration
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { configureSessionStorage } from '@ping-identity/rn-storage';
 *
 * const sessionStorage: SessionStorage = configureSessionStorage({
 *   android: {
 *     keyAlias: 'session_key',
 *     fileName: 'session_data'
 *   }
 * });
 *
 * // Use with Journey SDK
 * // initJourney({ sessionStorage, ... });
 * ```
 */
export type SessionStorage = BaseStorageConfig & SessionStorageHandle;

/**
 * Storage configuration type for OIDC tokens and authorization state.
 *
 * Opaque handle returned by {@link configureOidcStorage}.
 *
 * Used by native-backed modules to resolve a previously registered OIDC
 * storage configuration for token and authorization state persistence.
 *
 * OIDC storage is critical for securely managing authentication tokens and
 * should use appropriate security settings for your application's requirements.
 *
 * @remarks
 * Includes a `kind` discriminator and compile-time brand so callers cannot
 * accidentally pass a plain config object where a registered handle is required.
 *
 * @see {@link BaseStorageConfig} for configuration input options
 * @see {@link configureOidcStorage} to register and resolve a configuration
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { configureOidcStorage } from '@ping-identity/rn-storage';
 *
 * const oidcStorage: OidcStorage = configureOidcStorage({
 *   android: {
 *     keyAlias: 'oidc_key',
 *     fileName: 'oidc_tokens'
 *   }
 * });
 *
 * // Use with OIDC configuration
 * // configureOidc({ storage: oidcStorage, ... });
 * ```
 *
 */
export type OidcStorage = BaseStorageConfig & OidcStorageHandle;

/**
 * Storage configuration type for binding user key metadata.
 *
 * Opaque handle returned by {@link configureBindingUserKeyStorage}.
 */
export type BindingUserKeyStorage = BaseStorageConfig &
  BindingUserKeyStorageHandle;

/**
 * Public storage configuration accepted by storage registration helpers.
 */
export type StorageConfig = BaseStorageConfig;

/**
 * Error thrown when storage operations fail.
 *
 * Extends {@link PingError} to allow per-package `instanceof` narrowing.
 */
export class StorageError extends PingError {
  constructor(message: string, code: string, type: string, status?: number) {
    super(message, code, type, status);
    this.name = 'StorageError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static from(raw: unknown): StorageError {
    if (raw instanceof StorageError) return raw;
    const base = PingError.from(raw);
    const err = new StorageError(
      base.message,
      base.code,
      base.type,
      base.status,
    );
    if (raw instanceof Error && raw.stack) err.stack = raw.stack;
    return err;
  }
}

/**
 * Optional logger configuration for storage native calls.
 */
export type StorageLoggerOptions = {
  /**
   * Optional JavaScript logger instance.
   */
  logger?: LoggerInstance;
};

export { CacheStrategy };
