/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type {
  SessionStorage,
  OidcStorage,
} from "./types/storage.types";
import { getNativeModule } from "./NativeRNPingStorage";
import type { BaseStorageConfig, NativeStorageConfig } from "./NativeRNPingStorage";
import { CacheStrategy } from "./NativeRNPingStorage";

export type {
  SessionStorage,
  OidcStorage,
} from "./types/storage.types";
export type { BaseStorageConfig as StorageConfig } from "./NativeRNPingStorage";
export {
  CacheStrategy,
};

/**
 * Validates the storage configuration.
 * 
 * @param config - The storage configuration to validate
 * @throws {Error} If the configuration is missing or invalid
 * 
 * @internal
 * @example
 * ```typescript
 * validateStorageConfig({ keyAlias: 'myKey', fileName: 'myFile' });
 * // No error thrown - valid config
 * 
 * validateStorageConfig(null);
 * // Throws: "[@react-native-pingidentity/storage] Missing configuration..."
 * ```
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
 * 
 * @internal
 * @example
 * ```typescript
 * const config: BaseStorageConfig = {
 *   keyAlias: 'session_key',
 *   fileName: 'session_data',
 *   ios: {
 *     account: 'com.example.app',
 *     encryptor: true
 *   }
 * };
 * 
 * const nativeConfig = buildNativeConfig(config);
 * // Returns: {
 * //   keyAlias: 'session_key',
 * //   fileName: 'session_data',
 * //   account: 'com.example.app',
 * //   encryptor: true
 * // }
 * ```
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
    ...(config.ios?.cacheable !== undefined ? { cacheable: config.ios.cacheable } : {}),
  };
}

/**
 * Normalizes the native storage configuration result back into a BaseStorageConfig.
 * Converts a flattened native configuration into a structured configuration with
 * platform-specific options properly nested.
 *
 * @param nativeResult - JSON string from native module containing storage configuration
 * @returns The normalized base storage configuration with structured iOS options
 * @throws {Error} If the native result cannot be parsed
 * 
 * @internal
 * @example
 * ```typescript
 * const nativeResult = JSON.stringify({
 *   keyAlias: 'session_key',
 *   fileName: 'session_data',
 *   account: 'com.example.app',
 *   encryptor: true
 * });
 * 
 * const config = normalizeStorageConfig(nativeResult);
 * // Returns: {
 * //   keyAlias: 'session_key',
 * //   fileName: 'session_data',
 * //   ios: {
 * //     account: 'com.example.app',
 * //     encryptor: true
 * //   }
 * // }
 * ```
 */
function normalizeStorageConfig(nativeResult: string): BaseStorageConfig {
  try {
    const parsed = JSON.parse(nativeResult) as NativeStorageConfig;
    const ios =
      parsed.account !== undefined ||
      parsed.encryptor !== undefined ||
      parsed.cacheable !== undefined
        ? {
            ...(parsed.account ? { account: parsed.account } : {}),
            ...(parsed.encryptor !== undefined ? { encryptor: parsed.encryptor } : {}),
            ...(parsed.cacheable !== undefined ? { cacheable: parsed.cacheable } : {}),
          }
        : undefined;

    return {
      ...(parsed.keyAlias ? { keyAlias: parsed.keyAlias } : {}),
      ...(parsed.fileName ? { fileName: parsed.fileName } : {}),
      ...(parsed.strongBoxPreferred !== undefined
        ? { strongBoxPreferred: parsed.strongBoxPreferred }
        : {}),
      ...(parsed.cacheStrategy ? { cacheStrategy: parsed.cacheStrategy } : {}),
      ...(ios ? { ios } : {}),
    };
  } catch {
    throw new Error(
      "[@react-native-pingidentity/storage] Failed to resolve storage configuration."
    );
  }
}

/**
 * Validates that a storage identifier is provided and not empty.
 * 
 * @param id - The storage identifier to validate
 * @throws {Error} If the storage id is missing or empty
 * 
 * @internal
 * @example
 * ```typescript
 * validateStorageId('storage_123');
 * // No error thrown - valid id
 * 
 * validateStorageId('');
 * // Throws: "[@react-native-pingidentity/storage] Missing storage id..."
 * ```
 */
function validateStorageId(id: string) {
  if (!id) {
    throw new Error(
      "[@react-native-pingidentity/storage] Missing storage id: " +
        "You must provide a valid storage id."
    );
  }
}

/**
 * Resolves a session storage configuration by its unique identifier.
 * 
 * This function retrieves a previously registered session storage configuration
 * and returns it in a format that can be passed to other modules or SDKs.
 * Use this after registering a session storage with {@link registerSessionStorage}.
 *
 * @param id - Storage configuration identifier returned from {@link registerSessionStorage}
 * @returns A SessionStorage configuration object ready to use with Journey SDK
 * @throws {Error} If the configuration id is invalid, empty, or resolution fails
 * 
 * @example
 * ```typescript
 * // First, register the storage configuration
 * const sessionId = registerSessionStorage({
 *   keyAlias: 'session_key',
 *   fileName: 'session_data',
 *   strongBoxPreferred: true
 * });
 * 
 * // Then retrieve it for use with Journey
 * const sessionStorage = configureSessionStorage(sessionId);
 * 
 * // Pass to Journey SDK
 * // initJourney({ sessionStorage, ... });
 * ```
 */
