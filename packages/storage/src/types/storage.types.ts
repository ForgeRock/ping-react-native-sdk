/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { BaseStorageConfig } from "../NativeRNPingStorage";
import type {
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
 * import { configureSessionStorage } from '@react-native-pingidentity/storage';
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
 * import { configureOidcStorage } from '@react-native-pingidentity/storage';
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
