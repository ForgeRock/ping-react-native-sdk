<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Journey

This module exposes native-backed Journey clients for Android and iOS.

## Integrating the SDK into your project

Add the package and let autolinking wire the native code:

```bash
yarn add @ping-identity/rn-journey
cd ios && pod install
```

Optional integration packages:

```bash
yarn add @react-native-pingidentity/storage
yarn add @react-native-pingidentity/logger
```

## How to Use the SDK

### Create a Journey client

```ts
import { createJourneyClient } from '@ping-identity/rn-journey';
import {
  CacheStrategy,
  configureOidcStorage,
  configureSessionStorage,
} from '@react-native-pingidentity/storage';

const sessionStorage = configureSessionStorage({
  android: {
    fileName: 'journey-session',
    keyAlias: 'journey-session',
    strongBoxPreferred: true,
    cacheStrategy: 'cache_on_failure',
  },
  ios: {
    account: 'com.example.app.session',
    encryptor: true,
    cacheable: false,
  },
});

const oidcStorage = configureOidcStorage({
  android: {
    fileName: 'journey-oidc',
    keyAlias: 'journey-oidc',
    strongBoxPreferred: true,
    cacheStrategy: CacheStrategy.CACHE_ON_FAILURE,
  },
  ios: {
    account: 'com.example.app.oidc',
    encryptor: true,
    cacheable: false,
  },
});

const client = createJourneyClient({
  serverUrl: 'https://example.com/am',
  realm: 'alpha',
  cookie: 'iPlanetDirectoryPro',
  timeout: 30000,
  modules: {
    oidc: {
      clientId: 'rn-client',
      discoveryEndpoint: 'https://example.com/am/oauth2/alpha/.well-known/openid-configuration',
      redirectUri: 'com.example.app://callback',
      scopes: ['openid', 'profile', 'email'],
      storage: oidcStorage,
    },
    session: {
      storage: sessionStorage,
    },
  },
});
```

Pass module integrations through `config.modules`. The JS API is `createJourneyClient(config)`.
Storage handles in `modules.session.storage` and `modules.oidc.storage` must come from
`configureSessionStorage(...)` / `configureOidcStorage(...)`.

### Configure logging (optional)

If you install the logger package, pass either a JS logger instance or a native logger handle.

```ts
import { createJourneyClient } from '@ping-identity/rn-journey';
import { logger, configureLogger } from '@react-native-pingidentity/logger';

const jsLogger = logger({ level: 'debug' });
const nativeLogger = configureLogger({ level: 'warn' });

const client = createJourneyClient({
  serverUrl: 'https://example.com/am',
  logger: jsLogger,
  modules: {
    oidc: {
      clientId: 'rn-client',
      discoveryEndpoint: 'https://example.com/am/oauth2/alpha/.well-known/openid-configuration',
      redirectUri: 'com.example.app://callback',
      scopes: ['openid'],
      nativeLogger,
    },
  },
});
```

> TODO(iOS SDK parity): `modules.oidc.signOutRedirectUri` is currently ignored on iOS.

### Drive the Journey imperatively

```ts
const firstNode = await client.start('Login');
const nextNode = await client.next({
  callbacks: [
    { type: 'NameCallback', value: 'demo-user' },
    { type: 'PasswordCallback', value: 'demo-password' },
  ],
});
const resumedNode = await client.resume('com.example.app://callback?code=123');
const session = await client.user();
const refreshedSession = await client.refresh();
const userInfo = await client.userinfo();
const ssoToken = await client.ssoToken();
await client.revoke();
await client.logoutUser();
await client.dispose();
```

### Post Authentication Operations

After a Journey login succeeds, use the following operations to inspect and manage the active user session:

```ts
const userSession = await client.user();
const ssoToken = await client.ssoToken();

if (userSession) {
  const refreshedSession = await client.refresh();
  const userInfo = await client.userinfo();
  await client.revoke();
}

await client.logoutUser();
```

- `user()` returns token/session payload (`accessToken`, optional `refreshToken`, `expiresIn`, optional `userInfo`).
- `ssoToken()` returns Journey SSO session payload (`value`, `successUrl`, `realm`) when available.
- `refresh()` refreshes token payload for the active user.
- `userinfo()` fetches user claims for the active user.
- `revoke()` revokes access/refresh tokens for the active user.
- `logoutUser()` signs out and clears the active Journey user session.

