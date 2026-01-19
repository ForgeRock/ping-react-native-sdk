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

export type StorageInfo = {
  id: string;
  config: StorageConfig;
};

let oidcStorage: StorageInfo | null = null;
let sessionStorage: StorageInfo | null = null;

export function configureOidcStorageInfo() {
  if (!oidcStorage) {
    const baseConfig: StorageConfig = {
      keyAlias: "ping.oidc",
      fileName: "ping_oidc_tokens",
      cacheStrategy: CacheStrategy.NO_CACHE,
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

export function configureSessionStorageInfo() {
  if (!sessionStorage) {
    const baseConfig: StorageConfig = {
      keyAlias: "ping.session",
      fileName: "ping_session_store",
      cacheStrategy: CacheStrategy.NO_CACHE,
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

export function getTokenStorages() {
  return { oidcStorage, sessionStorage };
}
