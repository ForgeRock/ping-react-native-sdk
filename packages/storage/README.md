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
- `configureSessionStorage` / `configureOidcStorage` return opaque storage handles.
  Handle objects include `id` and `kind` and can be passed into native-backed modules.
- Android uses encrypted storage by default; `android.keyAlias` and other
  `android` options (including `fileName`, `strongBoxPreferred`) are optional.
- iOS uses Keychain storage and supports `ios.account` (Keychain account)
  and `ios.encryptor` (true uses an Encryptor, false uses NoEncryptor).
- `android.cacheStrategy` controls how the SDK caches data when native storage
  is unavailable.

### StorageConfig type

You can import `StorageConfig` to type the input passed to
`configureSessionStorage` / `configureOidcStorage`. The configured outputs are
branded as `SessionStorage` or `OidcStorage` for type safety.

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

Pass the storage handle returned by `configureSessionStorage` or
`configureOidcStorage` directly into Journey config:

```ts
import {
  configureOidcStorage,
  configureSessionStorage,
  type OidcStorage,
} from '@react-native-pingidentity/storage';
import { journey } from '@ping-identity/rn-journey';

const sessionStorage = configureSessionStorage({
  android: {
    keyAlias: 'ping.session',
    fileName: 'ping_session_store',
  },
});

const oidcStorage: OidcStorage = configureOidcStorage({
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

const journeyClient = journey({
  serverUrl: 'https://example.com/am',
  modules: {
    session: {
      storage: sessionStorage,
    },
    oidc: {
      storage: oidcStorage,
    },
  },
});
```
