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
   * Configure the native storage engine.
   * @param config Storage configuration object.
   * @returns Promise<boolean> indicating success.
   */
  configure(config: BaseStorageConfig): string;

  /**
   * Save a JSON-serializable object.
   * @param item Object to store.
   * @returns Promise<boolean> indicating success.
   */
  save(id: string, item: Object): Promise<boolean>;

  /**
   * Get the stored object (or null if not found).
   * @returns Promise<object | null>
   */
  getItem(id: string): Promise<Object | null>;

  /**
   * Remove the stored object.
   * @returns Promise<boolean> indicating success.
   */
  deleteItem(id: string): Promise<boolean>;
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
