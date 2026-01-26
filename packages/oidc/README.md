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

### Create the web-capable client and authorize

```ts
import { createOidcWebClient } from '@ping-identity/rn-oidc';

const oidcWebClient = createOidcWebClient(oidcClient);
const result = await oidcWebClient.authorize();

// result: { type: 'success', code, state? } | { type: 'cancel' }
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

## TODO

- Document storage integration and browser configuration.
