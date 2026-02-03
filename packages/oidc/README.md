<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native OIDC

This module exposes native-backed OIDC clients for PingOne and ForgeRock platforms.

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
import { logger } from '@react-native-pingidentity/logger';

const debugLogger = logger({ level: 'debug' });

const oidcClient = createOidcClient({
  clientId: 'client-id',
  discoveryEndpoint: 'https://example.com/.well-known/openid-configuration',
  redirectUri: 'com.example.app://callback',
  scopes: ['openid', 'profile'],
  logger: debugLogger,
});
```

> TODO(iOS SDK 2.x): `signOutRedirectUri` is currently ignored on iOS. We will enable it once the native iOS
> SDK exposes support in a 2.x release.

### Configure token storage (optional)

If you want to customize native token storage, configure it with the Storage module and pass the
handle into the OIDC client configuration.

```ts
import { configureOidcStorage } from '@react-native-pingidentity/storage';
import { createOidcClient } from '@ping-identity/rn-oidc';
import { logger } from '@react-native-pingidentity/logger';

const oidcStorage = configureOidcStorage({
  fileName: 'ping-oidc',
  keyAlias: 'ping-oidc',
  strongBoxPreferred: true,
  cacheStrategy: 'cache_on_failure',
});

const debugLogger = logger({ level: 'debug' });

const oidcClient = createOidcClient({
  clientId: 'client-id',
  discoveryEndpoint: 'https://example.com/.well-known/openid-configuration',
  redirectUri: 'com.example.app://callback',
  scopes: ['openid', 'profile'],
  storage: oidcStorage,
  logger: debugLogger,
});
```

### Use the base client directly (no browser)

The OIDC client can be used without launching a browser. This is useful for headless token
operations such as refresh, revoke, or userinfo.

```ts
const tokens = await oidcClient.token();
const refreshed = await oidcClient.refresh();
const profile = await oidcClient.userinfo(true);
await oidcClient.revoke();
const endSession = await oidcClient.endSession();
```

### Override OpenID configuration (optional)

You may provide OpenID endpoints directly. Discovery is still required by the native SDKs, so
keep `discoveryEndpoint` even when using overrides.

```ts
const oidcClient = createOidcClient({
  clientId: 'client-id',
  discoveryEndpoint: 'https://example.com/.well-known/openid-configuration',
  redirectUri: 'com.example.app://callback',
  scopes: ['openid', 'profile'],
  openId: {
    authorizationEndpoint: 'https://example.com/oauth2/authorize',
    tokenEndpoint: 'https://example.com/oauth2/token',
    userinfoEndpoint: 'https://example.com/oauth2/userinfo',
    endSessionEndpoint: 'https://example.com/oauth2/signoff',
    revocationEndpoint: 'https://example.com/oauth2/revoke',
  },
});
```

### Create the web-capable client and authorize

```ts
import { createOidcWebClient } from '@ping-identity/rn-oidc';

const oidcWebClient = createOidcWebClient(oidcClient);
const result = await oidcWebClient.authorize();

// result: { type: 'success' } | { type: 'cancel' }
```

### Optional: Configure browser behavior (Android)

If you want to customize Custom Tabs/Auth Tabs behavior, configure the Browser module once at
app startup. The OIDC module will inherit these settings.

```ts
import { configureBrowser } from '@react-native-pingidentity/browser';

configureBrowser({
  android: {
    customTabs: {
      showTitle: true,
      urlBarHidingEnabled: true,
      colorScheme: 'system',
    },
    authTabs: {
      ephemeral: true,
      colorScheme: 'dark',
      toolbarColor: '#0B3D91',
    },
  },
});
```

### Optional: Configure browser behavior (iOS)

The iOS OIDC SDK supports per-client browser configuration. Provide `ios` options when creating
the OIDC client.

```ts
import { createOidcClient } from '@ping-identity/rn-oidc';

const oidcClient = createOidcClient({
  clientId: 'client-id',
  discoveryEndpoint: 'https://example.com/.well-known/openid-configuration',
  redirectUri: 'com.example.app://callback',
  scopes: ['openid', 'profile'],
  ios: {
    browserType: 'authSession',
    browserMode: 'login',
  },
});
```

### Work with user state

```ts
if (await oidcWebClient.hasUser()) {
  const user = await oidcWebClient.user();
  const tokens = await user?.token();
  const refreshed = await user?.refresh();
  const profile = await user?.userinfo(true);
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

Add the redirect intent filter to the `CustomTabActivity`:

```xml
<activity
    android:name="com.pingidentity.browser.CustomTabActivity"
    android:exported="true"
    android:launchMode="singleTop">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />

        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />

        <data
            android:scheme="${appRedirectUriScheme}"
            android:host="callback" />
    </intent-filter>
</activity>
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
