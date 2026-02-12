/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';

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
 * Base configuration for storage instances across platforms.
 * 
 * This configuration object supports both Android and iOS platforms with
 * platform-specific options. Android options are nested under the `android`
 * property, while iOS options are nested under the `ios` property.
 * 
 * @example
 * Android-only configuration:
 * ```typescript
 * const androidConfig: BaseStorageConfig = {
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
 * const iosConfig: BaseStorageConfig = {
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
 * const config: BaseStorageConfig = {
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
 * const minimalConfig: BaseStorageConfig = {
 *   android: {
 *     keyAlias: 'default_key'
 *   }
 * };
 * ```
 */
export type BaseStorageConfig = {
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
   * 
   * This nested object contains all Android storage settings.
   * All properties within this object are ignored on iOS.
   */
  android?: {
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
   * 
   */
  ios?: {
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
     * 
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
     * 
     */
    cacheable?: boolean;
  };
};

/**
 * Native storage configuration passed to the native module.
 * 
 * This is a flattened version of {@link BaseStorageConfig} where iOS-specific options
 * and Android-specific options are merged into the top level for easier consumption
 * by native code.
 * 
 * This type is primarily for internal use and represents the structure that
 * the native bridge expects to receive.
 * 
 * @internal
 * 
 * @example
 * ```typescript
 * // Flattened configuration
 * const nativeConfig: NativeStorageConfig = {
 *   keyAlias: 'session_key',
 *   fileName: 'session_data',
 *   account: 'com.example.app',  // iOS property at top level
 *   encryptor: true               // iOS property at top level
 * };
 * ```
 */
export type NativeStorageConfig = {
  /** Optional encryption key alias for Android encrypted storage. */
  keyAlias?: string;
  /** Optional file name for Android persistent storage. */
  fileName?: string;
  /** Optional StrongBox preference for Android keystore. */
  strongBoxPreferred?: boolean;
  /** Optional cache strategy for storage operations. */
  cacheStrategy?: CacheStrategy;
  /** Optional Keychain account identifier (iOS only). */
  account?: string;
  /** Optional Encryptor flag for iOS Keychain (iOS only). */
  encryptor?: boolean;
  /** Optional cache flag for iOS Keychain (iOS only). */
  cacheable?: boolean;
};

/**
 * Detects if the New Architecture (Turbo Modules) is enabled.
 */
const isNewArchEnabled =
  typeof global.__turboModuleProxy !== 'undefined' &&
  global.__turboModuleProxy != null;

/**
 * Native module specification for RNPingStorage.
 * 
 * Defines the interface contract for the native storage module.
 * Extends TurboModule for New Architecture (Fabric) support.
 * 
 * This interface is implemented by native code on both iOS and Android platforms.
 * 
 * @interface
 */
export interface Spec extends TurboModule {
  /**
   * Register a session storage configuration.
   * 
   * Creates and stores a session storage configuration in native code,
   * returning a unique identifier for later retrieval.
   * 
   * @param config - Flattened storage configuration object
   * @returns A unique identifier string for the registered storage configuration
   * 
   * @example
   * ```typescript
   * const id = nativeModule.registerSessionStorage({
   *   keyAlias: 'session_key',
   *   fileName: 'session_file'
   * });
   * // Returns: "session_storage_abc123"
   * ```
   */
  registerSessionStorage(config: NativeStorageConfig): string;

  /**
   * Register an OIDC storage configuration.
   * 
   * Creates and stores an OIDC storage configuration in native code,
   * returning a unique identifier for later retrieval.
   * 
   * @param config - Flattened storage configuration object
   * @returns A unique identifier string for the registered storage configuration
   * 
   * @example
   * ```typescript
   * const id = nativeModule.registerOidcStorage({
   *   keyAlias: 'oidc_key',
   *   fileName: 'oidc_tokens',
   *   account: 'com.example.app'
   * });
   * // Returns: "oidc_storage_xyz789"
   * ```
   */
  registerOidcStorage(config: NativeStorageConfig): string;

  /**
   * Resolve a session storage configuration by identifier.
   * 
   * Retrieves a previously registered session storage configuration
   * from native code using its unique identifier.
   * 
   * @param id - Registered storage configuration identifier
   * @returns A storage configuration object
   * 
   * @example
   * ```typescript
   * const config = nativeModule.configureSessionStorage('session_storage_abc123');
   * // Returns: { keyAlias: 'session_key', fileName: 'session_file' }
   * ```
   */
  configureSessionStorage(id: string): NativeStorageConfig;

  /**
   * Resolve an OIDC storage configuration by identifier.
   * 
   * Retrieves a previously registered OIDC storage configuration
   * from native code using its unique identifier.
   * 
   * @param id - Registered storage configuration identifier
   * @returns A storage configuration object
   * 
   * @example
   * ```typescript
   * const config = nativeModule.configureOidcStorage('oidc_storage_xyz789');
   * // Returns: { keyAlias: 'oidc_key', fileName: 'oidc_tokens', account: 'com.example.app' }
   * ```
   */
  configureOidcStorage(id: string): NativeStorageConfig;
}

/**
 * Gets the native storage module, supporting both New Architecture (Turbo Modules) and legacy architecture.
 * 
 * Automatically detects the React Native architecture by checking for the __turboModuleProxy global:
 * - If New Architecture is enabled, uses TurboModuleRegistry
 * - Otherwise, falls back to classic NativeModules
 * 
 * @returns The native RNPingStorage module implementation
 * @throws {Error} If the classic native module is not found in legacy architecture
 */
export function getNativeModule(): Spec {
  if (isNewArchEnabled) {
    return TurboModuleRegistry.getEnforcing<Spec>('RNPingStorage');
  }

  const classic = NativeModules.RNPingStorage;
  if (!classic) {
    const available = Object.keys(NativeModules)
      .slice(0, 10); // avoid huge logs

    throw new Error(
      '[@react-native-pingidentity/storage] Classic RNPingStorageClassic native module not found.\n' +
      'Available NativeModules: ' + JSON.stringify(available)
    );
  }

  return classic as Spec;
}

export default getNativeModule();
