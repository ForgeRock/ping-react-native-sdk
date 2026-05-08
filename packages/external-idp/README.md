<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native External IDP

The Ping External IDP library empowers your React Native applications to seamlessly authenticate users through external Identity Providers (IDPs) such as Google, Facebook, and Apple. Acting as a plugin for the `journey` module, it streamlines the integration process by providing the necessary configurations and functionalities to initiate and manage authentication flows with these external services.

This library abstracts away the complexities of dealing with different IDP protocols and SDKs, offering a unified and developer-friendly API. By leveraging Ping External IDP, you can enhance your application's user experience by offering familiar and convenient login options.

## Table of contents

- [Overview](#overview)
- [Installation](#installation)
- [Android native configuration](#android-native-configuration)
- [iOS native configuration](#ios-native-configuration)
- [Provider console setup](#provider-console-setup)
- [Usage](#usage)
- [API reference](#api-reference)
- [Errors](#errors)
- [Known limitations](#known-limitations)

## Overview

The library supports native authentication through provider-specific SDKs (Google, Facebook, Apple) for an integrated in-app login flow when used with AIC Journey orchestration.

Supported authentication experiences:

- **Native:** uses provider-specific SDKs (Google, Facebook, Apple) for an integrated in-app login flow.
- **Browser-based:** coming in a future release.

## Installation

```bash
yarn add @ping-identity/rn-external-idp
cd ios && pod install
```

Optional integration packages:

```bash
yarn add @ping-identity/rn-logger
```

---

## Android native configuration

### 1. Add redirect URI scheme to `build.gradle`

Define the URI scheme in your app's `android/app/build.gradle` so native provider flows can return to your app when the native SDK requires an app redirect. This configuration is required for devices that do not support Auth Tabs and fall back to Custom Tabs:

```groovy
android {
    defaultConfig {
        manifestPlaceholders["appRedirectUriScheme"] = "myapp"
        // Replace "myapp" with your registered custom scheme (e.g. "com.example.myapp")
    }
}
```

This creates a redirect URI of the form `myapp://callback`.

### 2. Native provider SDKs

To enable native Google or Facebook login (avoiding a browser redirect), add the respective SDK dependencies to your app's `android/app/build.gradle`:

```groovy
dependencies {
    // Google Sign-In
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    // Required for devices running Android 13 and below
    implementation("androidx.credentials:credentials-play-services-auth:1.5.0")

    // Facebook Login
    implementation("com.facebook.android:facebook-login:18.0.3")
}
```

---

## iOS native configuration

### URL scheme in `Info.plist`

Add your app's custom URL scheme to `ios/<YourApp>/Info.plist` so the OS can route the OAuth redirect back to your app:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>myapp</string>
        </array>
    </dict>
</array>
```

Replace `myapp` with the scheme registered in your AIC configuration (e.g. `com.example.myapp`).

### Native provider SDKs

Native Google, Facebook, and Apple Sign-In handlers are detected at runtime via dynamic class lookup. Add the desired provider pods to your `Podfile`:

```ruby
# Google Sign-In
pod 'PingExternalIdPGoogle'

# Facebook Login
pod 'PingExternalIdPFacebook'

# Apple Sign-In
pod 'PingExternalIdPApple'
```

Run `pod install` after updating the `Podfile`.

> When a native provider pod is absent, `authorizeForJourney` rejects with `EXTERNAL_IDP_UNSUPPORTED_PROVIDER`.

### Route Google and Facebook callback URLs

If you use Google or Facebook Sign-In on iOS, route incoming provider callback URLs from your app delegate to the linked native provider handlers. Apple Sign-In does not need this callback routing.

```swift
#if canImport(PingExternalIdPFacebook)
import PingExternalIdPFacebook
#endif
#if canImport(PingExternalIdPGoogle)
import PingExternalIdPGoogle
#endif

func application(
  _ application: UIApplication,
  open url: URL,
  options: [UIApplication.OpenURLOptionsKey: Any] = [:]
) -> Bool {
  var handled = false
#if canImport(PingExternalIdPFacebook)
  handled = FacebookHandler.handleOpenURL(application, url: url, options: options)
#endif
#if canImport(PingExternalIdPGoogle)
  handled = GoogleHandler.handleOpenURL(application, url: url, options: options) || handled
#endif
  return handled
}
```

---

## Provider console setup

### Google — Google Cloud Console setup

1. Create a **Web application** OAuth 2.0 client ID — use this client ID in your AIC connector configuration.
2. Create an **Android** OAuth 2.0 client ID — associate it with your app's package name and SHA-1 signing certificate fingerprint.
3. Create an **iOS** OAuth 2.0 client ID — associate it with your app's bundle ID. Add the iOS client ID to `GIDClientID` and add the reversed client ID as a URL scheme in `Info.plist`. If `CFBundleURLTypes` already exists, add the Google Sign-In entry to the existing array.

```xml
<key>GIDClientID</key>
<string>YOUR_IOS_CLIENT_ID</string>

<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>google-signin</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>YOUR_IOS_REVERSED_CLIENT_ID</string>
        </array>
    </dict>
</array>
```

### Facebook — Facebook Developer Console setup

#### Android

Follow the [Facebook Android SDK guide](https://developers.facebook.com/docs/facebook-login/android) to register your app and generate key hashes.

Add to `android/app/src/main/res/values/strings.xml`:

```xml
<resources>
    <string name="facebook_app_id">YOUR_FACEBOOK_APP_ID</string>
    <string name="fb_login_protocol_scheme">fbYOUR_FACEBOOK_APP_ID</string>
    <string name="facebook_client_token">YOUR_CLIENT_TOKEN</string>
</resources>
```

Add to your `AndroidManifest.xml` inside `<application>`:

```xml
<activity android:name="com.facebook.CustomTabActivity" android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.VIEW"/>
        <category android:name="android.intent.category.DEFAULT"/>
        <category android:name="android.intent.category.BROWSABLE"/>
        <data android:scheme="@string/fb_login_protocol_scheme"/>
    </intent-filter>
</activity>
```

#### iOS

Follow the [Facebook iOS SDK guide](https://developers.facebook.com/docs/facebook-login/ios) to register your app bundle ID and configure iOS settings.

Add to `ios/<YourApp>/Info.plist`:

```xml
<key>FacebookAppID</key>
<string>YOUR_FACEBOOK_APP_ID</string>
<key>FacebookClientToken</key>
<string>YOUR_CLIENT_TOKEN</string>
<key>FacebookDisplayName</key>
<string>YOUR_APP_DISPLAY_NAME</string>

<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>facebook-login</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>fbYOUR_FACEBOOK_APP_ID</string>
        </array>
    </dict>
</array>
```

If `CFBundleURLTypes` already exists, add the Facebook Login entry to the existing array.

---

## Usage

### 1. Create a client

```ts
import { createExternalIdpClient } from '@ping-identity/rn-external-idp';
import { logger } from '@ping-identity/rn-logger';

const jsLogger = logger({ level: 'debug' });

const externalIdp = createExternalIdpClient({
  // Required app return URI for Auth Tab-capable devices.
  // Must include a URI scheme (e.g. 'com.myapp://callback').
  // When omitted, Android falls back to the appRedirectUriScheme manifest placeholder.
  redirectUri: 'com.myapp://callback',

  // Optional - pass a logger instance from @ping-identity/rn-logger.
  logger: jsLogger,
});
```

The client is reusable — create it once (e.g. with `useMemo`) and share it across callbacks in a flow.

### Logging integration (optional)

If you install the logger package, pass a JS logger instance created via
`@ping-identity/rn-logger`.
If the logger package is not installed/configured, do not pass logger values in External IDP config.
JavaScript-side External IDP logs use this logger on both platforms.

```ts
import { createExternalIdpClient } from '@ping-identity/rn-external-idp';
import { logger } from '@ping-identity/rn-logger';

const jsLogger = logger({ level: 'debug' });

const externalIdp = createExternalIdpClient({
  redirectUri: 'com.myapp://callback',
  logger: jsLogger,
});
```

### 2. Handle `IdpCallback` — authorize with an external provider

Call `authorizeForJourney` when the Journey node contains an `IdpCallback`. The native SDK handles the redirect internally; no deep-link listener or `journey.resume()` call is needed. After the promise resolves, call `journey.next({})` to advance the flow.

```ts
try {
  await externalIdp.authorizeForJourney(journey, {
    // index: 0  // Use when there are multiple IdpCallbacks in one node
  });
  await journey.next({});
} catch (error) {
  // See Errors section
}
```

### 3. Handle `SelectIdpCallback` — set the chosen provider

Call `selectProviderForJourney` before `journey.next({})` when the Journey node contains a `SelectIdpCallback`. The callback state is mutated natively and `next()` picks it up automatically.

```ts
await externalIdp.selectProviderForJourney(journey, 'google', {
  // index: 0  // Use when there are multiple SelectIdpCallbacks in one node
});
await journey.next({});
```

### Full example

```tsx
import { createExternalIdpClient } from '@ping-identity/rn-external-idp';

const externalIdp = createExternalIdpClient({
  redirectUri: 'com.myapp://callback',
});

async function handleExternalIdpNode(
  journey: JourneyInstance,
  callbacks: Callback[],
) {
  for (const cb of callbacks) {
    if (cb.type === 'SelectIdpCallback') {
      const provider = getUserSelectedProvider(); // e.g. 'google'
      await externalIdp.selectProviderForJourney(journey, provider);
    }

    if (cb.type === 'IdpCallback') {
      await externalIdp.authorizeForJourney(journey);
    }
  }

  await journey.next({});
}
```

---

## API reference

```ts
import { createExternalIdpClient } from '@ping-identity/rn-external-idp';
import type {
  ExternalIdpClient,
  ExternalIdpConfig,
  ExternalIdpAuthorizeOptions,
  ExternalIdpSelectOptions,
  ExternalIdpResult,
} from '@ping-identity/rn-external-idp';

function createExternalIdpClient(config: ExternalIdpConfig): ExternalIdpClient;

interface ExternalIdpClient {
  authorizeForJourney(
    journey: JourneyInstance,
    options?: ExternalIdpAuthorizeOptions,
  ): Promise<ExternalIdpResult>;

  selectProviderForJourney(
    journey: JourneyInstance,
    provider: string,
    options?: ExternalIdpSelectOptions,
  ): Promise<void>;
}
```

---

## Errors

All promise rejections throw an `ExternalIdpError` instance, which extends `PingError extends Error`.
Use `instanceof` to narrow the error type:

```ts
import { ExternalIdpError } from '@ping-identity/rn-external-idp';

try {
  await externalIdpClient.authorizeForJourney(node, providerId);
} catch (err) {
  if (err instanceof ExternalIdpError) {
    console.log(err.code, err.type, err.message);
  }
}
```

Stable error codes:

- `EXTERNAL_IDP_AUTHORIZE_ERROR`
- `EXTERNAL_IDP_CANCELLED`
- `EXTERNAL_IDP_UNSUPPORTED_PROVIDER`
- `EXTERNAL_IDP_CALLBACK_NOT_FOUND`
- `EXTERNAL_IDP_CONFIG_ERROR`
- `EXTERNAL_IDP_ACTIVITY_UNAVAILABLE` (Android)
- `EXTERNAL_IDP_WINDOW_UNAVAILABLE` (iOS)

---

## Known limitations

- **AIC with Journey orchestration: browser fallback is not supported on Android or iOS.** The native Android and iOS SDKs do not provide a browser-based fallback for `IdpCallback` Journey flows. Native provider SDKs must be linked for each target platform: Google or Facebook on Android, and Google, Facebook, or Apple on iOS. When the required native provider SDK is absent, `authorizeForJourney` rejects with `EXTERNAL_IDP_UNSUPPORTED_PROVIDER`.

---

© Copyright 2025-2026 Ping Identity Corporation. All Rights Reserved
