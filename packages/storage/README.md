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

The storage SDK exposes two configuration helpers for common use cases.
Both return a small object containing a unique `id` that the Core SDK can
use to look up the registered configuration:

```ts
import {
  CacheStrategy,
  configureSessionStorage,
  configureOidcStorage,
} from '@react-native-pingidentity/storage';
import type {
  SessionStorage,
  OidcStorage,
} from '@react-native-pingidentity/storage';

// Create session storage for Journey SSO tokens (Android configuration)
const sessionStorage: SessionStorage = configureSessionStorage({
  keyAlias: 'ping.session',
  fileName: 'ping_session_store',
  cacheStrategy: CacheStrategy.CACHE,
});

// Create OIDC storage for OAuth/OIDC tokens (Android configuration)
const oidcStorage: OidcStorage = configureOidcStorage({
  keyAlias: 'ping.oidc',
  fileName: 'ping_oidc_tokens',
  ios: {
    account: 'com.example.app.oidc',
    encryptor: true,
  },
});
```

Notes:
- Android uses encrypted storage by default; `keyAlias`, `fileName`, and
  `strongBoxPreferred` are optional.
- iOS uses Keychain storage and supports `ios.account` (Keychain account)
  and `ios.encryptor` (true uses an Encryptor, false uses NoEncryptor).
- `cacheStrategy` controls how the SDK caches data when native storage
  is unavailable (Android only).

### Journey module usage

The Journey module will accept storage configuration using the `id` values:

```ts
const oidcConfig = configureOidcStorage({
  keyAlias: "ping.oidc",
  fileName: "ping_oidc_tokens",
});

const journey = configureJourney({
  modules: {
    oidc: {
      storage: {
        id: oidcConfig.id,
      },
    },
  },
});
```

