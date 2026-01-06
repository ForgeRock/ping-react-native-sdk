import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type { BaseStorageConfig } from './types';

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
   * Delete the stored object.
   * @returns Promise<boolean> indicating success.
   */
  delete(id: string): Promise<boolean>;
}

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
