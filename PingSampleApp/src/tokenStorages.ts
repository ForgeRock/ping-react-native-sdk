import {
  CacheStrategy,
  configureOidcStorage as registerOidcStorage,
  configureSessionStorage as registerSessionStorage,
  type OidcStorage,
  type SessionStorage,
} from "@react-native-pingidentity/storage";

let oidcStorage: OidcStorage | null = null;
let sessionStorage: SessionStorage | null = null;

export function configureOidcStorage() {
  if (!oidcStorage) {
    oidcStorage = registerOidcStorage({
      keyAlias: "ping.oidc",
      fileName: "ping_oidc_tokens",
      cacheStrategy: CacheStrategy.NO_CACHE,
      ios: {
        account: "com.pingidentity.rnsampleapp.oidc",
        encryptor: true,
      },
    });
    console.log("🔑 Created OIDC Storage:", oidcStorage.id);
  }
  return oidcStorage;
}

export function configureSessionStorage() {
  if (!sessionStorage) {
    sessionStorage = registerSessionStorage({
      keyAlias: "ping.session",
      fileName: "ping_session_store",
      cacheStrategy: CacheStrategy.NO_CACHE,
      ios: {
        account: "com.pingidentity.rnsampleapp.session",
        encryptor: true,
      },
    });
    console.log("🎫 Created Session Storage:", sessionStorage.id);
  }
  return sessionStorage;
}

export function getTokenStorages() {
  return { oidcStorage, sessionStorage };
}
