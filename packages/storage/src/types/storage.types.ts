/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { GenericError } from '@ping-identity/rn-types';

/**
 * Cache strategies for Android storage operations.
 *
 * Defines how the SDK handles caching behavior when storing and retrieving data.
 * These strategies are Android-specific and control how data is cached in memory
 * versus persistent storage.
 *
 * @example
 * ```typescript
 * // Use CACHE_ON_FAILURE for resilient storage
 * const config = {
 *   android: {
 *     keyAlias: 'myKey',
 *     cacheStrategy: CacheStrategy.CACHE_ON_FAILURE
 *   }
 * };
 *
 * // Use NO_CACHE for sensitive data
 * const secureConfig = {
 *   android: {
 *     keyAlias: 'tokenKey',
 *     cacheStrategy: CacheStrategy.NO_CACHE
 *   }
 * };
 *
 * // Use CACHE for frequently accessed data
 * const fastConfig = {
 *   android: {
 *     keyAlias: 'sessionKey',
 *     cacheStrategy: CacheStrategy.CACHE
 *   }
 * };
 * ```
 */
export enum CacheStrategy {
  /**
   * Cache data only when storage operations fail.
   * Provides a fallback mechanism for transient storage failures.
   */
  CACHE_ON_FAILURE = 'cache_on_failure',

  /**
   * Do not cache data in memory.
   * All operations read/write directly from/to persistent storage.
   * Use for sensitive data that should not remain in memory.
   */
  NO_CACHE = 'no_cache',

  /**
   * Always cache data in memory.
   * Improves performance by reducing disk I/O.
   * Use for frequently accessed, less sensitive data.
   */
  CACHE = 'cache',
}

/**
 * Android-specific configuration options.
 *
 * This nested object contains all Android storage settings.
 * All properties within this object are ignored on iOS.
 */
export type AndroidStorageConfig = {
  /**
   * Encryption key alias for Android encrypted storage.
   *
   * Used by the Android Keystore system to identify the encryption key.
   * Each storage instance should have a unique key alias to ensure proper
   * data isolation.
   *
   * **Platform:** Android only
   *
   * @defaultValue 'defaultKey'
   */
  keyAlias?: string;

  /**
   * File name for Android persistent storage.
   *
   * Specifies the SharedPreferences file name where encrypted data is stored.
   * Different storage instances should use different file names to prevent
   * data conflicts.
   *
   * **Platform:** Android only
   *
   * @defaultValue 'secure_prefs'
   */
  fileName?: string;

  /**
   * StrongBox preference for Android keystore operations.
   *
   * When set to true, the SDK attempts to use hardware-backed StrongBox
   * for enhanced security. StrongBox is a hardware security module that
   * provides stronger protection against physical attacks.
   *
   * Falls back to standard Keystore if StrongBox is not available on the device.
   *
   * **Platform:** Android only
   *
   * @defaultValue false
   */
  strongBoxPreferred?: boolean;

  /**
   * Cache strategy for storage operations.
   *
   * Defines how the SDK handles caching behavior when storing and retrieving data.
   * Different strategies offer different trade-offs between performance and security.
   *
   * **Platform:** Android only
   *
   * @see {@link CacheStrategy} for available options
   */
  cacheStrategy?: CacheStrategy;
};

/**
 * iOS-specific configuration options.
 *
 * This nested object contains all iOS Keychain-specific settings.
 * All properties within this object are ignored on Android.
 */
export type IOSStorageConfig = {
  /**
   * Keychain account identifier for iOS.
   *
   * Specifies the account name used to store items in the iOS Keychain.
   * This identifier helps organize and isolate different types of data.
   * Typically uses reverse domain notation.
   *
   * **Platform:** iOS only
   *
   * @defaultValue 'com.pingidentity.rnsampleapp.keyalias'
   */
  account?: string;

  /**
   * Enable encryption for iOS Keychain storage.
   *
   * Controls whether data is encrypted before being stored in the Keychain:
   * - `true`: Uses an Encryptor for additional encryption layer
   * - `false`: Uses NoEncryptor (relies on Keychain's native encryption only)
   *
   * **Platform:** iOS only
   *
   * @defaultValue true
   */
  encryptor?: boolean;

  /**
   * Toggle iOS cache behavior when native storage is unavailable.
   *
   * Controls in-memory caching fallback when Keychain access fails or is unavailable.
   * This can be useful for development or testing scenarios.
   *
   * **Platform:** iOS only
   *
   * @defaultValue undefined (uses platform defaults)
   */
  cacheable?: boolean;
};

/**
 * Base configuration for storage instances across platforms.
 *
 * This configuration object supports both Android and iOS platforms with
 * platform-specific options. Android options are nested under the `android`
 * property, while iOS options are nested under the `ios` property.
 *
 * @example
 * Android-only configuration:
 * ```typescript
 * const androidConfig: StorageConfig = {
 *   android: {
 *     keyAlias: 'my_encryption_key',
 *     fileName: 'secure_storage',
 *     strongBoxPreferred: true,
 *     cacheStrategy: CacheStrategy.CACHE_ON_FAILURE
 *   }
 * };
 * ```
 *
 * @example
 * iOS-only configuration:
 * ```typescript
 * const iosConfig: StorageConfig = {
 *   ios: {
 *     account: 'com.example.myapp',
 *     encryptor: true,
 *     cacheable: false
 *   }
 * };
 * ```
 *
 * @example
 * Cross-platform configuration:
 * ```typescript
 * const config: StorageConfig = {
 *   // Android-specific
 *   android: {
 *     keyAlias: 'app_key',
 *     fileName: 'app_storage',
 *     strongBoxPreferred: true,
 *     cacheStrategy: CacheStrategy.CACHE,
 *   },
 *   // iOS-specific
 *   ios: {
 *     account: 'com.example.app',
 *     encryptor: true,
 *     cacheable: true
 *   }
 * };
 * ```
 *
 * @example
 * Minimal configuration (uses defaults):
 * ```typescript
 * const minimalConfig: StorageConfig = {
 *   android: {
 *     keyAlias: 'default_key'
 *   }
 * };
 * ```
 */
export type StorageConfig = {
  /**
   * Native identifier returned by the storage module.
   *
   * @remarks
   * This value is assigned by `configureSessionStorage`/`configureOidcStorage`
   * and can be passed into other modules that accept storage handles.
   */
  id?: string;
  /**
   * Android-specific configuration options.
   */
  android?: AndroidStorageConfig;
  /**
   * iOS-specific configuration options.
   */
  ios?: IOSStorageConfig;
};

/**
 * Error payload returned when storage operations fail.
 *
 * @remarks
 * Errors thrown from native storage operations follow this shape.
 */
export type StorageError = GenericError;

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
 * @remarks
 * The returned object includes an `id` that can be passed into native-backed
 * modules requiring a storage handle.
 * 
 * @see {@link StorageConfig} for configuration options
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
export type SessionStorage = StorageConfig;

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
 * @remarks
 * The returned object includes an `id` that can be passed into native-backed
 * modules requiring a storage handle.
 * 
 * @see {@link StorageConfig} for configuration options
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
export type OidcStorage = StorageConfig;
