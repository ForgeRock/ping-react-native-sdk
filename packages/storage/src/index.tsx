import NativeRNPingStorage, { type StorageConfig } from './NativeRNPingStorage';

/**
 * Strongly-typed interface returned from `storage<T>()`.
 */
export interface StorageInstance<T> {
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
export async function storage<T = any>(
  config?: StorageConfig
): Promise<StorageInstance<T>> {
  if (!config || !config.type) {
    throw new Error(
      '[@react-native-pingidentity/storage] Missing configuration: ' +
        'You must provide a valid storage config, e.g. { type: "encrypted" }.'
    );
  }

  const ok = await NativeRNPingStorage.configure(config);
  if (!ok) {
    throw new Error(
      '[@react-native-pingidentity/storage] Failed to configure native storage'
    );
  }

  return {
    /**
     * Save a typed object
     */
    async save(value: T): Promise<boolean> {
      return await NativeRNPingStorage.save(value as Object);
    },

    /**
     * Retrieve stored value
     */
    async get(): Promise<T | null> {
      const result = await NativeRNPingStorage.get();
      return result ? (result as T) : null;
    },

    /**
     * Remove stored value
     */
    async remove(): Promise<boolean> {
      return await NativeRNPingStorage.remove();
    },
  };
}
