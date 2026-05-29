<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Storage

The PingStorage SDK provides a flexible storage interface and a set of common
storage solutions for the Ping SDKs, serving React Native applications.

## Table of contents

- [Integrating the SDK into your project](#integrating-the-sdk-into-your-project)
- [How to use the SDK](#how-to-use-the-sdk)
- [Error handling](#error-model)
- [License](#license)

## Integrating the SDK into your project

> **Note:** This module requires that the `@ping-identity/rn-core` module is already set up and installed.

```bash
# Install & setup the core module
yarn add @ping-identity/rn-core
# Install the rn-storage module
yarn add @ping-identity/rn-storage
# If you are developing your app using iOS, run this command
cd ios && pod install
```

Optional integration packages:

```bash
yarn add @ping-identity/rn-logger
```

If you install the logger package, you can pass `StorageLoggerOptions` to storage APIs for
JavaScript-side logging. Native storage logger application is not enabled yet; `loggerId` remains
bridge-only for now.

## How to use the SDK

### Session and OIDC helpers

The storage SDK exposes two helpers for common use cases.
Use `configure*` to register and resolve the config for inline module usage:

```ts
import {
  CacheStrategy,
  configureSessionStorage,
  configureOidcStorage,
} from '@ping-identity/rn-storage';
import type {
  SessionStorage,
  OidcStorage,
  StorageConfig,
} from '@ping-identity/rn-storage';

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
- `StorageLoggerOptions` / `loggerId` are currently bridge-only for storage registration.
  Native storage logger application is planned and tracked as a TODO in both iOS and Android implementations.

### StorageConfig type

You can import `StorageConfig` to type the input passed to
`configureSessionStorage` / `configureOidcStorage`. The configured outputs are
branded as `SessionStorage` or `OidcStorage` for type safety.

```ts
import type { OidcStorage, StorageConfig } from '@ping-identity/rn-storage';

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
} from '@ping-identity/rn-storage';
import { createJourneyClient } from '@ping-identity/rn-journey';

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

const journeyClient = createJourneyClient({
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

## Error handling

Storage operations reject or throw a `StorageError` instance, which extends `PingError extends Error`.
Use `instanceof` to narrow the error type:

```ts
import { StorageError } from '@ping-identity/rn-storage';

try {
  const sessionStorage = configureSessionStorage({
    android: {
      keyAlias: 'ping.session',
      fileName: 'ping_session_store',
    },
  });
} catch (err) {
  if (err instanceof StorageError) {
    console.log(err.code, err.type, err.message);
  }
}
```

## License

MIT
