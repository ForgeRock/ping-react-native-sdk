import NativeRNPingStorage, { type StorageConfig } from './NativeRNPingStorage';

/**
 * Strongly-typed interface returned from `storage<T>()`.
 */
export interface StorageInstance<T> {
  id: string;
  save(value: T): Promise<boolean>;
  get(): Promise<T | null>;
  remove(): Promise<boolean>;
}

/**
 * Strongly-typed storage wrapper around the native RNPingStorage TurboModule.
 * @example
 * const secureStorage = storage<User>({ type: 'encrypted' });
 * await secureStorage.save({ id: 1, name: 'Gaurav' });
 */
export function storage<T = any>(
  config?: StorageConfig
): StorageInstance<T> {
  if (!config || !config.type) {
    throw new Error(
      '[@react-native-pingidentity/storage] Missing configuration: ' +
        'You must provide a valid storage config, e.g. { type: "encrypted" }.'
    );
  }

  const id = NativeRNPingStorage.configure(config);
  if (!id) {
    throw new Error(
      '[@react-native-pingidentity/storage] Failed to configure native storage'
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
    async get(): Promise<T | null> {
      const result = await NativeRNPingStorage.get(id);
      return result ? (result as T) : null;
    },

    /**
     * Remove stored value
     */
    async remove(): Promise<boolean> {
      return await NativeRNPingStorage.remove(id);
    },
  };
}
