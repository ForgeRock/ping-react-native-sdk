[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Storage

The PingStorage SDK provides a flexible storage interface and a set of common
storage solutions for the Ping SDKs, serving React Native applications.

## Integrating the SDK into your project

Add the package and let autolinking wire the native code:

```bash
yarn add @react-native-pingidentity/storage
cd ios && pod install
```

## How to use the SDK

### Session and OIDC helpers

The storage SDK exposes two helpers for common use cases.
Use `register*` to create an id, then `configure*` to resolve the config for
inline module usage:

```ts
import {
  CacheStrategy,
  registerSessionStorage,
  registerOidcStorage,
  configureSessionStorage,
  configureOidcStorage,
} from '@react-native-pingidentity/storage';
import type {
  SessionStorage,
  OidcStorage,
  StorageConfig,
} from '@react-native-pingidentity/storage';

// Register session storage for Journey SSO tokens (Android configuration)
const sessionId = registerSessionStorage({
  android: {
    keyAlias: 'ping.session',
    fileName: 'ping_session_store',
    cacheStrategy: CacheStrategy.CACHE,
  },
});
const sessionStorage: SessionStorage = configureSessionStorage(sessionId);

// Register OIDC storage for OAuth/OIDC tokens (Android configuration)
const oidcId = registerOidcStorage({
  android: {
    keyAlias: 'ping.oidc',
    fileName: 'ping_oidc_tokens',
  },
  ios: {
    account: 'com.example.app.oidc',
    encryptor: true,
  },
});
const oidcStorage: OidcStorage = configureOidcStorage(oidcId);
```

Notes:
- Android uses encrypted storage by default; `android.keyAlias` and other
  `android` options (including `fileName`, `strongBoxPreferred`) are optional.
- iOS uses Keychain storage and supports `ios.account` (Keychain account)
  and `ios.encryptor` (true uses an Encryptor, false uses NoEncryptor).
- `android.cacheStrategy` controls how the SDK caches data when native storage
  is unavailable.

### StorageConfig type

You can import `StorageConfig` to type storage configuration objects that can be
passed to `registerSessionStorage`/`registerOidcStorage` or reused by modules
that accept inline storage configuration.

```ts
import type { StorageConfig } from '@react-native-pingidentity/storage';

const oidcCfg: StorageConfig = {
  android: {
    keyAlias: 'ping.oidc',
    fileName: 'ping_oidc_tokens',
  },
};

const oidcId = registerOidcStorage(oidcCfg);
const oidcStorage = configureOidcStorage(oidcId);
```

### Journey module usage

The Journey module will accept a storage configuration inline in a future release.
Because the native storage fields differ between Android and iOS, pass the normalized
config fields explicitly so the same JS code works on both platforms:

```ts
const oidcId = registerOidcStorage({
  // Android-only fields
  android: {
    keyAlias: 'ping.oidc',
    fileName: 'ping_oidc_tokens',
  },
  // iOS-only fields
  ios: {
    account: 'com.example.app.oidc',
    encryptor: true,
  },
});

const oidcConfig: StorageConfig = configureOidcStorage(oidcId);

const journey = configureJourney({
  modules: {
    oidc: {
      storage: {
        // Android fields (ignored on iOS)
        android: {
          keyAlias: oidcConfig.android?.keyAlias,
          fileName: oidcConfig.android?.fileName,
          strongBoxPreferred: oidcConfig.android?.strongBoxPreferred,
          cacheStrategy: oidcConfig.android?.cacheStrategy,
        },
        // iOS fields (ignored on Android)
        ios: {
          account: oidcConfig.ios?.account,
          encryptor: oidcConfig.ios?.encryptor,
          cacheable: oidcConfig.ios?.cacheable,
        },
      },
    },
  },
});
```
