/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { BaseStorageConfig } from "../NativeRNPingStorage";

/**
 * Storage configuration type for Journey session data.
 * 
 * Used to configure secure storage for Journey authentication sessions.
 * This type is returned by {@link configureSessionStorage} after the module
 * registers a session storage configuration internally.
 * 
 * Session storage typically stores temporary authentication state and session
 * data during Journey flows.
 * 
 * @see {@link BaseStorageConfig} for configuration options
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
export type SessionStorage = BaseStorageConfig;

/**
 * Storage configuration type for OIDC tokens and authorization state.
 * 
 * Used to configure secure storage for OAuth/OIDC tokens, refresh tokens,
 * and authorization state. This type is returned by {@link configureOidcStorage}
 * after the module registers an OIDC storage configuration internally.
 * 
 * OIDC storage is critical for securely managing authentication tokens and
 * should use appropriate security settings for your application's requirements.
 * 
 * @see {@link BaseStorageConfig} for configuration options
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
export type OidcStorage = BaseStorageConfig;