export function configureSessionStorage(id: string): SessionStorage {
  validateStorageId(id);
  const NativeRNPingStorage = getNativeModule();
  const result = NativeRNPingStorage.configureSessionStorage(id);
  return normalizeStorageConfig(result);
}

/**
 * Resolves an OIDC storage configuration by its unique identifier.
 * 
 * This function retrieves a previously registered OIDC storage configuration
 * and returns it in a format that can be passed to other modules or SDKs.
 * Use this after registering an OIDC storage with {@link registerOidcStorage}.
 *
 * @param id - Storage configuration identifier returned from {@link registerOidcStorage}
 * @returns An OidcStorage configuration object ready to use with OIDC flows
 * @throws {Error} If the configuration id is invalid, empty, or resolution fails
 * 
 * @example
 * ```typescript
 * // First, register the storage configuration
 * const oidcId = registerOidcStorage({
 *   keyAlias: 'oidc_key',
 *   fileName: 'oidc_tokens',
 *   ios: {
 *     account: 'com.example.app',
 *     encryptor: true,
 *     cacheable: false
 *   }
 * });
 * 
 * // Then retrieve it for use with OIDC
 * const oidcStorage = configureOidcStorage(oidcId);
 * 
 * // Pass to OIDC configuration
 * // configureOidc({ storage: oidcStorage, ... });
 * ```
 */
export function configureOidcStorage(id: string): OidcStorage {
  validateStorageId(id);
  const NativeRNPingStorage = getNativeModule();
  const result = NativeRNPingStorage.configureOidcStorage(id);
  return normalizeStorageConfig(result);
}

/**
 * Registers a session storage configuration and returns a unique identifier.
 * 
 * This function creates a new session storage configuration with the specified
 * platform-specific settings. The returned identifier can be used with
 * {@link configureSessionStorage} to retrieve the configuration for use with the Journey SDK.
 * 
 * Session storage is typically used for storing temporary session data during authentication flows.
 *
 * @param config - Storage configuration parameters with platform-specific options
 * @returns A unique storage configuration identifier to use with {@link configureSessionStorage}
 * @throws {Error} If the configuration is missing or invalid
 * 
 * @example
 * Basic Android configuration:
 * ```typescript
 * const sessionId = registerSessionStorage({
 *   keyAlias: 'session_encryption_key',
 *   fileName: 'session_prefs',
 *   strongBoxPreferred: true,
 *   cacheStrategy: CacheStrategy.CACHE_ON_FAILURE
 * });
 * ```
 * 
 * @example
 * iOS-specific configuration:
 * ```typescript
 * const sessionId = registerSessionStorage({
 *   ios: {
 *     account: 'com.example.app.session',
 *     encryptor: true,
 *     cacheable: true
 *   }
 * });
 * ```
 * 
 * @example
 * Cross-platform configuration:
 * ```typescript
 * const sessionId = registerSessionStorage({
 *   keyAlias: 'session_key',      // Android only
 *   fileName: 'session_data',       // Android only
 *   strongBoxPreferred: true,       // Android only
 *   ios: {
 *     account: 'com.example.app',   // iOS only
 *     encryptor: true,               // iOS only
 *     cacheable: false               // iOS only
 *   }
 * });
 * ```
 */
export function registerSessionStorage(config: BaseStorageConfig): string {
  validateStorageConfig(config);
  const NativeRNPingStorage = getNativeModule();
  return NativeRNPingStorage.registerSessionStorage(buildNativeConfig(config));
}

/**
 * Registers an OIDC storage configuration and returns a unique identifier.
 * 
 * This function creates a new OIDC storage configuration with the specified
 * platform-specific settings. The returned identifier can be used with
 * {@link configureOidcStorage} to retrieve the configuration for OAuth/OIDC flows.
 * 
 * OIDC storage is used for securely storing OAuth tokens, refresh tokens, and
 * authorization state during authentication flows.
 *
 * @param config - Storage configuration parameters with platform-specific options
 * @returns A unique storage configuration identifier to use with {@link configureOidcStorage}
 * @throws {Error} If the configuration is missing or invalid
 * 
 * @example
 * Basic Android configuration:
 * ```typescript
 * const oidcId = registerOidcStorage({
 *   keyAlias: 'oidc_encryption_key',
 *   fileName: 'oidc_secure_prefs',
 *   strongBoxPreferred: true,
 *   cacheStrategy: CacheStrategy.NO_CACHE
 * });
 * ```
 * 
 * @example
 * iOS-specific configuration:
 * ```typescript
 * const oidcId = registerOidcStorage({
 *   ios: {
 *     account: 'com.example.app.oidc',
 *     encryptor: true,
 *     cacheable: false  // Disable cache for sensitive token data
 *   }
 * });
 * ```
 * 
 * @example
 * Cross-platform configuration:
 * ```typescript
 * const oidcId = registerOidcStorage({
 *   keyAlias: 'oauth_tokens',         // Android only
 *   fileName: 'oauth_storage',        // Android only
 *   strongBoxPreferred: true,         // Android only
 *   cacheStrategy: CacheStrategy.CACHE_ON_FAILURE,
 *   ios: {
 *     account: 'com.example.oauth',   // iOS only
 *     encryptor: true,                 // iOS only
 *     cacheable: false                 // iOS only
 *   }
 * });
 * ```
 */
export function registerOidcStorage(config: BaseStorageConfig): string {
  validateStorageConfig(config);
  const NativeRNPingStorage = getNativeModule();
  return NativeRNPingStorage.registerOidcStorage(buildNativeConfig(config));
}
