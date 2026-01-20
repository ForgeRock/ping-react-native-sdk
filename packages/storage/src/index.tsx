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
 * validateStorageConfig({ android: { keyAlias: 'myKey', fileName: 'myFile' } });
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
 * Flattens platform-specific options into the top-level config object
 * for easier consumption by native modules.
 *
 * @param config - The base storage configuration
 * @returns The native storage configuration object with flattened platform options
 * 
 * @internal
 * @example
 * ```typescript
 * const config: BaseStorageConfig = {
 *   android: {
 *     keyAlias: 'session_key',
 *     fileName: 'session_data',
 *   },
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
    ...(config.android?.keyAlias ? { keyAlias: config.android.keyAlias } : {}),
    ...(config.android?.fileName ? { fileName: config.android.fileName } : {}),
    ...(config.android?.strongBoxPreferred !== undefined
      ? { strongBoxPreferred: config.android.strongBoxPreferred }
      : {}),
    ...(config.android?.cacheStrategy ? { cacheStrategy: config.android.cacheStrategy } : {}),
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
 * @param nativeResult - Native storage configuration object
 * @returns The normalized base storage configuration with structured platform options
 * @throws {Error} If the native result is not a valid configuration object
 * 
 * @internal
 * @example
 * ```typescript
 * const nativeResult = {
 *   keyAlias: 'session_key',
 *   fileName: 'session_data',
 *   account: 'com.example.app',
 *   encryptor: true
 * };
 * 
 * const config = normalizeStorageConfig(nativeResult);
 * // Returns: {
 * //   android: {
 * //     keyAlias: 'session_key',
 * //     fileName: 'session_data'
 * //   },
 * //   ios: {
 * //     account: 'com.example.app',
 * //     encryptor: true
 * //   }
 * // }
 * ```
 */
/**
 * Validates the native storage configuration result.
 * Ensures the result is a valid object type and throws an error if it's not.
 *
 * @param nativeResult - The native storage configuration to validate
 * @throws {Error} If the native result is not null, undefined, or an object
 * 
 * @internal
 * @example
 * ```typescript
 * validateNormalizedResult({ keyAlias: 'test' });
 * // No error - valid object
 * 
 * validateNormalizedResult(null);
 * // No error - null is acceptable
 * 
 * validateNormalizedResult("invalid");
 * // Throws: "Failed to resolve storage configuration."
 * ```
 */
function validateNormalizedResult(
  nativeResult: NativeStorageConfig | null | undefined
) {
  if (nativeResult !== null && nativeResult !== undefined && typeof nativeResult !== "object") {
    throw new Error(
      "[@react-native-pingidentity/storage] Failed to resolve storage configuration."
    );
  }
}

/**
 * Builds the iOS-specific storage configuration from a parsed native config.
 * Extracts iOS-related properties (account, encryptor, cacheable) and returns
 * them as a structured object, or undefined if no iOS values are present.
 *
 * @param parsed - The parsed native storage configuration
 * @returns iOS configuration object or undefined if no iOS values exist
 * 
 * @internal
 * @example
 * ```typescript
 * const parsed = {
 *   account: 'com.example.app',
 *   encryptor: true,
 *   keyAlias: 'android_key'
 * };
 * 
 * const iosConfig = buildIosConfig(parsed);
 * // Returns: { account: 'com.example.app', encryptor: true }
 * 
 * const androidOnly = { keyAlias: 'test' };
 * const noIos = buildIosConfig(androidOnly);
 * // Returns: undefined
 * ```
 */
function buildIosConfig(parsed: NativeStorageConfig) {
  const hasIosValues =
    parsed.account !== undefined ||
    parsed.encryptor !== undefined ||
    parsed.cacheable !== undefined;
  if (!hasIosValues) {
    return undefined;
  }

  return {
    ...(parsed.account !== undefined ? { account: parsed.account } : {}),
    ...(parsed.encryptor !== undefined ? { encryptor: parsed.encryptor } : {}),
    ...(parsed.cacheable !== undefined ? { cacheable: parsed.cacheable } : {}),
  };
}

/**
 * Builds the Android-specific storage configuration from a parsed native config.
 * Extracts Android-related properties (keyAlias, fileName, strongBoxPreferred, cacheStrategy)
 * and returns them as a structured object, or undefined if no Android values are present.
 *
 * @param parsed - The parsed native storage configuration
 * @returns Android configuration object or undefined if no Android values exist
 * 
 * @internal
 * @example
 * ```typescript
 * const parsed = {
 *   keyAlias: 'session_key',
 *   fileName: 'session_data',
 *   strongBoxPreferred: true,
 *   account: 'com.example.app'
 * };
 * 
 * const androidConfig = buildAndroidConfig(parsed);
 * // Returns: { keyAlias: 'session_key', fileName: 'session_data', strongBoxPreferred: true }
 * 
 * const iosOnly = { account: 'test' };
 * const noAndroid = buildAndroidConfig(iosOnly);
 * // Returns: undefined
 * ```
 */
function buildAndroidConfig(parsed: NativeStorageConfig) {
  const hasAndroidValues =
    parsed.keyAlias !== undefined ||
    parsed.fileName !== undefined ||
    parsed.strongBoxPreferred !== undefined ||
    parsed.cacheStrategy !== undefined;
  if (!hasAndroidValues) {
    return undefined;
  }

  return {
    ...(parsed.keyAlias !== undefined ? { keyAlias: parsed.keyAlias } : {}),
    ...(parsed.fileName !== undefined ? { fileName: parsed.fileName } : {}),
    ...(parsed.strongBoxPreferred !== undefined
      ? { strongBoxPreferred: parsed.strongBoxPreferred }
      : {}),
    ...(parsed.cacheStrategy !== undefined ? { cacheStrategy: parsed.cacheStrategy } : {}),
  };
}

/**
 * Normalizes a native storage configuration into a structured BaseStorageConfig.
 * Takes a flattened native configuration object and restructures it into
 * platform-specific sections (android and ios).
 *
 * @param nativeResult - The native storage configuration to normalize
 * @returns Normalized BaseStorageConfig with platform-specific options properly nested
 * @throws {Error} If the native result is not a valid configuration object
 * 
 * @internal
 * @example
 * ```typescript
 * const nativeConfig = {
 *   keyAlias: 'session_key',
 *   fileName: 'session_data',
 *   account: 'com.example.app',
 *   encryptor: true
 * };
 * 
 * const normalized = normalizeStorageConfig(nativeConfig);
 * // Returns: {
 * //   android: { keyAlias: 'session_key', fileName: 'session_data' },
 * //   ios: { account: 'com.example.app', encryptor: true }
 * // }
 * ```
 */
function normalizeStorageConfig(
  nativeResult: NativeStorageConfig | null | undefined
): BaseStorageConfig {
  validateNormalizedResult(nativeResult);

  const parsed = nativeResult ?? {};
  const ios = buildIosConfig(parsed);
  const android = buildAndroidConfig(parsed);

  return {
    ...(android ? { android } : {}),
    ...(ios ? { ios } : {}),
  };
}

/**
 * Registers and resolves a session storage configuration.
 * 
 * This function handles registration internally and returns a normalized
 * storage configuration that can be passed to other modules or SDKs.
 *
 * @param config - Storage configuration parameters with platform-specific options
 * @returns A SessionStorage configuration object ready to use with Journey SDK
 * @throws {Error} If the configuration is missing or invalid
 * 
 * @example
 * ```typescript
 * const sessionStorage = configureSessionStorage({
 *   android: {
 *     keyAlias: 'session_key',
 *     fileName: 'session_data',
 *     strongBoxPreferred: true
 *   }
 * });
 * 
 * // Pass to Journey SDK
 * // initJourney({ sessionStorage, ... });
 * ```
 */
export function configureSessionStorage(config: BaseStorageConfig): SessionStorage {
  validateStorageConfig(config);
  const NativeRNPingStorage = getNativeModule();
  const storageId = NativeRNPingStorage.registerSessionStorage(buildNativeConfig(config));
  const result = NativeRNPingStorage.configureSessionStorage(storageId);
  return normalizeStorageConfig(result);
}

/**
 * Registers and resolves an OIDC storage configuration.
 * 
 * This function handles registration internally and returns a normalized
 * storage configuration that can be passed to other modules or SDKs.
 *
 * @param config - Storage configuration parameters with platform-specific options
 * @returns An OidcStorage configuration object ready to use with OIDC flows
 * @throws {Error} If the configuration is missing or invalid
 * 
 * @example
 * ```typescript
 * const oidcStorage = configureOidcStorage({
 *   android: {
 *     keyAlias: 'oidc_key',
 *     fileName: 'oidc_tokens',
 *   },
 *   ios: {
 *     account: 'com.example.app',
 *     encryptor: true,
 *     cacheable: false
 *   }
 * });
 * 
 * // Pass to OIDC configuration
 * // configureOidc({ storage: oidcStorage, ... });
 * ```
 */
export function configureOidcStorage(config: BaseStorageConfig): OidcStorage {
  validateStorageConfig(config);
  const NativeRNPingStorage = getNativeModule();
  const storageId = NativeRNPingStorage.registerOidcStorage(buildNativeConfig(config));
  const result = NativeRNPingStorage.configureOidcStorage(storageId);
  return normalizeStorageConfig(result);
}
