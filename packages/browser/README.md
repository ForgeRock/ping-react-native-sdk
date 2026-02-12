<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Browser

The Ping Identity React Native Browser module provides a safe, system-browser flow for OIDC/OAuth
logins. It launches Custom Tabs/Auth Tabs on Android and ASWebAuthenticationSession on iOS, then
returns the redirect URL to JavaScript.

## Integrating the SDK into your project

Add the package and let autolinking wire the native code:

```bash
yarn add @react-native-pingidentity/browser
cd ios && pod install
```

## How to Use the SDK

### Configure (Android only)

Apply global customization for Custom Tabs/Auth Tabs. iOS currently ignores these options.

```ts
import { configureBrowser } from '@react-native-pingidentity/browser';

configureBrowser({
  android: {
    customTabs: {
      showTitle: false,
      urlBarHidingEnabled: true,
      colorScheme: 'system',
    },
    authTabs: {
      ephemeral: true,
    },
  },
});
```

### iOS per-call configuration

iOS browser behavior is configured per call via the `ios` options on `open(...)`. These options
do not have a global configuration equivalent on iOS.

### Android manifest placeholder

Configure the manifest placeholder for your app's redirect URI scheme. This is used as a fallback
when Auth Tabs are not available and Custom Tabs must rely on the manifest scheme:

```gradle
android {
  defaultConfig {
    // For redirect URI "com.example.app://callback", configure:
    manifestPlaceholders["appRedirectUriScheme"] = "com.example.app"
  }
}
```

### Open a browser session

```ts
import { open } from '@react-native-pingidentity/browser';

const result = await open('https://example.com', {
  callbackUrlScheme: 'com.example.app',
  redirectUri: 'com.example.app://callback',
  ios: {
    browserType: 'authSession',
    browserMode: 'login',
  },
});

// result: { type: 'success', url } | { type: 'cancel' }
```

Security note: The module does not validate or sanitize the `url` you pass to `open`. Only launch
trusted URLs in your app (for example, enforce an `https` scheme and allow-listed hosts).

### Error handling

Native promise rejections map to the shared `GenericError` contract from
`@ping-identity/rn-types`. Errors are rejected as exceptions; cancellations are resolved as
`{ type: 'cancel' }` instead of being rejected.

Error codes:
- `BROWSER_OPEN_ERROR` for validation/launch failures

```ts
import type { BrowserError } from '@react-native-pingidentity/browser';

try {
  await open('https://example.com', { callbackUrlScheme: 'com.example.app' });
} catch (e) {
  const error = e as BrowserError;
  // error.type, error.error, error.message, error.code, error.status
}
```

## TODO

- Add an iOS test runner target to execute module unit tests.
