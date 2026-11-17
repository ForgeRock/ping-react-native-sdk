[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native External IDP

The Ping External IDP library empowers your React Native applications to seamlessly authenticate users through external Identity Providers (IDPs) such as Google, Facebook, and Apple. Acting as a plugin for the `journey` and `davinci` modules, it streamlines the integration process by providing the necessary configurations and functionalities to initiate and manage authentication flows with these external services.

This library abstracts away the complexities of dealing with different IDP protocols and SDKs, offering a unified and developer-friendly API. By leveraging Ping External IDP, you can enhance your application's user experience by offering familiar and convenient login options.

## Table of contents

- [Overview](#overview)
- [Installation](#installation)
- [Android native configuration](#android-native-configuration)
- [iOS native configuration](#ios-native-configuration)
- [Provider console setup](#provider-console-setup)
- [Usage](#usage)
- [Supporting additional social providers](#supporting-additional-social-providers)
- [DaVinci usage](#davinci-usage)
- [API reference](#api-reference)
- [Errors](#errors)
- [Known limitations](#known-limitations)

## Overview

The library supports native authentication through provider-specific SDKs (Google, Facebook, Apple) for an integrated in-app login flow.

Supported authentication experiences differ by orchestration type:

- **Journey (AIC):** native-only. Uses provider-specific SDKs (Google, Facebook, Apple) for an integrated in-app login flow, with one exception — Apple Sign-In on Android has no native SDK and must fall back to the browser. There is no browser fallback for Google or Facebook on either platform, or for Apple on iOS.
- **DaVinci:** falls back to the browser when a native provider SDK is not linked. Link the native SDK for each provider you want to support to guarantee the native sign-in experience.

## Installation

> **Note:** This module requires that the `@ping-identity/rn-core` module is already set up and installed.

```bash
# Install & setup the core module
yarn add @ping-identity/rn-core
# Install the rn-external-idp module
yarn add @ping-identity/rn-external-idp
# If you are developing your app using iOS, run this command
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

### With `useJourneyForm`

Pass `handledCallbackTypes` so IdP fields are excluded from blocking submit issues:

```ts
import { useJourney, useJourneyForm } from '@ping-identity/rn-journey';
import { nativeExtensionCallbackType } from '@ping-identity/rn-types';

const [node, actions] = useJourney(client);
const form = useJourneyForm(node, {
  handledCallbackTypes: new Set([nativeExtensionCallbackType.IdpCallback]),
});

await externalIdp.authorizeForJourney(journey);

if (form.canSubmit) {
  await actions.next(form.input);
}
```

---

## Supporting additional social providers

The built-in providers (apple, google, facebook, plus siwa on iOS) are fixed. To support a
provider they do not cover, such as LINE or WeChat, implement the native SDK's
`IdpHandler` interface in your app's native code and register it by provider
name at startup. Registration is native-only: no JS API, TurboModule, or client
configuration changes. Once registered, the existing `selectProviderForJourney`
and `authorizeForJourney` calls route to your handler whenever the Journey
callback's provider value matches. Custom handlers apply to Journey only:
`authorizeForDaVinci` does not consult the registry.

### 1. Implement `IdpHandler`

Implement the handler interface on each platform you ship:

| Platform | Interface                         | Members                                                                                               |
| -------- | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Android  | `com.pingidentity.idp.IdpHandler` | `var tokenType: String`, `suspend fun authorize(idpClient: IdpClient): IdpResult`                     |
| iOS      | `PingExternalIdP.IdpHandler`      | `var tokenType: String { get set }`, `func authorize(idpClient: IdpClient) async throws -> IdpResult` |

The iOS protocol inherits `Sendable`, so the conforming type must be a struct
or a class that is safe to share across tasks (for example, immutable state
or lock-guarded state with `@unchecked Sendable`). After `authorize` returns,
the native callback reads `tokenType` from the handler and submits it with
the token; set it to the token type your provider returns (the built-in
Google handler uses `id_token`).

`IdpClient` carries `clientId`, `redirectUri`, `scopes`, `nonce`, and
`continueUrl`. `redirectUri` is the value the Journey callback supplies,
except when a non-empty `redirectUri` was configured in
`createExternalIdpClient`: your handler then receives the configured value,
so the provider login can return to the app's registered scheme. The handler
returns `IdpResult(token, additionalParameters)`;
the token is submitted back to the server by the callback itself. Everything
placed in `additionalParameters` is server-visible: the entries are replayed
as request parameters when the callback is submitted, so never place session
state or secrets there.

Because the login flow is entirely provider-specific, you write the body of
`authorize` yourself: launch the provider's login UI (typically through its
own SDK, configured with `idpClient.scopes` and `idpClient.nonce`), obtain
the token, and return it in an `IdpResult`. Declare the class wherever your
app's native code lives, for example next to your `Application`/`AppDelegate`
subclass. The registration step below then wires it up; the handler-contract
section (section 3) covers the platform rules your implementation must
follow, including threading and cancellation.

### 2. Register at startup

Register the handler once, before React boots. After a JS reload the
registration survives; it must not be repeated on every activity or scene
lifecycle event.

**Android:** add the registration to your `MainApplication.onCreate()`,
before `loadReactNative(this)`:

```kotlin
import com.pingidentity.rnexternalidp.RNPingExternalIdpCommon

class MainApplication : Application(), ReactApplication {
  // ... your existing reactNativeHost / reactHost overrides ...

  override fun onCreate() {
    super.onCreate()
    // A thrown registration error (blank or reserved name) is a programming
    // error; fail at startup rather than at first login.
    RNPingExternalIdpCommon.registerIdpHandler("line", LineIdpHandler())
    loadReactNative(this)
  }
}
```

Implementing `com.pingidentity.idp.IdpHandler` in app code works because the
`rn-external-idp` Android module exposes `com.pingidentity.sdks:external-idp`
at `api` scope, so its `com.pingidentity.idp.*` types resolve from app code
without a separate dependency.

**iOS:** add the registration to your `AppDelegate.didFinishLaunchingWithOptions`,
before the React factory starts:

```swift
import RNPingExternalIdp

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // A thrown registration error (blank or reserved name) is a programming
    // error; fail at startup rather than at first login.
    try! RNPingExternalIdpCommon.registerIdpHandler("line", handler: LineIdpHandler())

    // ... the rest of the React Native template body (delegate, factory,
    // window, startReactNative) stays unchanged ...
    return true
  }
}
```

The snippet is abbreviated: keep your app's existing `AppDelegate` and only
add the two imports and the `try!` line before the React factory is created.
For the complete method body see `PingSampleApp/ios/PingSampleApp/AppDelegate.swift`
in the SDK repository.

The AppDelegate needs `import RNPingExternalIdp` for the registration entry
point; the file implementing the `IdpHandler` protocol also needs
`import PingExternalIdP`. Both modules resolve without extra Podfile entries:
`PingExternalIdP` is available transitively through the `RNPingExternalIdp`
pod, so no `PingExternalIdP` Podfile entry is needed (provider pods such as
`PingExternalIdPGoogle` are only required for the built-in providers, as
described in [iOS native configuration](#ios-native-configuration)).

### 3. Handler contract

- **Resolution order:** the Journey callback's provider value resolves
  through the registry first (exact match on the trimmed lowercase name),
  then the built-ins (apple, google, facebook, plus siwa and fb-limited on
  iOS), then the existing
  unsupported-provider error (`EXTERNAL_IDP_CONFIG_ERROR` on Android,
  `EXTERNAL_IDP_UNSUPPORTED_PROVIDER` on iOS).
- **Reserved names:** registration rejects any name that contains a built-in
  token (`apple`, `siwa`, `google`, `facebook`, `fb-limited`), matched
  case-insensitively as a substring, mirroring how the built-ins route
  provider names. Names like `pineapple-sso` or `my-google` are rejected
  because they would route to a built-in at authorize time. `fb-limited` is
  reserved on both platforms so registrations stay symmetric across them.
  Android throws `IllegalArgumentException`; iOS throws
  `IdpHandlerRegistrationError.reservedProvider`.
- **Nonce:** pass `idpClient.nonce` to the provider login. It is required for
  AIC token validation, which fails server-side without it.
- **Cancellation:** on Android, throw
  `com.pingidentity.idp.IdpCanceledException` on user cancel so it surfaces
  as `EXTERNAL_IDP_CANCELLED`. On iOS a custom handler's cancellation is
  indistinguishable from a failure: the native catch-all wraps every handler
  error, which surfaces as `EXTERNAL_IDP_AUTHORIZE_ERROR`.
- **Threading:** on Android the handler's `suspend authorize` body runs on
  the main dispatcher; dispatch provider I/O off it, for example with
  `withContext(Dispatchers.IO)`. On iOS the handler requirement is
  nonisolated, so the body runs on the global executor, not the main thread;
  wrap UI-touching code in `MainActor.run { }` when the main thread is
  needed (a `@MainActor` handler type cannot satisfy the nonisolated
  `tokenType` requirement without `@preconcurrency IdpHandler`). On both platforms
  never log the token or the nonce.

---

## DaVinci usage

DaVinci flows represent each social login option as an `IdpCollector` with `type: socialLoginCollectorType` (`'SOCIAL_LOGIN_BUTTON'`). Unlike Journey, there is no `SelectIdpCallback` — each provider has its own button. The token flows through `daVinci.next()` via a `RequestInterceptor` inside the native SDK; `authorizeForDaVinci` returns `void`, not a token.

Install the DaVinci module alongside this package:

```bash
yarn add @ping-identity/rn-davinci
```

Create the External IdP client before the first DaVinci operation. The client registers
`socialLoginCollectorType` with the generic form planner, and the native External IdP
module must be linked and initialized before DaVinci maps the first node so its serializer
can provide the stable `idpId` key and provider metadata.

```ts
const externalIdp = createExternalIdpClient({
  redirectUri: 'com.example.app://callback',
});

const daVinci = createDaVinciClient({
  modules: {
    oidc: {
      /* ... */
    },
  },
});

await daVinci.start();
```

Do not start the DaVinci flow before the External IdP integration is initialized. If the
native External IdP package is not linked, social collectors may be surfaced only through
the generic unsupported/integration path and cannot be authorized.

### Handle `IdpCollector` — authorize with an external provider

Call `authorizeForDaVinci` when a DaVinci `ContinueNode` contains an `IdpCollector`. After the promise resolves, call `daVinci.next({ collectors: [] })` to advance the flow.

```ts
try {
  await externalIdp.authorizeForDaVinci(daVinci, {
    // index: 0  // Use when there are multiple IdpCollectors in one node
  });
  await daVinci.next({ collectors: [] });
} catch (error) {
  // See Errors section
}
```

### With `useDaVinciForm`

Pass `handledCollectorTypes` so IDP collectors are excluded from blocking submit issues:

```ts
import { useDaVinci, useDaVinciForm } from '@ping-identity/rn-davinci';
import { socialLoginCollectorType } from '@ping-identity/rn-external-idp';

const { node, next } = useDaVinci(daVinciClient);
const form = useDaVinciForm(node, {
  handledCollectorTypes: new Set([socialLoginCollectorType]),
});

// When the user taps a social login button:
await externalIdp.authorizeForDaVinci(daVinciClient);
await next({ collectors: [] });
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
  DaVinciInstance,
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

  authorizeForDaVinci(
    daVinci: DaVinciInstance,
    options?: ExternalIdpAuthorizeOptions,
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

- **AIC with Journey orchestration is native-only; there is no browser fallback**, except for Apple Sign-In on Android. Native provider SDKs must be linked for each target platform: Google or Facebook on Android, and Google, Facebook, or Apple on iOS. When the required native provider SDK is absent, `authorizeForJourney` rejects with `EXTERNAL_IDP_UNSUPPORTED_PROVIDER` — the sole exception is Apple Sign-In on Android, which has no native SDK and always uses the browser.

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details
