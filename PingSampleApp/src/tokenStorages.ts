/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import {
  CacheStrategy,
  registerOidcStorage,
  registerSessionStorage,
  configureOidcStorage,
  configureSessionStorage,
  type StorageConfig,
} from "@react-native-pingidentity/storage";

/**
 * Information about a registered storage instance.
 *
 * @property id - Unique identifier for the storage instance
 * @property config - Configuration object for the storage
 */
export type StorageInfo = {
  id: string;
  config: StorageConfig;
};

let oidcStorage: StorageInfo | null = null;
let sessionStorage: StorageInfo | null = null;

/**
 * Configures and returns the OIDC storage instance.
 * Uses a singleton pattern - creates the storage on first call and returns the same instance on subsequent calls.
 *
 * @returns The OIDC storage information containing the storage ID and configuration
 */
export function configureOidcStorageInfo(): StorageInfo {
  if (!oidcStorage) {
    const baseConfig: StorageConfig = {
      android: {
        keyAlias: "ping.oidc",
        fileName: "ping_oidc_tokens",
        cacheStrategy: CacheStrategy.NO_CACHE,
      },
      ios: {
        account: "com.pingidentity.rnsampleapp.oidc",
        encryptor: true,
        cacheable: false,
      },
    };
    const id = registerOidcStorage(baseConfig);
    const resolvedConfig = configureOidcStorage(id);
    oidcStorage = { id, config: resolvedConfig };
    console.log("🔑 Created OIDC Storage:", id, resolvedConfig);
  }
  return oidcStorage;
}

/**
 * Configures and returns the session storage instance.
 * Uses a singleton pattern - creates the storage on first call and returns the same instance on subsequent calls.
 *
 * @returns The session storage information containing the storage ID and configuration
 */
export function configureSessionStorageInfo(): StorageInfo {
  if (!sessionStorage) {
    const baseConfig: StorageConfig = {
      android: {
        keyAlias: "ping.session",
        fileName: "ping_session_store",
        cacheStrategy: CacheStrategy.NO_CACHE,
      },
      ios: {
        account: "com.pingidentity.rnsampleapp.session",
        encryptor: true,
        cacheable: false,
      },
    };
    const id = registerSessionStorage(baseConfig);
    const resolvedConfig = configureSessionStorage(id);
    sessionStorage = { id, config: resolvedConfig };
    console.log("🎫 Created Session Storage:", id, resolvedConfig);
  }
  return sessionStorage;
}

/**
 * Retrieves the current OIDC and session storage instances.
 *
 * @returns An object containing both storage instances (may be null if not yet configured)
 */
export function getTokenStorages(): { oidcStorage: StorageInfo | null; sessionStorage: StorageInfo | null } {
  return { oidcStorage, sessionStorage };
}
