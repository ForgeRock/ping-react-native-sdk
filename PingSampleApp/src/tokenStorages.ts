import {
  createOidcStorage,
  createSessionStorage,
  type OidcStorage,
  type SessionStorage,
} from "@react-native-pingidentity/storage";

let oidcStorage: OidcStorage | null = null;
let sessionStorage: SessionStorage | null = null;

export function configureOidcStorage() {
  if (!oidcStorage) {
    oidcStorage = createOidcStorage({
      type: "memory",
      keyAlias: "oidcKeyAlias",
      cacheStrategy: "no_cache",
    });
    console.log("🔑 Created OIDC Storage:", oidcStorage.id);
  }
  return oidcStorage;
}

export function configureSessionStorage() {
  if (!sessionStorage) {
    sessionStorage = createSessionStorage({
      type: "memory",
      keyAlias: "sessionKeyAlias",
      cacheStrategy: "no_cache",
    });
    console.log("🎫 Created Session Storage:", sessionStorage.id);
  }
  return sessionStorage;
}

export function getTokenStorages() {
  return { oidcStorage, sessionStorage };
}
