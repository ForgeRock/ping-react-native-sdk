/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
/**
 * Native cache strategy values used by the TurboModule bridge.
 * These must be string literals to satisfy React Native codegen.
 */
export type NativeCacheStrategy =
  | 'cache_on_failure'
  | 'no_cache'
  | 'cache';

/**
 * Native storage configuration passed to the native module.
 * 
 * This is a flattened version of {@link StorageConfig} where iOS-specific options
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
  cacheStrategy?: NativeCacheStrategy;
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
      '[@ping-identity/rn-storage] Classic RNPingStorageClassic native module not found.\n' +
      'Available NativeModules: ' + JSON.stringify(available)
    );
  }

  return classic as Spec;
}

export default getNativeModule();
