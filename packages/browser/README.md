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

> **Note:** This module requires that the `@ping-identity/rn-core` module is already set up and installed.

```bash
# Install & setup the core module
yarn add @ping-identity/rn-core
# Install the rn-browser module
yarn add @ping-identity/rn-browser
# If you are developing your app using iOS, run this command
cd ios && pod install
```

Optional integration packages:

```bash
yarn add @ping-identity/rn-logger
```

- `@ping-identity/rn-logger`: optional JS/native logger integration.

### Android build requirements

> **Note:** Building this package on Android requires JDK 21 and Kotlin 2.2 or later. The Ping
> Android SDK artifacts are compiled to Java 21 bytecode, so modules that compile against them must
> also use a JVM target of 21. The React Native Gradle plugin aligns Android modules to JVM 17, so
> set `react.internal.disableJavaVersionAlignment=true` in your app's `android/gradle.properties` to
> let the JVM 21 target apply. If third-party Kotlin modules in your app fail with a JVM target
> mismatch after setting it, you can optionally set `kotlin.jvm.target.validation.mode=warning` in
> the same file.

See the [Android build requirements](https://github.com/ForgeRock/ping-react-native-sdk#android-build-requirements) section in the repository README for optional settings and framework support.

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

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details
