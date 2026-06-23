<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native DaVinci

## Overview

This module provides native-backed [PingOne DaVinci](https://docs.pingidentity.com/davinci/davinci_introduction.html) orchestration for React Native on Android and iOS. DaVinci is a flexible authentication and authorization library that drives server-defined flows through a simple node-based API. Your app calls `start()` to launch a flow, receives a node describing the current step, gathers the required input, and calls `next()` to advance — repeating until the flow reaches a terminal `SuccessNode`, `ErrorNode`, or `FailureNode`.

## Integrating the SDK into your project

> **Note:** This module requires that the `@ping-identity/rn-core` module is already set up and installed.

```bash
# Install & setup the core module
yarn add @ping-identity/rn-core
# Install the rn-davinci module
yarn add @ping-identity/rn-davinci
# If you are developing your app using iOS, run this command
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
import { createDaVinciClient } from '@ping-identity/rn-davinci';

const client = createDaVinciClient({
  modules: {
    oidc: {
      clientId: 'rn-client',
      discoveryEndpoint:
        'https://auth.pingone.com/<env-id>/as/.well-known/openid-configuration',
      redirectUri: 'com.example.app://callback',
    },
  },
});
```

### Step 2: Add optional storage

Add `modules.oidc.storage` when you need native-backed OIDC token persistence.
Configure it only if you need persistent token storage; otherwise omit storage values.

```ts
import { createDaVinciClient } from '@ping-identity/rn-davinci';
import { CacheStrategy, configureOidcStorage } from '@ping-identity/rn-storage';

const oidcStorage = configureOidcStorage({
  android: {
    fileName: 'davinci-oidc',
    keyAlias: 'davinci-oidc',
    strongBoxPreferred: true,
    cacheStrategy: CacheStrategy.CACHE_ON_FAILURE,
  },
  ios: {
    account: 'com.example.app.oidc',
    encryptor: true,
    cacheable: false,
  },
});

const client = createDaVinciClient({
  timeout: 30000,
  modules: {
    oidc: {
      clientId: 'rn-client',
      discoveryEndpoint:
        'https://auth.pingone.com/<env-id>/as/.well-known/openid-configuration',
      redirectUri: 'com.example.app://callback',
      scopes: ['openid', 'profile', 'email'],
      storage: oidcStorage,
    },
  },
});
```

Pass optional integrations through `config.modules`. The JS API is `createDaVinciClient(config)`.
When provided, the storage handle in `modules.oidc.storage` must come from
`configureOidcStorage(...)`.

### Step 3: Add logging integration (optional)

If you install the logger package, pass a JS logger instance created via
`@ping-identity/rn-logger`.
If the logger package is not installed/configured, do not pass logger values in DaVinci config.

```ts
import { createDaVinciClient } from '@ping-identity/rn-davinci';
import { logger } from '@ping-identity/rn-logger';

const jsLogger = logger({ level: 'debug' });

const client = createDaVinciClient({
  logger: jsLogger,
  modules: {
    oidc: {
      clientId: 'rn-client',
      discoveryEndpoint:
        'https://auth.pingone.com/<env-id>/as/.well-known/openid-configuration',
      redirectUri: 'com.example.app://callback',
      scopes: ['openid'],
    },
  },
});
```

### Drive the DaVinci flow imperatively

```ts
const firstNode = await client.start();
const nextNode = await client.next({
  collectors: [
    { key: 'user', value: 'demo-user' },
    { key: 'password', value: 'demo-password' },
  ],
});
const session = await client.user();
const refreshedSession = await client.refresh();
const userInfo = await client.userinfo();
await client.revoke();
await client.logoutUser();
await client.dispose();
```

Handle node states explicitly in your UI flow:

```ts
const node = await client.start();

switch (node.type) {
  case 'ContinueNode':
    await client.next({
      collectors: [{ key: 'user', value: 'demo-user' }],
    });
    break;
  case 'ErrorNode':
    console.log(node.message);
    break;
  case 'FailureNode':
    console.log(node.cause ?? node.message);
    break;
  case 'SuccessNode':
    console.log('Authenticated — session:', node.session.value);
    break;
}
```

### Post Authentication Operations

After a DaVinci flow completes successfully, use the following operations to inspect and manage the active user session:

```ts
const userSession = await client.user();

if (userSession) {
  const refreshedSession = await client.refresh();
  const userInfo = await client.userinfo();
  await client.revoke();
}

await client.logoutUser();
```

- `user()` returns token payload (`accessToken`, optional `refreshToken`, optional `expiresIn`).
- `refresh()` refreshes token payload for the active user.
- `userinfo()` fetches user claims for the active user.
- `revoke()` revokes access/refresh tokens for the active user.
- `logoutUser()` signs out and clears the active DaVinci user session.

### Use the React hook

`useDaVinci` does not auto-advance nodes. Progression policy is app-controlled via explicit `next(...)` calls.

```ts
import { useDaVinci } from '@ping-identity/rn-davinci';

const { node, start, next, loading, error } = useDaVinci(client);

await start();

if (node?.type === 'ContinueNode') {
  await next({
    collectors: [{ key: 'user', value: 'demo-user' }],
  });
}
```

### Share DaVinci state across multiple screens (optional)

```tsx
import { DaVinciProvider, useDaVinci } from '@ping-identity/rn-davinci';

function App(): React.ReactElement {
  return (
    <DaVinciProvider config={config}>
      <AuthNavigator />
    </DaVinciProvider>
  );
}

function LoginScreen(): React.ReactElement {
  const { node, start, next, loading } = useDaVinci();

  if (!node) {
    return <Button title="Sign In" onPress={start} />;
  }

  if (node.type === 'SuccessNode') {
    return <Text>Authenticated</Text>;
  }

  if (node.type === 'ContinueNode') {
    return <DaVinciForm node={node} onNext={next} loading={loading} />;
  }

  return <Text>{node.message}</Text>;
}
```

### Render collectors with `useDaVinciForm`

```ts
import { useDaVinci, useDaVinciForm } from '@ping-identity/rn-davinci';

const { node, next } = useDaVinci(client);
const form = useDaVinciForm(node);

form.setValueByType('TEXT', 'demo-user');
form.setValueByType('PASSWORD', 'demo-password');

if (form.canSubmit) {
  await next(form.input);
}
```

`useDaVinciForm` is headless. It manages normalized collectors and submit planning, but does not render UI and does not auto-run collectors.

Each normalized collector includes `executionMode` and `requiresUserInput`.

| `executionMode`        | Meaning                                                                                  | `requiresUserInput` default |
| ---------------------- | ---------------------------------------------------------------------------------------- | --------------------------- |
| `manual`               | Collector value is submitted from form/planned input.                                    | `true`                      |
| `immediate`            | Activating the collector immediately advances the flow without waiting for other fields. | `false`                     |
| `output_only`          | Display/label collector, no input value expected.                                        | `false`                     |
| `integration_required` | Collector is handled by an external integration package before submit.                   | `false`                     |
| `unsupported`          | Collector type is not currently handled by the bridge or any registered integration.     | `false`                     |

#### Flow collector submission

`FLOW_BUTTON`, `FLOW_LINK`, and `ACTION` collectors bypass other form fields and immediately advance the flow. Use `submitFlow(key)` inside a `DaVinciProvider` tree:

```ts
const form = useDaVinciForm(node);

// Activates "Forgot Password" flow link directly — no other field values are included.
await form.submitFlow('forgot-password');
```

### Core collector support

The following collector types are supported on Android and iOS:

| Collector Type          | Description                                       | Input Handling |
| ----------------------- | ------------------------------------------------- | -------------- |
| `TEXT`                  | Single-line text input.                           | Manual input   |
| `PASSWORD`              | Masked password input.                            | Manual input   |
| `PASSWORD_VERIFY`       | Password-confirmation variant of `PASSWORD`.      | Manual input   |
| `SINGLE_SELECT`         | Single-select input.                              | Manual input   |
| `DROPDOWN`              | Single-select dropdown.                           | Manual input   |
| `RADIO`                 | Single-select radio group.                        | Manual input   |
| `MULTI_SELECT`          | Multi-select input.                               | Manual input   |
| `COMBOBOX`              | Multi-select combobox.                            | Manual input   |
| `CHECKBOX`              | Multi-select checkbox group.                      | Manual input   |
| `PHONE_NUMBER`          | Phone number input with country code.             | Manual input   |
| `DEVICE_REGISTRATION`   | Device picker for registration.                   | Manual input   |
| `DEVICE_AUTHENTICATION` | Device picker for authentication.                 | Manual input   |
| `SUBMIT_BUTTON`         | Triggers form submission immediately.             | Immediate      |
| `ACTION`                | Action button that advances the flow immediately. | Immediate      |
| `FLOW_BUTTON`           | Flow button that advances the flow immediately.   | Immediate      |
| `FLOW_LINK`             | Flow link that advances the flow immediately.     | Immediate      |
| `LABEL`                 | Read-only display content.                        | Output-only    |

Integration-dependent collectors (for example, social IdP, FIDO, or PingOne Protect) are
surfaced in node payloads and require client-side integration before submission
(`executionMode: 'integration_required'`).

### Unsupported fields

When the native SDK cannot instantiate a collector from the server payload, the bridge surfaces it in `ContinueNode.unsupportedFields`:

```ts
if (node.type === 'ContinueNode' && node.unsupportedFields?.length) {
  console.warn('Unsupported fields present:', node.unsupportedFields);
}
```

Each entry has `key` and `type` so the UI can render a placeholder or block submission.

## Error handling

All promise rejections throw a `DaVinciError` instance, which extends `PingError extends Error`.
Use `instanceof` to narrow the error type:

```ts
import { DaVinciError } from '@ping-identity/rn-davinci';

try {
  await client.start();
} catch (err) {
  if (err instanceof DaVinciError) {
    console.log(err.code, err.type, err.message);
  }
}
```

Stable DaVinci error codes:

- `DAVINCI_CONFIG_ERROR`
- `DAVINCI_START_ERROR`
- `DAVINCI_NEXT_ERROR`
- `DAVINCI_COLLECTOR_APPLY_ERROR`
- `DAVINCI_SESSION_ERROR`
- `DAVINCI_LOGOUT_ERROR`
- `DAVINCI_DISPOSE_ERROR`
- `DAVINCI_ARGUMENT_ERROR`
- `DAVINCI_STATE_ERROR`
- `DAVINCI_MISSING_INTEGRATION_ERROR`
- `DAVINCI_UNKNOWN_ERROR`

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details
