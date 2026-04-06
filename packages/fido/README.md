<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native FIDO

This module provides a native-backed WebAuthn/FIDO bridge for React Native.

## Table of contents

- [Integrating the SDK into your project](#integrating-the-sdk-into-your-project)
- [FIDO prerequisites](#fido-prerequisites)
- [How to Use the SDK](#how-to-use-the-sdk)
- [Journey integration](#journey-integration)
- [Payload model](#payload-model)
- [Error handling](#error-handling)
- [Platform caveats](#platform-caveats)
- [License](#license)

## Integrating the SDK into your project

Add the package and let autolinking wire native code:

```bash
yarn add @ping-identity/rn-fido
cd ios && pod install
```

Or using npm:

```bash
npm install @ping-identity/rn-fido
cd ios && pod install
```

## FIDO prerequisites

Before testing passkey registration or authentication, ensure your app and server are associated correctly for your RP domain.

### Android prerequisites

- Host Digital Asset Links at:
  - `https://<rp-domain>/.well-known/assetlinks.json`
- Ensure the file contains your Android package name and signing certificate fingerprint(s).
- Configure Android origin domains for FIDO on your server/RP configuration.
- If you support Android API 33 and older, include:
  - `androidx.credentials:credentials-play-services-auth`
- If you need non-discoverable credentials / legacy security-key support, include:
  - `com.google.android.gms:play-services-fido`

### iOS prerequisites

- Enable Associated Domains entitlement for your app target.
- Configure the correct associated domain entries (for example `webcredentials:<rp-domain>`).
- Host Apple App Site Association at:
  - `https://<rp-domain>/.well-known/apple-app-site-association`
- Ensure AASA contains your Apple Team ID and Bundle ID mapping.

## How to Use the SDK

### Register a credential

```ts
import { register } from "@ping-identity/rn-fido";

const registrationResult = await register({
  challenge: "base64url-challenge",
  rp: {
    id: "example.com",
    name: "Example Inc.",
  },
  user: {
    id: "base64url-user-id",
    name: "user@example.com",
    displayName: "Example User",
  },
  pubKeyCredParams: [{ type: "public-key", alg: -7 }],
});

console.log(registrationResult);
```

### Authenticate a credential

```ts
import { authenticate } from "@ping-identity/rn-fido";

const authenticationResult = await authenticate({
  challenge: "base64url-challenge",
  rpId: "example.com",
  allowCredentials: [
    {
      type: "public-key",
      id: "base64url-credential-id",
    },
  ],
});

console.log(authenticationResult);
```

### API reference

```ts
import {
  authenticate,
  authenticateForJourney,
  register,
  registerForJourney,
} from "@ping-identity/rn-fido";
import type {
  FidoAuthenticationOptions,
  FidoAuthenticationResult,
  FidoError,
  FidoErrorCode,
  FidoJourneyAuthenticationOptions,
  FidoJourneyRegistrationOptions,
  FidoJourneyResult,
  FidoRegistrationOptions,
  FidoRegistrationResult,
  JourneyInstance,
} from "@ping-identity/rn-fido";

function register(
  options: FidoRegistrationOptions,
): Promise<FidoRegistrationResult>;

function authenticate(
  options: FidoAuthenticationOptions,
): Promise<FidoAuthenticationResult>;

function registerForJourney(
  journey: JourneyInstance,
  options?: FidoJourneyRegistrationOptions,
): Promise<FidoJourneyResult>;

function authenticateForJourney(
  journey: JourneyInstance,
  options?: FidoJourneyAuthenticationOptions,
): Promise<FidoJourneyResult>;
```

## Journey integration

Use Journey-scoped APIs to run active FIDO callbacks explicitly from app code.

```ts
import {
  authenticateForJourney,
  registerForJourney,
} from "@ping-identity/rn-fido";

if (node.type === "ContinueNode") {
  for (const callback of node.callbacks ?? []) {
    if (callback.type === "FidoRegistrationCallback") {
      await registerForJourney(journey, { index: 0, deviceName: "My Device" });
    }
    if (callback.type === "FidoAuthenticationCallback") {
      await authenticateForJourney(journey, { index: 0 });
    }
  }

  await journey.next({});
}
```

### Optional: `useJourneyForm` integration

When using `@ping-identity/rn-journey` form helpers, FIDO callbacks are exposed as
`executionMode: 'integration_required'`. You can detect those fields and run
FIDO explicitly before calling `next(...)`.

```ts
import { useJourneyForm } from '@ping-identity/rn-journey';
import {
  authenticateForJourney,
  registerForJourney,
} from '@ping-identity/rn-fido';

const form = useJourneyForm(node);

for (const field of form.fields) {
  if (field.ref.type === 'FidoRegistrationCallback') {
    await registerForJourney(journey, { index: field.ref.index, deviceName: 'My Device' });
  }
  if (field.ref.type === 'FidoAuthenticationCallback') {
    await authenticateForJourney(journey, { index: field.ref.index });
  }
}

await journey.next({});
```

## Payload model

`register` and `authenticate` use dictionary-style payloads:

- `FidoRegistrationOptions` and `FidoAuthenticationOptions` are JSON-compatible maps.
- `FidoRegistrationResult` and `FidoAuthenticationResult` are JSON-compatible maps.

This is intentionally flexible to match native WebAuthn/FIDO payloads from platform SDKs.

## Error handling

Promise rejections use the shared `GenericError` contract from `@ping-identity/rn-types`.

```ts
import { authenticate } from "@ping-identity/rn-fido";
import type { FidoError } from "@ping-identity/rn-fido";

try {
  await authenticate({ challenge: "..." });
} catch (error) {
  const fidoError = error as FidoError;
  console.log({
    type: fidoError.type,
    error: fidoError.error,
    message: fidoError.message,
    code: fidoError.code,
    status: fidoError.status,
  });
}
```

Stable error codes:

- `FIDO_ERROR`
- `FIDO_REGISTER_ERROR`
- `FIDO_AUTHENTICATE_ERROR`
- `FIDO_AUTHENTICATE_CANCELLED`
- `FIDO_ACTIVITY_UNAVAILABLE` (Android)
- `FIDO_WINDOW_UNAVAILABLE` (iOS)
- `FIDO_CALLBACK_NOT_FOUND`

## Platform caveats

- Android: a foreground `Activity` must be available when invoking `register`, `authenticate`, or Journey-scoped FIDO operations.
- iOS: an active `UIWindowScene`/`ASPresentationAnchor` must be available when invoking `register`, `authenticate`, or Journey-scoped FIDO operations.

## E2E testing note

- Full passkey E2E strategy (including OS-level credential surfaces outside app UI) is still to be determined.

## License

MIT
