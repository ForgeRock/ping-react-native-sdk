import { getNativeModule } from "./NativeRNPingStorage";
import type { 
  BaseStorageConfig, 
  SessionStorageConfig,
  OidcStorageConfig,
  SessionStorage, 
  OidcStorage } from "./types";

/**
 * Strongly-typed interface returned from `storage<T>()`.
 */
export interface StorageInstance<T> {
  id: string;
  save(value: T): Promise<boolean>;
  getItem(): Promise<T | null>;
  delete(): Promise<boolean>;
}

/**
 * Strongly-typed storage wrapper around the native RNPingStorage TurboModule.
 * @example
 * const secureStorage = storage<User>({ type: 'encrypted' });
 * await secureStorage.save({ id: 1, name: 'Gaurav' });
 */
export function storage<T = any>(config?: BaseStorageConfig): StorageInstance<T> {
  if (!config || !config.type) {
    throw new Error(
      "[@react-native-pingidentity/storage] Missing configuration: " +
        'You must provide a valid storage config, e.g. { type: "encrypted" }.'
    );
  }

  const NativeRNPingStorage = getNativeModule();

  const id = NativeRNPingStorage.configure(config);
  if (!id) {
    throw new Error(
      "[@react-native-pingidentity/storage] Failed to configure native storage"
    );
  }

  return {
    id,
    /**
     * Save a typed object
     */
    async save(value: T): Promise<boolean> {
      return await NativeRNPingStorage.save(id, value as Object);
    },

    /**
     * Retrieve stored value
     */
    async getItem(): Promise<T | null> {
      const result = await NativeRNPingStorage.getItem(id);
      return result ? (result as T) : null;
    },

    /**
     * Remove stored value
     */
    async delete(): Promise<boolean> {
      return await NativeRNPingStorage.delete(id);
    },
  };
}

/**
 * Factory function to create a storage instance specialized for SessionStorage.
 * @param config Optional storage configuration.
 */
export function createSessionStorage(config?: SessionStorageConfig): StorageInstance<SessionStorage> {
  return storage<SessionStorage>(config);
}

/**
 * Factory function to create a storage instance specialized for OidcStorage.
 * @param config Optional storage configuration.
 */
export function createOidcStorage(config?: OidcStorageConfig): StorageInstance<OidcStorage> {
  return storage<OidcStorage>(config);
}
