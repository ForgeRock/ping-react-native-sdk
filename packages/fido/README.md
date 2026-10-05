[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native FIDO

This package provides a native-backed FIDO bridge for React Native.

## Table of contents

- [Install](#install)
- [FIDO prerequisites](#fido-prerequisites)
- [Client-first usage](#client-first-usage)
- [Journey integration](#journey-integration)
- [DaVinci integration](#davinci-integration)
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
Native logger forwarding applies to standalone operations on both platforms.
Journey and DaVinci collector ceremonies retain their workflow-configured native logger.

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

## DaVinci integration

FIDO2 DaVinci collectors use one collector type and an action discriminator:
`action: 'REGISTER'` exposes creation options, while `action: 'AUTHENTICATE'`
exposes request options. Create a FIDO client before starting or normalizing
the DaVinci flow — `createFidoClient` registers `fidoCollectorType`
(`'FIDO2'`) with the integration registry and eagerly registers the native
collector serializer, so nodes mapped before the first ceremony still carry
`action` and the WebAuthn options payload.

Run the ceremony, then advance the DaVinci flow with an empty collector input:

```ts
import { useDaVinciForm } from '@ping-identity/rn-davinci';
import {
  createFidoClient,
  fidoCollectorType,
  type FidoCollector,
} from '@ping-identity/rn-fido';

const fido = createFidoClient();
const form = useDaVinciForm(node, {
  handledCollectorTypes: new Set([fidoCollectorType]),
});
const collector = node.collectors[0] as FidoCollector;

if (collector.action === 'REGISTER') {
  await fido.registerForDaVinci(daVinci, { index: 0 });
} else {
  await fido.authenticateForDaVinci(daVinci, { index: 0 });
}

// The native collector retains the attestation or assertion for submission.
await daVinci.next({ collectors: [] });
```

When using `useDaVinciForm`, include `fidoCollectorType` in
`handledCollectorTypes` after creating the FIDO client. Do not pass the FIDO
collector key to `next()`. The initial DaVinci integration uses native ceremony
defaults and does not expose React Native customization options.

The optional `index` selects among multiple FIDO2 collectors with the same
action. The methods return the native attestation or assertion payload for
informational use; the native collector submits it when the flow advances.

### DaVinci ceremony failure propagation

When a DaVinci ceremony fails, the native collector classifies the failure and
the rejection carries `FidoError.clientError`, a WebAuthn DOMException name
(for example `'NotAllowedError'` after a user cancellation). When
`clientError` is defined, report the failure to the server by advancing the
flow with `daVinci.next({ collectors: [] })` so the DaVinci flow can branch on
it; without propagation the failure stays client-side and the server never
observes it. Resolution failures such as `FIDO_COLLECTOR_NOT_FOUND` carry no
`clientError` and must not be propagated; keep the node rendered for retry.

Always advance with an empty collector input. Never submit the node's
collectors after a failed ceremony: on a node that also contains a
`SUBMIT_BUTTON`, the submit action shadows the FIDO error and the server
receives a normal submit instead of the failure (the native event builder
picks a submit or flow collector's action first, before any FIDO error
action).

```ts
import { FidoError } from '@ping-identity/rn-fido';

try {
  if (collector.action === 'REGISTER') {
    await fido.registerForDaVinci(daVinci, { index: 0 });
  } else {
    await fido.authenticateForDaVinci(daVinci, { index: 0 });
  }
  await daVinci.next({ collectors: [] });
} catch (error) {
  const err = FidoError.from(error);
  if (err.clientError !== undefined) {
    // The collector classified the failure; submit it so the flow can branch.
    try {
      await daVinci.next({ collectors: [] });
    } catch (propagationError) {
      // Advancing the flow also failed; surface it without losing the
      // original ceremony failure.
    }
  }
  // Handle the failure in place, for example by showing err.message. A
  // failure without clientError is not propagatable; keep the node rendered
  // for retry. Do not propagate twice: once submitted, the failure state is
  // consumed.
}
```

`FidoError.clientError` values and their typical outcomes:

| `clientError`       | Typical outcome                                                        |
| ------------------- | ---------------------------------------------------------------------- |
| `NotAllowedError`   | User cancellation or dismissal of the passkey UI.                      |
| `TimeoutError`      | The ceremony timed out.                                                |
| `NotSupportedError` | Passkeys are unsupported on the device or blocked by policy.           |
| `InvalidStateError` | The credential is invalid or already registered (excluded credential). |
| `UnknownError`      | Any other failure, including an unrecognized native error.             |

`NotAllowedError`, `TimeoutError`, `NotSupportedError`, `InvalidStateError`,
and `UnknownError` are the only values iOS reports. Android reports an open
set: credential exceptions map to their WebAuthn DOMException names, so other
valid names (for example `SecurityError`) can appear. Unknown names pass
through to the server unmodified.

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
  FidoDaVinciRegistrationOptions,
  FidoDaVinciAuthenticationOptions,
  FidoDaVinciResult,
  DaVinciInstance,
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
  registerForDaVinci(
    daVinci: DaVinciInstance,
    options?: FidoDaVinciRegistrationOptions,
  ): Promise<FidoDaVinciResult>;
  authenticateForDaVinci(
    daVinci: DaVinciInstance,
    options?: FidoDaVinciAuthenticationOptions,
  ): Promise<FidoDaVinciResult>;
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
- `FIDO_COLLECTOR_NOT_FOUND`

DaVinci ceremony failures additionally carry `FidoError.clientError`, the
WebAuthn DOMException name reported by the native collector, typed as
`FidoClientErrorName`. The two fields classify the same failure at different
layers and can intentionally disagree: `code` is the bridge-local
classification (for example `FIDO_AUTHENTICATE_CANCELLED`), while
`clientError` is the server-parity value the DaVinci flow branches on (for
example, on Android a missing credential reports `clientError: 'UnknownError'`
next to `code: 'FIDO_AUTHENTICATE_CANCELLED'`).

`clientError` is defined only on DaVinci ceremony failures that the collector
classified. Standalone and Journey rejections never carry it, and neither do
resolution failures such as `FIDO_COLLECTOR_NOT_FOUND`. See
[DaVinci ceremony failure propagation](#davinci-ceremony-failure-propagation)
for the propagation contract and the full value table.

## Platform notes

- `android.useFido2Client` is an Android-only override for the standalone `register` / `authenticate` operations.
  - `undefined` (default): native SDK auto-detection/default behavior.
  - `true`: force Google Play Services FIDO2 APIs.
  - `false`: force Android Credential Manager APIs.
- Journey and DaVinci ceremony methods (`registerForJourney`, `authenticateForJourney`, `registerForDaVinci`, `authenticateForDaVinci`) currently ignore the client-level config on both platforms: ceremonies keep the workflow-configured native logger and native client defaults, so `android.useFido2Client` and the client-level logger id have no effect there.
- iOS accepts the same config shape for API parity, but does not currently apply native client-level config.
- Journey callback execution currently follows native SDK behavior; Android Journey callback APIs do not currently accept injected custom native `FidoClient` configuration.
- Android requires a foreground `Activity` for FIDO calls.
- iOS requires an active `UIWindowScene`/`ASPresentationAnchor` for FIDO calls.

## E2E testing note

Full passkey E2E strategy (including OS-level credential surfaces outside app UI) is still to be determined.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details
