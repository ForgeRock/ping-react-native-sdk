<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native OIDC

The Ping Identity React Native OIDC module exposes native-backed OIDC clients for PingOne and
ForgeRock platforms. It delegates all protocol-sensitive operations to the native SDKs while
presenting a clear JavaScript API.

## Integrating the SDK into your project

Add the package and let autolinking wire the native code:

```bash
yarn add @ping-identity/rn-oidc
cd ios && pod install
```

The native OIDC SDK already bundles the required browser components, so you do not need the
React Native Browser package unless you plan to use it directly elsewhere in your app.

## How to Use the SDK

### Create the base OIDC client

```ts
import { createOidcClient } from '@ping-identity/rn-oidc';

const oidcClient = createOidcClient({
  clientId: 'client-id',
  discoveryEndpoint: 'https://example.com/.well-known/openid-configuration',
  redirectUri: 'com.example.app://callback',
  scopes: ['openid', 'profile'],
});
```

### Configure token storage (optional)

If you want to customize native token storage, configure it with the Storage module and pass the
handle into the OIDC client configuration.

```ts
import { configureOidcStorage } from '@react-native-pingidentity/storage';
import { createOidcClient } from '@ping-identity/rn-oidc';

const oidcStorage = configureOidcStorage({
  fileName: 'ping-oidc',
  keyAlias: 'ping-oidc',
  strongBoxPreferred: true,
  cacheStrategy: 'cache_on_failure',
});

const oidcClient = createOidcClient({
  clientId: 'client-id',
  discoveryEndpoint: 'https://example.com/.well-known/openid-configuration',
  redirectUri: 'com.example.app://callback',
  scopes: ['openid', 'profile'],
  storage: oidcStorage,
});
```

### Create the web-capable client and authorize

```ts
import { createOidcWebClient } from '@ping-identity/rn-oidc';

const oidcWebClient = createOidcWebClient(oidcClient);
const result = await oidcWebClient.authorize();

// result: { type: 'success' } | { type: 'cancel' }
```

### Work with user state

```ts
if (await oidcWebClient.hasUser()) {
  const user = await oidcWebClient.user();
  const tokens = await user?.token();
  await user?.revoke();
  await user?.logout();
}
```

## Android redirect configuration

Configure the app redirect scheme for Custom Tabs/Auth Tabs. For a redirect URI of
`com.example.app://callback`, add the manifest placeholder:

```gradle
android {
  defaultConfig {
    manifestPlaceholders["appRedirectUriScheme"] = "com.example.app"
  }
}
```

For HTTPS redirect URIs, add an App Links intent filter that matches your redirect URL and host.
See the Android App Links documentation for `assetlinks.json` setup.

## Error handling

All promise rejections use the shared `GenericError` contract from `@ping-identity/rn-types`.

```ts
import type { OidcError } from '@ping-identity/rn-oidc';

try {
  await oidcWebClient.authorize();
} catch (error) {
  const oidcError = error as OidcError;
  console.log(oidcError.type, oidcError.error, oidcError.message);
}
```
