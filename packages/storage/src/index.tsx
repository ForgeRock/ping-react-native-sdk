import { getNativeModule } from "./NativeRNPingStorage";
import type {
  SessionStorageConfig,
  OidcStorageConfig,
  SessionStorage,
  OidcStorage,
  SSOToken,
  Tokens } from "./types";
import type { BaseStorageConfig } from "./NativeRNPingStorage";

/**
 * Strongly-typed interface returned from `storage<T>()`.
 */
export interface StorageInstance<T> {
  id: string;
  save(value: T): Promise<boolean>;
  getItem(): Promise<T | null>;
  deleteItem(): Promise<boolean>;
}

/**
 * Strongly-typed storage wrapper around the native RNPingStorage TurboModule.
 * @example
 * const secureStorage = storage<User>({ type: 'encrypted' });
 * await secureStorage.save({ id: 1, name: 'Gaurav' });
 */
export function storage<T = any>(config: BaseStorageConfig): StorageInstance<T> {
  if (!config || !config.type) {
    throw new Error(
      "[@react-native-pingidentity/storage] Missing configuration: " +
        'You must provide a valid storage config, e.g. { type: "encrypted" }.'
    );
  }

  // Runtime checks
  const validTypes = ['memory', 'encrypted', 'datastore'];
  if (!validTypes.includes(config.type)) {
    throw new Error(
      `[@react-native-pingidentity/storage] Invalid storage type: "${config.type}". ` +
      `Must be one of: ${validTypes.join(', ')}`
    );
  }

  if (config.cacheStrategy) {
    const validStrategies: Array<BaseStorageConfig['cacheStrategy']> = [
      'no_cache',
      'cache_on_failure',
      'cache',
    ];
    if (!validStrategies.includes(config.cacheStrategy)) {
      throw new Error(
        `[@react-native-pingidentity/storage] Invalid cache strategy: "${config.cacheStrategy}". ` +
        `Must be one of: ${validStrategies.join(', ')}`
      );
    }
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
    async deleteItem(): Promise<boolean> {
      return await NativeRNPingStorage.deleteItem(id);
    },
  };
}

/**
 * Factory function to create a storage instance specialized for SessionStorage.
 * @param config Storage configuration.
 */
export function createSessionStorage(config: SessionStorageConfig): SessionStorage {
  const instance = storage<SSOToken>(config);
  return {
    async set(token) {
      await instance.save(token);
    },
    async getSSOToken() {
      return await instance.getItem();
    },
    async deleteSSOToken() {
      await instance.deleteItem();
    },
  };
}

/**
 * Factory function to create a storage instance specialized for OidcStorage.
 * @param config Storage configuration.
 */
export function createOidcStorage(config: OidcStorageConfig): OidcStorage {
  const instance = storage<Tokens>(config);
  return {
    async set(tokens) {
      await instance.save(tokens);
    },
    async getTokens() {
      return await instance.getItem();
    },
    async deleteTokens() {
      await instance.deleteItem();
    },
  };
}
