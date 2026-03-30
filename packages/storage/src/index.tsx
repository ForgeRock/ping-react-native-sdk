/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { getNativeModule } from './NativeRNPingStorage';
import type {
  BaseStorageConfig,
  NativeCacheStrategy,
  NativeStorageConfig,
} from './NativeRNPingStorage';
import { CacheStrategy } from './types';
import type { LoggerInstance } from '@ping-identity/rn-types';
import type {
  OidcStorage,
  SessionStorage,
  StorageConfig,
  StorageError,
  StorageLoggerOptions,
} from './types';

export type {
  OidcStorage,
  SessionStorage,
  StorageConfig,
  StorageError,
  StorageLoggerOptions,
} from './types';
export { CacheStrategy } from './types';

/**
 * Cached default logger used when callers do not provide one.
 */
let defaultLoggerInstance: LoggerInstance | null = null;

const createNoopLogger = (): LoggerInstance => ({
  nativeHandle: { id: 'native-none-id' },
  changeLevel: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
});

/**
 * Lazily initialize and return the default logger instance.
 */
const getDefaultLogger = (): LoggerInstance => {
  if (!defaultLoggerInstance) {
    defaultLoggerInstance = createNoopLogger();
  }
  return defaultLoggerInstance;
};

/**
 * Resolve JS logger instance and native logger identifier for bridge calls.
 */
const resolveLogger = (
  options?: StorageLoggerOptions,
): { logger: LoggerInstance; loggerId?: string } => {
  const logger = options?.logger ?? getDefaultLogger();
  const loggerId =
    logger.nativeHandle?.id ?? getDefaultLogger().nativeHandle?.id;

  return { logger, loggerId };
};

/**
 * Converts the public CacheStrategy enum to the native string literal.
 *
 * @param strategy - Cache strategy enum value
 * @returns Native cache strategy string for the bridge
 *
 * @internal
 */
function toNativeCacheStrategy(strategy: CacheStrategy): NativeCacheStrategy {
  switch (strategy) {
    case CacheStrategy.CACHE_ON_FAILURE:
      return 'cache_on_failure';
    case CacheStrategy.NO_CACHE:
      return 'no_cache';
    case CacheStrategy.CACHE:
      return 'cache';
    default: {
      const exhaustiveCheck: never = strategy;
      return exhaustiveCheck;
    }
  }
}

/**
 * Converts the native cache strategy string to the public CacheStrategy enum.
 *
 * @param strategy - Native cache strategy string
 * @returns CacheStrategy enum value
 *
 * @internal
 */
function fromNativeCacheStrategy(strategy: NativeCacheStrategy): CacheStrategy {
  switch (strategy) {
    case 'cache_on_failure':
      return CacheStrategy.CACHE_ON_FAILURE;
    case 'no_cache':
      return CacheStrategy.NO_CACHE;
    case 'cache':
      return CacheStrategy.CACHE;
    default: {
      const exhaustiveCheck: never = strategy;
      return exhaustiveCheck;
    }
  }
}

/**
 * Validates the storage configuration.
 *
 * @param config - The storage configuration to validate
 * @throws {StorageError} If the configuration is missing or invalid
 *
 * @internal
 */
