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

## Table of contents

- [Integrating the SDK into your project](#integrating-the-sdk-into-your-project)
- [How to Use the SDK](#how-to-use-the-sdk)
- [Error handling](#error-handling)
- [TODO](#todo)
- [License](#license)

## Integrating the SDK into your project

Add the package and let autolinking wire the native code:

```bash
yarn add @ping-identity/rn-browser
cd ios && pod install
```

Optional integration packages:

```bash
yarn add @ping-identity/rn-logger
```

- `@ping-identity/rn-logger`: optional JS/native logger integration.

## How to Use the SDK

### Configure (Android only)

Apply global customization for Custom Tabs/Auth Tabs. iOS currently ignores these options.

```ts
import { configureBrowser } from '@ping-identity/rn-browser';

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

```groovy
android {
  defaultConfig {
    // For redirect URI "com.example.app://callback", configure:
    manifestPlaceholders["appRedirectUriScheme"] = "com.example.app"
  }
}
```

### Configure logging (optional)

If you install the logger package, pass a JS logger instance per call via `BrowserLoggerOptions`.
The logger must be created via `@ping-identity/rn-logger`.
If the logger package is not installed/configured, omit the logger option.

```ts
import {
  open,
  configureBrowser,
  resetBrowser,
} from '@ping-identity/rn-browser';
import { logger } from '@ping-identity/rn-logger';

const jsLogger = logger({ level: 'debug' });

// Pass as the last argument to any browser call
const result = await open(
  'https://example.com',
  { callbackUrlScheme: 'com.example.app' },
  { logger: jsLogger },
);

// Also supported on configureBrowser and resetBrowser
configureBrowser(
  { android: { customTabs: { showTitle: true } } },
  { logger: jsLogger },
);
resetBrowser({ logger: jsLogger });
```

### Open a browser session

```ts
import { open } from '@ping-identity/rn-browser';

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

Promise rejections throw a `BrowserError` instance, which extends `PingError extends Error`.
Cancellations resolve as `{ type: 'cancel' }` rather than rejecting.

Error codes:

- `BROWSER_OPEN_ERROR` for validation/launch failures

```ts
import { BrowserError } from '@ping-identity/rn-browser';

try {
  await open('https://example.com', { callbackUrlScheme: 'com.example.app' });
} catch (err) {
  if (err instanceof BrowserError) {
    console.log(err.code, err.type, err.message);
  }
}
```

## TODO

- Add an iOS test runner target to execute module unit tests.

## License

MIT
