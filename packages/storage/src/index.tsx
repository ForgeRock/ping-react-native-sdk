import type {
  SessionStorage,
  OidcStorage,
} from "./types";
import { getNativeModule } from "./NativeRNPingStorage";
import type { BaseStorageConfig, NativeStorageConfig } from "./NativeRNPingStorage";
import { CacheStrategy } from "./NativeRNPingStorage";

export type {
  SessionStorage,
  OidcStorage,
} from "./types";
export {
  CacheStrategy,
};

/**
 * Validates the storage configuration.
 * @param config - The storage configuration to validate
 * @throws {Error} If the configuration is missing or invalid
 */
function validateStorageConfig(config: BaseStorageConfig) {
  if (!config) {
    throw new Error(
      "[@react-native-pingidentity/storage] Missing configuration: " +
        "You must provide a valid storage config."
    );
  }
}

/**
 * Builds the native storage configuration from the base configuration.
 * Flattens the iOS-specific options into the top-level config object
 * for easier consumption by native modules.
 * 
 * @param config - The base storage configuration
 * @returns The native storage configuration object with flattened iOS options
 */
function buildNativeConfig(config: BaseStorageConfig): NativeStorageConfig {
  return {
    ...(config.keyAlias ? { keyAlias: config.keyAlias } : {}),
    ...(config.fileName ? { fileName: config.fileName } : {}),
    ...(config.strongBoxPreferred !== undefined
      ? { strongBoxPreferred: config.strongBoxPreferred }
      : {}),
    ...(config.cacheStrategy ? { cacheStrategy: config.cacheStrategy } : {}),
    ...(config.ios?.account ? { account: config.ios.account } : {}),
    ...(config.ios?.encryptor !== undefined ? { encryptor: config.ios.encryptor } : {}),
  };
}

/**
 * Configures and registers a session storage configuration.
 * Returns an identifier that can be used to reference this configuration.
 * The actual storage instance is created lazily by the Core SDK when needed.
 * 
 * @param config - Storage configuration parameters
 * @returns A SessionStorage object containing the unique configuration identifier
 * @throws {Error} If the configuration is invalid or registration fails
 * @example
 * ```typescript
 * const sessionStorage = configureSessionStorage({
 *   keyAlias: 'session_key',
 *   fileName: 'session_data',
 *   ios: {
 *     account: 'com.example.app.session',
 *     encryptor: true
 *   }
 * });
 * ```
 */
export function configureSessionStorage(config: BaseStorageConfig): SessionStorage {
  validateStorageConfig(config);
  const NativeRNPingStorage = getNativeModule();
  const id = NativeRNPingStorage.configureSessionStorage(buildNativeConfig(config));
  if (!id) {
    throw new Error(
      "[@react-native-pingidentity/storage] Failed to register storage configuration"
    );
  }

  return {
    id
  };
}

/**
 * Configures and registers an OIDC storage configuration.
 * Returns an identifier that can be used to reference this configuration.
 * The actual storage instance is created lazily by the Core SDK when needed.
 * 
 * @param config - Storage configuration parameters
 * @returns An OidcStorage object containing the unique configuration identifier
 * @throws {Error} If the configuration is invalid or registration fails
 * @example
 * ```typescript
 * const oidcStorage = configureOidcStorage({
 *   keyAlias: 'oidc_key',
 *   fileName: 'oidc_tokens',
 *   ios: {
 *     account: 'com.example.app.oidc',
 *     encryptor: true
 *   }
 * });
 * ```
 */
export function configureOidcStorage(config: BaseStorageConfig): OidcStorage {
  validateStorageConfig(config);
  const NativeRNPingStorage = getNativeModule();
  const id = NativeRNPingStorage.configureOidcStorage(buildNativeConfig(config));
  if (!id) {
    throw new Error(
      "[@react-native-pingidentity/storage] Failed to register storage configuration"
    );
  }

  return {
    id
  }
}