function validateStorageConfig(config: StorageConfig) {
  if (!config) {
    const error: StorageError = {
      type: 'argument_error',
      error: 'STORAGE_INVALID_CONFIG',
      message:
        '[@ping-identity/rn-storage] Missing configuration: You must provide a valid storage config.',
    };
    throw error;
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
 */
function buildNativeConfig(
  config: StorageConfig,
  loggerId?: string,
): NativeStorageConfig {
  return {
    ...(loggerId ? { loggerId } : {}),
    ...(config.android?.keyAlias ? { keyAlias: config.android.keyAlias } : {}),
    ...(config.android?.fileName ? { fileName: config.android.fileName } : {}),
    ...(config.android?.strongBoxPreferred !== undefined
      ? { strongBoxPreferred: config.android.strongBoxPreferred }
      : {}),
    ...(config.android?.cacheStrategy
      ? { cacheStrategy: toNativeCacheStrategy(config.android.cacheStrategy) }
      : {}),
    ...(config.ios?.account ? { account: config.ios.account } : {}),
    ...(config.ios?.encryptor !== undefined
      ? { encryptor: config.ios.encryptor }
      : {}),
    ...(config.ios?.cacheable !== undefined
      ? { cacheable: config.ios.cacheable }
      : {}),
  };
}

/**
 * Validates the native storage configuration result.
 * Ensures the result is a valid object type and throws an error if it's not.
 *
 * @param nativeResult - The native storage configuration to validate
 * @throws {StorageError} If the native result is not null, undefined, or an object
 *
 * @internal
 */
function validateNormalizedResult(
  nativeResult: NativeStorageConfig | null | undefined,
) {
  if (
    nativeResult !== null &&
    nativeResult !== undefined &&
    typeof nativeResult !== 'object'
  ) {
    const error: StorageError = {
      type: 'parse_error',
      error: 'STORAGE_INVALID_RESULT',
      message:
        '[@ping-identity/rn-storage] Failed to resolve storage configuration.',
    };
    throw error;
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
    ...(parsed.cacheStrategy !== undefined
      ? { cacheStrategy: fromNativeCacheStrategy(parsed.cacheStrategy) }
      : {}),
  };
}

/**
 * Normalizes a native storage configuration into a structured StorageConfig.
 * Takes a flattened native configuration object and restructures it into
 * platform-specific sections (android and ios).
 *
 * @param nativeResult - The native storage configuration to normalize
 * @returns Normalized StorageConfig with platform-specific options properly nested
 * @throws {StorageError} If the native result is not a valid configuration object
 *
 * @internal
 */
function normalizeStorageConfig(
  nativeResult: NativeStorageConfig | null | undefined,
): StorageConfig {
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
 * Creates an opaque session storage handle from a resolved config payload.
 *
 * @param id - Native storage identifier
 * @param config - Normalized storage configuration
 * @returns Branded session storage handle
 *
 * @internal
 */
function createSessionStorageHandle(
  id: string,
  config: BaseStorageConfig,
): SessionStorage {
  return {
    id,
    kind: 'session',
    ...config,
  } as SessionStorage;
}

/**
 * Creates an opaque OIDC storage handle from a resolved config payload.
 *
 * @param id - Native storage identifier
 * @param config - Normalized storage configuration
 * @returns Branded OIDC storage handle
 *
 * @internal
 */
function createOidcStorageHandle(
  id: string,
  config: BaseStorageConfig,
): OidcStorage {
  return {
    id,
    kind: 'oidc',
    ...config,
  } as OidcStorage;
}

/**
 * Registers and resolves a session storage handle.
 *
 * This function handles registration internally and returns a normalized
 * storage configuration that can be passed to other modules or SDKs.
 *
 * @param config - Storage configuration parameters with platform-specific options
 * @returns A branded SessionStorage handle with native storage id metadata
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
 * TODO: Analyze implications of turning storage operations async to better handle errors from native bridge calls.
 */
export function configureSessionStorage(
  config: StorageConfig,
  options?: StorageLoggerOptions,
): SessionStorage {
  const { logger, loggerId } = resolveLogger(options);
  logger.debug(`Storage configureSessionStorage requested`);
  validateStorageConfig(config);
  const NativeRNPingStorage = getNativeModule();
  try {
    const storageId = NativeRNPingStorage.registerSessionStorage(
      buildNativeConfig(config, loggerId),
    );
    logger.debug(`Storage configureSessionStorage registered`);
    const result = NativeRNPingStorage.configureSessionStorage(storageId);
    logger.info('Storage configureSessionStorage success');
    return createSessionStorageHandle(
      storageId,
      normalizeStorageConfig(result),
    );
  } catch (error) {
    logger.error('Storage configureSessionStorage failed');
    throw error;
  }
}

/**
 * Registers and resolves an OIDC storage handle.
 *
 * This function handles registration internally and returns a normalized
 * storage configuration that can be passed to other modules or SDKs.
 *
 * @param config - Storage configuration parameters with platform-specific options
 * @returns A branded OidcStorage handle with native storage id metadata
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
 * TODO: Analyze implications of turning storage operations async to better handle errors from native bridge calls.
 */
export function configureOidcStorage(
  config: StorageConfig,
  options?: StorageLoggerOptions,
): OidcStorage {
  const { logger, loggerId } = resolveLogger(options);
  logger.debug(`Storage configureOidcStorage requested`);
  validateStorageConfig(config);
  const NativeRNPingStorage = getNativeModule();
  try {
    const storageId = NativeRNPingStorage.registerOidcStorage(
      buildNativeConfig(config, loggerId),
    );
    logger.debug(`Storage configureOidcStorage registered`);
    const result = NativeRNPingStorage.configureOidcStorage(storageId);
    logger.info('Storage configureOidcStorage success');
    return createOidcStorageHandle(storageId, normalizeStorageConfig(result));
  } catch (error) {
    logger.error('Storage configureOidcStorage failed');
    throw error;
  }
}
