[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-android-sdk)

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

## TODO

- Implement standardized error types and logger configuration once the related tickets are complete.
