import type {
  SessionStorage,
  OidcStorage,
} from "./types";
import { getNativeModule } from "./NativeRNPingStorage";
import type { BaseStorageConfig } from "./NativeRNPingStorage";

export type {
  SessionStorage,
  OidcStorage,
} from "./types";

function validateStorageConfig(config: BaseStorageConfig) {
  if (!config || !config.type) {
    throw new Error(
      "[@react-native-pingidentity/storage] Missing configuration: " +
        'You must provide a valid storage config, e.g. { type: "encrypted" }.'
    );
  }

  // Runtime checks
  const validTypes = ["memory", "encrypted", "datastore"];
  if (!validTypes.includes(config.type)) {
    throw new Error(
      `[@react-native-pingidentity/storage] Invalid storage type: "${config.type}". ` +
        `Must be one of: ${validTypes.join(", ")}`
    );
  }

  if (config.cacheStrategy) {
    const validStrategies: Array<BaseStorageConfig["cacheStrategy"]> = [
      "no_cache",
      "cache_on_failure",
      "cache",
    ];
    if (!validStrategies.includes(config.cacheStrategy)) {
      throw new Error(
        `[@react-native-pingidentity/storage] Invalid cache strategy: "${config.cacheStrategy}". ` +
          `Must be one of: ${validStrategies.join(", ")}`
      );
    }
  }
}

/**
 * Factory function to create a storage instance specialized for SessionStorage.
 * @param config Storage configuration.
 */
export function createSessionStorage(config: BaseStorageConfig): SessionStorage {
  validateStorageConfig(config);
  const NativeRNPingStorage = getNativeModule();
  const id = NativeRNPingStorage.configureSessionStorage(config);
  if (!id) {
    throw new Error(
      "[@react-native-pingidentity/storage] Failed to configure native storage"
    );
  }

  return {
    id
  };
}

/**
 * Factory function to create a storage instance specialized for OidcStorage.
 * @param config Storage configuration.
 */
export function createOidcStorage(config: BaseStorageConfig): OidcStorage {
  validateStorageConfig(config);
  const NativeRNPingStorage = getNativeModule();
  const id = NativeRNPingStorage.configureOidcStorage(config);
  if (!id) {
    throw new Error(
      "[@react-native-pingidentity/storage] Failed to configure native storage"
    );
  }

  return {
    id
  }
}
