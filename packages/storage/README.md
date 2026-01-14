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

The storage SDK exposes two factory functions for common use cases:

```ts
import {
  createSessionStorage,
  createOidcStorage,
} from '@react-native-pingidentity/storage';
import type { SessionStorage, OidcStorage } from '@react-native-pingidentity/storage';

// Create session storage for Journey SSO tokens
const sessionStorage: SessionStorage = createSessionStorage({
  type: 'encrypted',
  encrypted: true,
  cacheStrategy: 'no_cache',
});

// Create OIDC storage for OAuth/OIDC tokens
const oidcStorage: OidcStorage = createOidcStorage({
  type: 'datastore',
  encrypted: false,
  fileName: 'ping_oidc_tokens',
});
```
### TODO: Document upcoming error shapes.