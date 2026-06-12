<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native OIDC

This module exposes native-backed OIDC clients for PingOne and ForgeRock platforms.

## Table of contents

- [Integrating the SDK into your project](#integrating-the-sdk-into-your-project)
- [How to Use the SDK](#how-to-use-the-sdk)
- [Android redirect configuration](#android-redirect-configuration)
- [Error handling](#error-handling)

## Integrating the SDK into your project

> **Note:** This module requires that the `@ping-identity/rn-core` module is already set up and installed.

```bash
# Install & setup the core module
yarn add @ping-identity/rn-core
# Install the rn-oidc module
yarn add @ping-identity/rn-oidc
# If you are developing your app using iOS, run this command
cd ios && pod install
```

Optional integration packages:

```bash
yarn add @ping-identity/rn-storage
yarn add @ping-identity/rn-logger
yarn add @ping-identity/rn-browser
```

- `@ping-identity/rn-storage`: optional token storage customization.
- `@ping-identity/rn-logger`: optional JS/native logger integration.
- `@ping-identity/rn-browser`: optional global browser configuration (for example, Android Custom Tabs/Auth Tabs) or direct Browser API usage.

The native OIDC SDK already bundles the required browser components for authorize/logout flows.
Install `@ping-identity/rn-browser` only when you want explicit Browser-module configuration or
direct Browser API calls in your app.

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

> **Note:** `tokenExpiry` is excluded from token responses — the Android SDK does not expose it publicly yet. It will be added once both platforms support it.

### Configure token storage (optional)

If you want to customize native token storage, configure it with the Storage module and pass the
handle into the OIDC client configuration.

```ts
import { CacheStrategy, configureOidcStorage } from '@ping-identity/rn-storage';
import { createOidcClient } from '@ping-identity/rn-oidc';

const oidcStorage = configureOidcStorage({
  android: {
    fileName: 'ping-oidc',
    keyAlias: 'ping-oidc',
    strongBoxPreferred: true,
    cacheStrategy: 'cache_on_failure',
  },
  ios: {
    account: 'com.example.app.oidc',
    encryptor: true,
    cacheable: false,
  },
});

const oidcClient = createOidcClient({
  clientId: 'client-id',
  discoveryEndpoint: 'https://example.com/.well-known/openid-configuration',
  redirectUri: 'com.example.app://callback',
  scopes: ['openid', 'profile'],
  storage: oidcStorage,
});
```

### Configure logging (optional)

If you install the logger package, pass either a JS logger instance or a native logger handle.
Both `logger` and `nativeLogger` values must be created via `@ping-identity/rn-logger`.
If the logger package is not installed/configured, do not pass logger values in OIDC config.

```ts
import { createOidcClient } from '@ping-identity/rn-oidc';
import { logger, configureLogger } from '@ping-identity/rn-logger';

const jsLogger = logger({ level: 'debug' });
const nativeLogger = configureLogger({ level: 'warn' });

const oidcClient = createOidcClient({
  clientId: 'client-id',
  discoveryEndpoint: 'https://example.com/.well-known/openid-configuration',
  redirectUri: 'com.example.app://callback',
  scopes: ['openid', 'profile'],
  logger: jsLogger,
  nativeLogger,
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
import { configureBrowser } from '@ping-identity/rn-browser';

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
const user = await oidcWebClient.user();
if (user) {
  const tokens = await user.token();
  const refreshed = await user.refresh();
  const profile = await user.userinfo(true);
  await user.revoke();
  await user.logout();
}
```

### Use the React provider and hook (optional)

Use `OidcProvider` when multiple screens should share one OIDC state source (auth status, user,
loading, and errors). This avoids duplicating `useOidc(oidcWebClient)` in each screen.

```tsx
import { OidcProvider, useOidc } from '@ping-identity/rn-oidc';

function App(): React.ReactElement {
  return (
    <OidcProvider client={oidcWebClient}>
      <OidcScreen />
    </OidcProvider>
  );
}

function OidcScreen(): React.ReactElement {
  const [state, actions] = useOidc();

  const onLogin = async (): Promise<void> => {
    await actions.authorize();
  };

  const onLogout = async (): Promise<void> => {
    await actions.logout();
  };

  return <></>;
}
```

Common hook state/actions:

- `state.isAuthenticated` indicates whether a user session is currently available.
- `state.user` is the resolved user session object (or `null`).
- `state.isLoading` indicates an in-flight OIDC operation.
- `state.error` is the latest operation error (if any).
- `actions.authorize()`, `actions.logout()`, `actions.refresh()`, `actions.revoke()`, `actions.userinfo()`, `actions.clear()`.

If you only need OIDC in one screen, you can skip the provider and pass the client directly:

```ts
const [state, actions] = useOidc(oidcWebClient);
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

All promise rejections throw an `OidcError` instance, which extends `PingError extends Error`.
Use `instanceof` to narrow the error type:

```ts
import { OidcError } from '@ping-identity/rn-oidc';

try {
  await oidcWebClient.authorize();
} catch (err) {
  if (err instanceof OidcError) {
    console.log(err.code, err.type, err.message);
  }
}
```

Stable OIDC error codes:

- `OIDC_AUTHORIZE_ERROR`
- `OIDC_HAS_USER_ERROR`
- `OIDC_STATE_ERROR`
- `OIDC_TOKEN_ERROR`
- `OIDC_REFRESH_ERROR`
- `OIDC_USERINFO_ERROR`
- `OIDC_REVOKE_ERROR`
- `OIDC_LOGOUT_ERROR`

`OIDC_STATE_ERROR` is used by JS hook/provider guardrails (for example, missing OIDC client context).

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details
