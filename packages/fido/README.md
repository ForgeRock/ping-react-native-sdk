<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native FIDO

This package provides a native-backed FIDO bridge for React Native.

## Table of contents

- [Install](#install)
- [FIDO prerequisites](#fido-prerequisites)
- [Client-first usage](#client-first-usage)
- [Journey integration](#journey-integration)
- [`useJourneyForm` integration](#usejourneyform-integration)
- [API reference](#api-reference)
- [Errors](#errors)
- [Platform notes](#platform-notes)
- [License](#license)

## Install

> **Note:** This module requires that the `@ping-identity/rn-core` module is already set up and installed.

```bash
# Install & setup the core module
yarn add @ping-identity/rn-core
# Install the rn-fido module
yarn add @ping-identity/rn-fido
# If you are developing your app using iOS, run this command
cd ios && pod install
```

Optional integration packages:

```bash
yarn add @ping-identity/rn-logger
```

## FIDO prerequisites

### Android

- Host Digital Asset Links at `https://<rp-domain>/.well-known/assetlinks.json`.
- Ensure `assetlinks.json` contains your Android package name and signing cert fingerprint(s).
- Configure Android origin domains for FIDO on your RP/server.
- If you support Android API 33 and older, explicitly include `androidx.credentials:credentials-play-services-auth`.
- If you need non-discoverable credentials / legacy security-key support, explicitly include `com.google.android.gms:play-services-fido`.

### iOS

- Enable Associated Domains entitlement.
- Add associated domain entries (for example `webcredentials:<rp-domain>`).
- Host Apple App Site Association at `https://<rp-domain>/.well-known/apple-app-site-association`.
- Ensure AASA contains your Apple Team ID and Bundle ID mapping.

## Client-first usage

Use `createFidoClient(config?)` and call operations on the returned client.

```ts
import { createFidoClient } from '@ping-identity/rn-fido';
import { logger } from '@ping-identity/rn-logger';

const log = logger({ level: 'debug' });

const fido = createFidoClient({
  logger: log,
  android: {
    useFido2Client: true,
  },
});

const registrationResult = await fido.register({
  challenge: 'base64url-challenge',
  rp: { id: 'example.com', name: 'Example Inc.' },
  user: {
    id: 'base64url-user-id',
    name: 'user@example.com',
    displayName: 'Example User',
  },
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
});

const authenticationResult = await fido.authenticate({
  challenge: 'base64url-challenge',
  rpId: 'example.com',
  allowCredentials: [],
});
```

### Logging integration (optional)

If you install the logger package, pass a JS logger instance created via
`@ping-identity/rn-logger`.
If the logger package is not installed/configured, do not pass logger values in FIDO config.
JavaScript-side FIDO logs use this logger on both platforms.
Native logger forwarding currently applies on Android; iOS native forwarding is a no-op.

```ts
import { createFidoClient } from '@ping-identity/rn-fido';
import { logger } from '@ping-identity/rn-logger';

const jsLogger = logger({ level: 'debug' });

const fido = createFidoClient({
  logger: jsLogger,
});
```

### Multi-client example

```ts
import { createFidoClient } from '@ping-identity/rn-fido';

const fidoA = createFidoClient({
  android: { useFido2Client: true },
});

const fidoB = createFidoClient({
  android: { useFido2Client: false },
});

await fidoA.register({ challenge: '...' });
await fidoB.authenticate({ challenge: '...' });
```

## Journey integration

Run Journey FIDO callbacks explicitly before `journey.next(...)`.

```ts
import { createFidoClient } from '@ping-identity/rn-fido';

const fido = createFidoClient();

if (node.type === 'ContinueNode') {
  for (const callback of node.callbacks ?? []) {
    if (callback.type === 'FidoRegistrationCallback') {
      await fido.registerForJourney(journey, {
        index: 0,
        deviceName: 'My Device',
      });
    }

    if (callback.type === 'FidoAuthenticationCallback') {
      await fido.authenticateForJourney(journey, { index: 0 });
    }
  }

  await journey.next({});
}
```

## `useJourneyForm` integration

When using `useJourneyForm`, pass `handledCallbackTypes` so FIDO fields are excluded from
blocking submit issues. Run each integration, then submit when `form.canSubmit` is true.

```ts
import { useJourney, useJourneyForm } from '@ping-identity/rn-journey';
import { createFidoClient } from '@ping-identity/rn-fido';
import { nativeExtensionCallbackType } from '@ping-identity/rn-types';

const [node, actions] = useJourney(client);
const form = useJourneyForm(node, {
  handledCallbackTypes: new Set([
    nativeExtensionCallbackType.FidoRegistrationCallback,
    nativeExtensionCallbackType.FidoAuthenticationCallback,
  ]),
});
const fido = createFidoClient();

for (const field of form.fields) {
  if (field.ref.type === nativeExtensionCallbackType.FidoRegistrationCallback) {
    await fido.registerForJourney(journey, { index: field.ref.typeIndex });
  }
  if (
    field.ref.type === nativeExtensionCallbackType.FidoAuthenticationCallback
  ) {
    await fido.authenticateForJourney(journey, { index: field.ref.typeIndex });
  }
}

if (form.canSubmit) {
  await actions.next(form.input);
}
```

## API reference

```ts
import { createFidoClient } from '@ping-identity/rn-fido';
import type {
  FidoClient,
  FidoConfig,
  FidoRegistrationOptions,
  FidoRegistrationResult,
  FidoAuthenticationOptions,
  FidoAuthenticationResult,
  FidoJourneyRegistrationOptions,
  FidoJourneyAuthenticationOptions,
  FidoJourneyResult,
  JourneyInstance,
} from '@ping-identity/rn-fido';

function createFidoClient(config?: FidoConfig): FidoClient;

interface FidoClient {
  register(options: FidoRegistrationOptions): Promise<FidoRegistrationResult>;
  authenticate(
    options: FidoAuthenticationOptions,
  ): Promise<FidoAuthenticationResult>;
  registerForJourney(
    journey: JourneyInstance,
    options?: FidoJourneyRegistrationOptions,
  ): Promise<FidoJourneyResult>;
  authenticateForJourney(
    journey: JourneyInstance,
    options?: FidoJourneyAuthenticationOptions,
  ): Promise<FidoJourneyResult>;
}
```

## Errors

Rejected promises throw a `FidoError` instance, which extends `PingError extends Error`. Use `instanceof FidoError` to narrow in catch blocks.

Stable error codes:

- `FIDO_ERROR`
- `FIDO_REGISTER_ERROR`
- `FIDO_AUTHENTICATE_ERROR`
- `FIDO_AUTHENTICATE_CANCELLED`
- `FIDO_ACTIVITY_UNAVAILABLE` (Android)
- `FIDO_WINDOW_UNAVAILABLE` (iOS)
- `FIDO_CALLBACK_NOT_FOUND`

## Platform notes

- `android.useFido2Client` is an Android-only override.
  - `undefined` (default): native SDK auto-detection/default behavior.
  - `true`: force Google Play Services FIDO2 APIs.
  - `false`: force Android Credential Manager APIs.
- iOS accepts the same config shape for API parity, but does not currently apply native client-level config.
- Journey callback execution currently follows native SDK behavior; Android Journey callback APIs do not currently accept injected custom native `FidoClient` configuration.
- Android requires a foreground `Activity` for FIDO calls.
- iOS requires an active `UIWindowScene`/`ASPresentationAnchor` for FIDO calls.

## E2E testing note

Full passkey E2E strategy (including OS-level credential surfaces outside app UI) is still to be determined.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details
