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
yarn add @ping-identity/rn-storage
yarn add @ping-identity/rn-logger
```

## How to Use the SDK

### Step 1: Create a minimal client

Use this baseline configuration first.

```ts
import { createJourneyClient } from '@ping-identity/rn-journey';

const client = createJourneyClient({
  serverUrl: 'https://example.com/am',
  realm: 'alpha',
  cookie: 'iPlanetDirectoryPro',
  timeout: 30000
});
```

### Step 2: Add OIDC module (with optional storage)

Add `modules.oidc` when your Journey flow needs OIDC token/session operations (for example
`user()`, `refresh()`, `userinfo()`, and `revoke()`).

Storage inside `modules.oidc.storage` and `modules.session.storage` is optional. Configure it only
if you need native-backed persistence; otherwise omit storage values.

```ts
import { createJourneyClient } from '@ping-identity/rn-journey';
import {
  CacheStrategy,
  configureOidcStorage,
  configureSessionStorage,
} from '@ping-identity/rn-storage';

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

Pass optional integrations through `config.modules`. The JS API is `createJourneyClient(config)`.
When provided, storage handles in `modules.session.storage` and `modules.oidc.storage` must come
from `configureSessionStorage(...)` / `configureOidcStorage(...)`.

### Step 3: Add logging integration (optional)

If you install the logger package, pass a JS logger instance created via
`@ping-identity/rn-logger`.
If the logger package is not installed/configured, do not pass logger values in Journey config.

```ts
import { createJourneyClient } from '@ping-identity/rn-journey';
import { logger } from '@ping-identity/rn-logger';

const jsLogger = logger({ level: 'debug' });

const client = createJourneyClient({
  serverUrl: 'https://example.com/am',
  logger: jsLogger,
  modules: {
    oidc: {
      clientId: 'rn-client',
      discoveryEndpoint: 'https://example.com/am/oauth2/alpha/.well-known/openid-configuration',
      redirectUri: 'com.example.app://callback',
      scopes: ['openid'],
    },
  },
});
```

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

`useJourney` auto-advances `PollingWaitCallback` nodes when no manual or blocking integration callbacks are present.

Start options are supported when initiating a journey:

```ts
const node = await client.start('Login', {
  forceAuth: true,
  noSession: true,
});
```

Handle node states explicitly in your UI flow:

```ts
const node = await client.start('Login');

switch (node.type) {
  case 'ContinueNode':
    await client.next({
      callbacks: [{ type: 'NameCallback', value: 'demo-user' }],
    });
    break;
  case 'ErrorNode':
    console.log(node.message);
    break;
  case 'FailureNode':
    console.log(node.cause ?? node.message);
    break;
  case 'SuccessNode':
    console.log('Authenticated');
    break;
}
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

const usernameField = form.getFieldByType(callbackType.NameCallback);
const passwordField = form.getFieldByType(callbackType.PasswordCallback);

form.setValueByType(callbackType.NameCallback, 'demo-user');
form.setValueByType(callbackType.PasswordCallback, 'demo-password');

if (form.canSubmit) {
  await actions.next(form.input);
}
```

`useJourneyForm` is headless. It manages normalized fields and submit planning, but does not render UI and does not auto-run integration-required callbacks.

> TODO(test-runner app): add Journey integration and E2E tests (including `SuspendedTextOutputCallback` deep link/email resume flow) once the test-runner app is set up.

### Core callback support

The following AM core callbacks are supported on Android and iOS:

| Callback Type | Description | Input Handling |
| --- | --- | --- |
| `BooleanAttributeInputCallback` | Collects true or false input. | Manual input |
| `ChoiceCallback` | Collects a single selection from available choices. | Manual input |
| `ConfirmationCallback` | Collects one selected option from a list. | Manual input |
| `ConsentMappingCallback` | Prompts the user to consent to sharing profile data. | Manual input |
| `HiddenValueCallback` | Carries non-visual form values. | Manual input |
| `KbaCreateCallback` | Collects knowledge-based question and answer values. | Manual input |
| `MetadataCallback` | Injects key-value metadata into the flow. | Output-only |
| `NameCallback` | Collects a username. | Manual input |
| `NumberAttributeInputCallback` | Collects a numeric value. | Manual input |
| `PasswordCallback` | Collects a password or OTP value. | Manual input |
| `PollingWaitCallback` | Instructs the client to wait and resubmit later. | Output-only |
| `StringAttributeInputCallback` | Collects string attribute values. | Manual input |
| `SuspendedTextOutputCallback` | Pauses flow and resumes through external callback/deep link. | Output-only |
| `TermsAndConditionsCallback` | Collects acceptance of configured terms and conditions. | Manual input |
| `TextInputCallback` | Collects arbitrary text input. | Manual input |
| `TextOutputCallback` | Provides display-only message content. | Output-only |
| `ValidatedCreatePasswordCallback` | Collects password input with policy validation. | Manual input |
| `ValidatedCreateUsernameCallback` | Collects username input with policy validation. | Manual input |

Integration-dependent families (for example, device profile, FIDO/FIDO2, PingOne Protect, redirect/IdP, and ReCaptcha callbacks) are surfaced in node payloads and require client-side integration before submission.

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
