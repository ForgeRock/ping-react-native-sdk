import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';

export type BaseStorageConfig = {
  /**
   * Storage type: "memory", "encrypted", or "datastore"
  */
  type: 'memory' | 'encrypted' | 'datastore';

  /**
   * Optional encryption alias for keychain or secure store.
   */
  keyAlias?: string;

  /**
   * Optional file name for persistent storage.
   * Used when storage type is "encrypted" or "datastore".
  */
  fileName?: string;
  
  /**
   * Optional StrongBox preference for Android.
  */
  strongBoxPreferred?: boolean;

  /** 
   * Optional cache strategy.
   */
  
  cacheStrategy?: 'no_cache' | 'cache' | 'cache_on_failure';

  /**
   * Optional account for iOS.
   */
  account?: string;

  /**
   * Optional Encryptor for keychain (iOS). Defaults to false (NoEncryptor).
   */
  encryptor?: boolean;

};

// Detect New Architecture (Turbo)
const isNewArchEnabled =
  typeof global.__turboModuleProxy !== 'undefined' &&
  global.__turboModuleProxy != null;

export interface Spec extends TurboModule {
  /**
   * Configure and register a session storage instance.
   * @param config Storage configuration object.
   */
  configureSessionStorage(config: BaseStorageConfig): string;

  /**
   * Configure and register an OIDC storage instance.
   * @param config Storage configuration object.
   */
  configureOidcStorage(config: BaseStorageConfig): string;
}

/**
 * Gets the native storage module, supporting both New Architecture (Turbo Modules) and legacy architecture.
 * 
 * @returns The native RNPingStorage module implementation.
 * @throws Error if the classic native module is not found in legacy architecture.
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
      '[@react-native-pingidentity/storage] Classic RNPingStorage native module not found.\n' +
      'Available NativeModules: ' + JSON.stringify(available)
    );
  }

  return classic as Spec;
}

export default getNativeModule();
