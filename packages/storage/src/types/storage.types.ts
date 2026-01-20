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
 * This type is returned by {@link configureSessionStorage} after registering
 * a session storage configuration with {@link registerSessionStorage}.
 * 
 * Session storage typically stores temporary authentication state and session
 * data during Journey flows.
 * 
 * @see {@link BaseStorageConfig} for configuration options
 * @see {@link registerSessionStorage} to create a session storage
 * @see {@link configureSessionStorage} to retrieve a registered configuration
 * 
 * @example
 * Basic usage:
 * ```typescript
 * import { registerSessionStorage, configureSessionStorage } from '@react-native-pingidentity/storage';
 * 
 * // Register the storage configuration
 * const sessionId = registerSessionStorage({
 *   android: {
 *     keyAlias: 'session_key',
 *     fileName: 'session_data'
 *   }
 * });
 * 
 * // Retrieve the configuration for use
 * const sessionStorage: SessionStorage = configureSessionStorage(sessionId);
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
 * after registering an OIDC storage configuration with {@link registerOidcStorage}.
 * 
 * OIDC storage is critical for securely managing authentication tokens and
 * should use appropriate security settings for your application's requirements.
 * 
 * @see {@link BaseStorageConfig} for configuration options
 * @see {@link registerOidcStorage} to create an OIDC storage
 * @see {@link configureOidcStorage} to retrieve a registered configuration
 * 
 * @example
 * Basic usage:
 * ```typescript
 * import { registerOidcStorage, configureOidcStorage } from '@react-native-pingidentity/storage';
 * 
 * // Register the storage configuration
 * const oidcId = registerOidcStorage({
 *   android: {
 *     keyAlias: 'oidc_key',
 *     fileName: 'oidc_tokens'
 *   }
 * });
 * 
 * // Retrieve the configuration for use
 * const oidcStorage: OidcStorage = configureOidcStorage(oidcId);
 * 
 * // Use with OIDC configuration
 * // configureOidc({ storage: oidcStorage, ... });
 * ```
 * 
 */
export type OidcStorage = BaseStorageConfig;
