import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';

/**
 * Cache strategies supported by Android storage.
 */
export enum CacheStrategy {
  CACHE_ON_FAILURE = 'cache_on_failure',
  NO_CACHE = 'no_cache',
  CACHE = 'cache',
}

/**
 * Base configuration for storage instances.
 * Platform-specific options are documented in their respective sections.
 * 
 * @example
 * ```typescript
 * const config: BaseStorageConfig = {
 *   keyAlias: 'my_encryption_key',     // Android only
 *   fileName: 'app_storage',            // Android only
 *   strongBoxPreferred: true,           // Android only
 *   cacheStrategy: CacheStrategy.CACHE, // Optional
 *   ios: {
 *     account: 'com.example.app',       // iOS only
 *     encryptor: true                    // iOS only
 *   }
 * };
 * ```
 */
export type BaseStorageConfig = {
  /**
   * Optional encryption key alias for Android encrypted storage.
   * Used by the Android Keystore system.
   * Default: 'defaultKey'
   */
  keyAlias?: string;

  /**
   * Optional file name for Android persistent storage.
   * Default: 'secure_prefs'
   */
  fileName?: string;

  /**
   * Optional StrongBox preference for Android keystore.
   * When true, attempts to use hardware-backed StrongBox for enhanced security.
   */
  strongBoxPreferred?: boolean;

  /**
   * Optional cache strategy for storage operations.
   * Defines how the SDK handles caching behavior.
   */
  cacheStrategy?: CacheStrategy;

  /**
   * iOS-specific configuration options.
   */
  ios?: {
    /**
     * Keychain account identifier for iOS.
     * Default: 'com.pingidentity.rnsampleapp.keyalias'
     */
    account?: string;

    /**
     * Enable encryption for iOS Keychain storage.
     * When true, uses an Encryptor; when false, uses NoEncryptor.
     * Default: true
     */
    encryptor?: boolean;
  };
};

/**
 * Native storage configuration passed to the native module.
 * This is a flattened version of BaseStorageConfig where iOS-specific options
 * are merged into the top level for easier consumption by native code.
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
};

/**
 * Detects if the New Architecture (Turbo Modules) is enabled.
 */
const isNewArchEnabled =
  typeof global.__turboModuleProxy !== 'undefined' &&
  global.__turboModuleProxy != null;

/**
 * Native module specification for RNPingStorage.
 * Extends TurboModule for New Architecture support.
 */
export interface Spec extends TurboModule {
  /**
   * Configure and register a session storage configuration.
   * @param config - Storage configuration object
   * @returns A unique identifier for the registered storage configuration
   */
  configureSessionStorage(config: NativeStorageConfig): string;

  /**
   * Configure and register an OIDC storage configuration.
   * @param config - Storage configuration object
   * @returns A unique identifier for the registered storage configuration
   */
  configureOidcStorage(config: NativeStorageConfig): string;
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