### Use the React hook

```ts
import { useJourney } from '@ping-identity/rn-journey';

const [node, actions] = useJourney(client);

await actions.start('Login');

if (node?.type === 'ContinueNode') {
  await actions.next({
    callbacks: [{ type: 'NameCallback', value: 'demo-user' }],
  });
}
```

### Share Journey state across multiple screens (optional)

```tsx
import { JourneyProvider, useJourney } from '@ping-identity/rn-journey';

function App(): React.ReactElement {
  return (
    <JourneyProvider client={client}>
      <AuthNavigator />
    </JourneyProvider>
  );
}

function LoginScreen(): React.ReactElement {
  const [node, actions] = useJourney();
  return <></>;
}
```

### Render callbacks with `useJourneyForm`

```ts
import { callbackType } from '@ping-identity/rn-types';
import { useJourney, useJourneyForm } from '@ping-identity/rn-journey';

const [node, actions] = useJourney(client);
const form = useJourneyForm(node);

const usernameField = form.fields.find((field) => field.ref.type === callbackType.NameCallback);
const passwordField = form.fields.find((field) => field.ref.type === callbackType.PasswordCallback);

if (usernameField) {
  form.setValue(usernameField.id, 'demo-user');
}
if (passwordField) {
  form.setValue(passwordField.id, 'demo-password');
}

if (form.canSubmit) {
  await actions.next(form.input);
}
```

`useJourneyForm` is headless. It manages normalized fields and submit planning, but does not render UI and does not auto-run integration-required callbacks.

### Use low-level callback helpers directly (optional)

```ts
import { buildNextInput, normalizeCallbacks } from '@ping-identity/rn-journey';

const fields = normalizeCallbacks(node);
const values = {
  [fields[0].id]: 'demo-user',
};

const plan = buildNextInput(node, values);
if (plan.canSubmit) {
  await actions.next(plan.input);
}
```

### Core callback support

The following AM core callbacks are supported on Android and iOS:

- `BooleanAttributeInputCallback`
- `ChoiceCallback`
- `ConfirmationCallback`
- `ConsentMappingCallback`
- `HiddenValueCallback`
- `KbaCreateCallback`
- `MetadataCallback` (output-only)
- `NameCallback`
- `NumberAttributeInputCallback`
- `PasswordCallback`
- `PollingWaitCallback` (output-only)
- `StringAttributeInputCallback`
- `SuspendedTextOutputCallback` (output-only)
- `TermsAndConditionsCallback`
- `TextInputCallback`
- `TextOutputCallback` (output-only)
- `ValidatedCreatePasswordCallback`
- `ValidatedCreateUsernameCallback`

Integration-dependent families (for example, device profile, FIDO/FIDO2, PingOne Protect, redirect/IdP, and ReCaptcha callbacks) are surfaced in node payloads and require client-side integration before submission.

## Android redirect configuration

If Journey uses OIDC redirects, configure the app redirect scheme. For a redirect URI of
`com.example.app://callback`, add the manifest placeholder:

```gradle
android {
  defaultConfig {
    manifestPlaceholders["appRedirectUriScheme"] = "com.example.app"
  }
}
```

Add the redirect intent filter to `CustomTabActivity`:

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

## Error handling

All promise rejections use the shared `GenericError` contract from `@ping-identity/rn-types`.

```ts
import type { JourneyError } from '@ping-identity/rn-journey';

try {
  await client.start('Login');
} catch (error) {
  const journeyError = error as JourneyError;
  console.log(journeyError.type, journeyError.error, journeyError.message);
}
```

Stable Journey error codes:

- `JOURNEY_CONFIG_ERROR`
- `JOURNEY_INIT_ERROR`
- `JOURNEY_START_ERROR`
- `JOURNEY_NEXT_ERROR`
- `JOURNEY_RESUME_ERROR`
- `JOURNEY_USER_ERROR`
- `JOURNEY_LOGOUT_ERROR`
- `JOURNEY_DISPOSE_ERROR`
- `JOURNEY_STATE_ERROR`
- `JOURNEY_CALLBACK_APPLY_ERROR`
- `JOURNEY_UNSUPPORTED_CALLBACK_ERROR`
- `JOURNEY_MISSING_INTEGRATION_ERROR`
