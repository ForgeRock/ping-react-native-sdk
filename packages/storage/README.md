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
Use `configure*` to register and resolve the config for inline module usage:

```ts
import {
  CacheStrategy,
  configureSessionStorage,
  configureOidcStorage,
} from '@react-native-pingidentity/storage';
import type {
  SessionStorage,
  OidcStorage,
  StorageConfig,
} from '@react-native-pingidentity/storage';

// Configure session storage for Journey SSO tokens (Android configuration)
const sessionStorage: SessionStorage = configureSessionStorage({
  android: {
    keyAlias: 'ping.session',
    fileName: 'ping_session_store',
    cacheStrategy: CacheStrategy.CACHE,
  },
});

// Configure OIDC storage for OAuth/OIDC tokens (Android configuration)
const oidcStorage: OidcStorage = configureOidcStorage({
  android: {
    keyAlias: 'ping.oidc',
    fileName: 'ping_oidc_tokens',
  },
  ios: {
    account: 'com.example.app.oidc',
    encryptor: true,
  },
});
```

Notes:
- `configureSessionStorage` / `configureOidcStorage` return a normalized config
  with an `id` you can pass into native-backed modules that accept storage handles.
- Android uses encrypted storage by default; `android.keyAlias` and other
  `android` options (including `fileName`, `strongBoxPreferred`) are optional.
- iOS uses Keychain storage and supports `ios.account` (Keychain account)
  and `ios.encryptor` (true uses an Encryptor, false uses NoEncryptor).
- `android.cacheStrategy` controls how the SDK caches data when native storage
  is unavailable.

### StorageConfig type

You can import `StorageConfig` to type storage configuration objects that can be
passed to `configureSessionStorage`/`configureOidcStorage` or reused by modules
that accept inline storage configuration. The configured outputs are branded
as `SessionStorage` or `OidcStorage` for type safety.

```ts
import type { OidcStorage, StorageConfig } from '@react-native-pingidentity/storage';

const oidcCfg: StorageConfig = {
  android: {
    keyAlias: 'ping.oidc',
    fileName: 'ping_oidc_tokens',
  },
};

const oidcStorage: OidcStorage = configureOidcStorage(oidcCfg);

// Pass the storage handle to modules that accept storage ids.
// createOidcClient({ storage: oidcStorage, ... });
```

### Journey module usage

The Journey module will accept a storage configuration inline in a future release.
Because the native storage fields differ between Android and iOS, pass the normalized
config fields explicitly so the same JS code works on both platforms:

```ts
import type { OidcStorage } from '@react-native-pingidentity/storage';

const oidcConfig: OidcStorage = configureOidcStorage({
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
