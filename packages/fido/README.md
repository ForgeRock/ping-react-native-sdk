[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native FIDO

This package provides a native-backed FIDO bridge for React Native.

## Table of contents

- [Install](#install)
- [FIDO prerequisites](#fido-prerequisites)
- [Client-first usage](#client-first-usage)
- [Journey integration](#journey-integration)
- [DaVinci integration](#davinci-integration)
  - [The `trigger` field](#the-trigger-field)
- [`useJourneyForm` integration](#usejourneyform-integration)
- [API reference](#api-reference)
- [Errors](#errors)
- [Platform notes](#platform-notes)
- [Customizing credential requests](#customizing-credential-requests)
  - [Registration customization](#registration-customization)
  - [Authentication customization](#authentication-customization)
  - [Prefer immediately available credentials](#prefer-immediately-available-credentials)
  - [Android API routing](#android-api-routing)
  - [Host permissions](#host-permissions)
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
- Define the `appRedirectUriScheme` manifest placeholder for both debug and release builds (for example `manifestPlaceholders["appRedirectUriScheme"] = "com.example.app"` in `defaultConfig`). The Ping browser module that requires it is not part of rn-fido's dependency graph on its own (only `androidx.browser` is transitive); it reaches an app via `@ping-identity/rn-oidc` or `@ping-identity/rn-external-idp`. The placeholder default in the native SDK's own debug variant never reaches consuming apps, and the manifest merge fails while the placeholder is unresolved. Defining the placeholder is safe regardless.

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
    useFido2ApiClient: true,
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
Journey and DaVinci collector ceremonies retain their workflow-configured native
logger for the ceremony itself; the logger identified by the client logger id only
receives the warnings about ignored or invalid ceremony options.

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
  android: { useFido2ApiClient: true },
});

const fidoB = createFidoClient({
  android: { useFido2ApiClient: false },
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
collector key to `next()`. The DaVinci methods carry ceremony options merged
into their options object; see
[Customizing credential requests](#customizing-credential-requests).

The optional `index` selects among multiple FIDO2 collectors with the same
action. The methods return the native attestation or assertion payload for
informational use; the native collector submits it when the flow advances.

### The `trigger` field

Both DaVinci collector types expose `trigger: string`, the raw server-supplied
value, on both platforms. It is `""` when the server omits the field. iOS
derives an internal `isAutomatic` launch flag from it (false when empty or
case-insensitively `"BUTTON"`, true otherwise) that JS does not expose, so the
raw value carries no cross-platform launch semantic.

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

| `clientError`       | Typical outcome                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `NotAllowedError`   | User cancellation or dismissal of the passkey UI; on iOS, also a generic OS failure in the DaVinci scope (see [Error code contract](#errors)). |
| `TimeoutError`      | The ceremony timed out.                                                                                                                        |
| `NotSupportedError` | Passkeys are unsupported on the device or blocked by policy.                                                                                   |
| `InvalidStateError` | The credential is invalid or already registered (excluded credential).                                                                         |
| `UnknownError`      | Any other failure, including an unrecognized native error.                                                                                     |

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
  FidoRegistrationCeremonyOptions,
  FidoRegistrationResult,
  FidoAuthenticationOptions,
  FidoAuthenticationCeremonyOptions,
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
  register(
    options: FidoRegistrationOptions,
    ceremonyOptions?: FidoRegistrationCeremonyOptions,
  ): Promise<FidoRegistrationResult>;
  authenticate(
    options: FidoAuthenticationOptions,
    ceremonyOptions?: FidoAuthenticationCeremonyOptions,
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
- `FIDO_INVALID_PARAMETER`: invalid caller input rejected before any native call, with `type: 'argument_error'`.

Error code contract, identical on both platforms and stable within each
scope; the standalone scope intentionally differs from Journey and DaVinci:

- `authenticateForJourney` and `authenticateForDaVinci` reject with
  `FIDO_AUTHENTICATE_CANCELLED` when the user cancels or no usable
  credential is available (Android: Credential Manager cancellation or no
  credential; iOS: user cancellation, including the cancel produced by
  `preferImmediatelyAvailableCredentials` when no local credential matches).
  Every other authentication failure rejects with `FIDO_AUTHENTICATE_ERROR`.
  On iOS in the DaVinci scope, a hard failure can also be classified as
  `FIDO_AUTHENTICATE_CANCELLED`: the native collector transforms both user
  cancellation and generic OS failure (`ASAuthorizationError.failed`) to the
  same error before the bridge classifies it. The Journey scope is not
  affected: only genuine user cancellation is classified as
  `FIDO_AUTHENTICATE_CANCELLED` there.
- Standalone `authenticate` rejects with `FIDO_AUTHENTICATE_ERROR` for every
  failure, user cancellation included; it has no cancellation-specific code.
- `register`, `registerForJourney` and `registerForDaVinci` always reject with
  `FIDO_REGISTER_ERROR`, user cancellation included.

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

- `android.useFido2ApiClient` is an Android-only override of the FIDO2 API used for authentication. It applies to `authenticate`, `authenticateForJourney` and `authenticateForDaVinci`; registration is not affected. This client-level flag is deprecated in favor of the per-call `android.useFido2ApiClient` ceremony option; it remains supported. See [Android API routing](#android-api-routing) for the precedence rules.
  - `undefined` (default): native SDK auto-detection/default behavior.
  - `true`: force Google Play Services FIDO2 APIs.
  - `false`: force Android Credential Manager APIs.
- `preferImmediatelyAvailableCredentials` applies to different ceremonies per platform: iOS applies it to authentication, Android to registration. See [Prefer immediately available credentials](#prefer-immediately-available-credentials).
- Journey and DaVinci ceremony methods (`registerForJourney`, `authenticateForJourney`, `registerForDaVinci`, `authenticateForDaVinci`) keep the workflow-configured native logger for the ceremony on both platforms; the client logger id only receives the warnings about ignored or invalid ceremony options. Their ceremony options are otherwise honored like the standalone methods:
  - Android registration applies `android.credentialManager` and `preferImmediatelyAvailableCredentials`; `android.useFido2ApiClient` and `android.playServices` do not apply to registration.
  - Android authentication applies the per-call `android.useFido2ApiClient` (else the client-level flag) and the `android.credentialManager` or `android.playServices` block for the selected route; `preferImmediatelyAvailableCredentials` is ignored with a warning.
  - iOS authentication applies `preferImmediatelyAvailableCredentials`; the `android` block is ignored with a warning. iOS registration ignores `preferImmediatelyAvailableCredentials` with a warning.
- iOS accepts the same config shape for API parity, but does not currently apply native client-level config.
- Journey callback execution currently follows native SDK behavior; Android Journey callback APIs do not currently accept injected custom native `FidoClient` configuration.
- Android requires a foreground `Activity` for FIDO calls.
- iOS requires an active `UIWindowScene`/`ASPresentationAnchor` for FIDO calls.

## Customizing credential requests

Both standalone methods take an optional second argument:

- `register(options, ceremonyOptions?: FidoRegistrationCeremonyOptions)`
- `authenticate(options, ceremonyOptions?: FidoAuthenticationCeremonyOptions)`

Journey and DaVinci methods carry the same ceremony fields merged into their
single options object instead of a second argument. Every key below exists in
the exported types from `@ping-identity/rn-fido`.

### Registration customization

`FidoRegistrationCeremonyOptions` accepts `preferImmediatelyAvailableCredentials`
and an Android-only `android.credentialManager` block
(`FidoAndroidRegistrationOptions`). Registration always uses Credential Manager
on Android, so a supplied `android.playServices` block is ignored with a
warning.

```ts
const registrationResult = await fido.register(
  {
    challenge: 'base64url-challenge',
    rp: { id: 'example.com', name: 'Example Inc.' },
    user: {
      id: 'base64url-user-id',
      name: 'user@example.com',
      displayName: 'Example User',
    },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
  },
  {
    preferImmediatelyAvailableCredentials: true,
    android: {
      credentialManager: {
        // JSON merge patch (RFC 7396) on the SDK-transformed create request:
        // nested objects merge, arrays replace, null deletes.
        requestJson: { user: { displayName: 'Example User' } },
        // Base64url (padded or unpadded) of the SHA-256 hash of your own
        // client data; the sample value is a placeholder, not a real hash.
        clientDataHash: 'aGVsbG8',
        preferImmediatelyAvailableCredentials: true,
        isAutoSelectAllowed: true,
        // See "Host permissions" below.
        origin: 'https://example.com',
      },
    },
  },
);
```

`preferDefaultProvider` takes a flattened component name (`package/class`) and
must not be combined with `isConditional: true`; that combination rejects with
an argument error. `isConditional: false` is allowed next to it.

```ts
const ceremonyOptions = {
  android: {
    credentialManager: {
      preferDefaultProvider: 'com.example.auth/.PasskeyProvider',
      isConditional: false,
    },
  },
};

await fido.register({ challenge: 'base64url-challenge' }, ceremonyOptions);
```

Unset fields keep the values the native SDK computed for the request: when a
field is unset the defaults are an unchanged `requestJson`, no
`clientDataHash`, no `origin`, no `preferDefaultProvider`, and `false` for
`preferImmediatelyAvailableCredentials`, `isAutoSelectAllowed` and
`isConditional`.

### Authentication customization

`FidoAuthenticationCeremonyOptions` accepts `preferImmediatelyAvailableCredentials`
and an Android-only `android` block with `useFido2ApiClient`,
`credentialManager` (`FidoAndroidCredentialManagerOptions`) and
`playServices` (`FidoAndroidPlayServicesOptions`). A block is applied only
when the selected API route matches it, so set `useFido2ApiClient` per call
next to the block you supply. On a device with `play-services-fido` the
default route is Play Services, exactly like the native Android SDK. See
[Android API routing](#android-api-routing).

```ts
const authenticationResult = await fido.authenticate(
  {
    challenge: 'base64url-challenge',
    rpId: 'example.com',
    allowCredentials: [],
  },
  {
    // Android applies this on registration only; on authentication it is
    // logged as unsupported and native default behavior applies. iOS applies
    // it to authentication.
    preferImmediatelyAvailableCredentials: true,
    android: {
      useFido2ApiClient: false,
      credentialManager: {
        requestJson: { userVerification: 'preferred' },
        clientDataHash: 'aGVsbG8',
        allowedProviders: ['com.example.auth/.PasskeyProvider'],
      },
    },
  },
);
```

The Play Services block customizes the sign-in request built from your
authentication options. `transports` is one flat list of WebAuthn transport
names (for example `usb`, `nfc`, `ble`) applied to every credential of the
allow list; there is no per-credential transport selection. Transport names
are forwarded unchanged; unsupported names are dropped with a warning.

```ts
await fido.authenticate(
  {
    challenge: 'base64url-challenge',
    rpId: 'example.com',
    allowCredentials: [],
  },
  {
    android: {
      useFido2ApiClient: true,
      playServices: {
        timeoutSeconds: 60,
        requestId: 42,
        transports: ['internal', 'hybrid'],
        authenticationExtensions: {
          fidoAppId: 'https://example.com',
          userVerificationMethod: true,
        },
      },
    },
  },
);
```

### Prefer immediately available credentials

`preferImmediatelyAvailableCredentials: true` marks the ceremony as preferring
immediately available credentials: when no local credential offering exists,
the operation returns immediately instead of falling back to discovering
remote options (QR or nearby-device registration). It is a preference, not a
guarantee about dialog contents: the credential provider may still present
secondary save paths in its UI. The platforms apply it in different
ceremonies:

- **iOS** applies it to `authenticate`, `authenticateForJourney` and
  `authenticateForDaVinci` in all scopes. When no local credential matches,
  the ceremony cancels in all three scopes; rejections map to
  `FIDO_AUTHENTICATE_CANCELLED` for `authenticateForJourney` and
  `authenticateForDaVinci`, and to `FIDO_AUTHENTICATE_ERROR` for standalone
  `authenticate`. On registration the value is reported by native and the
  full registration flow applies.
- **Android** applies it to registration (`register`, `registerForJourney`,
  `registerForDaVinci`) through the Credential Manager create request. On
  authentication the current Android native SDK cannot apply it: a warning is
  logged and the default sign-in flow runs. A future native release will
  support it there, at which point the bridge forwards the value without any
  change to this API.

### Android API routing

Android authentication can run through the Credential Manager API or the
Google Play Services FIDO2 API. This matches the native Android SDK, where
`FidoAuthenticateCustomizer.useFido2ApiClient` alone selects the route. The
route is the first of:

| Order | Source                                                              | Effective route                                                                             |
| ----- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1     | Per-call `android.useFido2ApiClient` in the authentication options  | `true`: Play Services. `false`: Credential Manager                                          |
| 2     | Client-level `createFidoClient({ android: { useFido2ApiClient } })` | `true`: Play Services. `false`: Credential Manager                                          |
| 3     | Native auto-detection                                               | Play Services when the host app includes `play-services-fido`, otherwise Credential Manager |

```ts
// Route this call through Credential Manager and customize its request.
await fido.authenticate(
  { challenge: 'base64url-challenge', rpId: 'example.com' },
  {
    android: {
      useFido2ApiClient: false,
      credentialManager: {
        allowedProviders: ['com.example.auth/.PasskeyProvider'],
      },
    },
  },
);
```

The Play Services route needs `com.google.android.gms:play-services-fido` in
the host app: this package declares it `compileOnly`, so it is not bundled
transitively. Without it, native auto-detection selects Credential Manager and a
supplied `android.playServices` block is not applied and a warning is logged;
`useFido2ApiClient: true` does not make the block apply without it.

Rules:

- A `credentialManager` or `playServices` block never changes the route. Only
  the block matching the selected route is applied. A block for the route that
  is not selected is not applied and a warning naming the key is logged.
  Supplying both blocks is allowed.
- A device with `play-services-fido` defaults to Play Services, so a
  `credentialManager` block without `useFido2ApiClient: false` is not applied
  there. Set the flag next to the block you supply.
- When the Play Services FIDO API is unavailable, an `android.playServices`
  block is not applied and a warning is logged, even with
  `useFido2ApiClient: true`.
- A non-boolean per-call `android.useFido2ApiClient` rejects with an argument
  error before native.
- The Credential Manager route requires the app to declare
  `androidx.credentials:credentials-play-services-auth` when supporting
  Android API 33 and older (see [FIDO prerequisites](#fido-prerequisites)).
- The flag applies to authentication only; registration always uses
  Credential Manager on Android and does not accept it.
- The client-level `useFido2ApiClient` flag is deprecated in favor of the
  per-call flag. It remains supported and is overridden by the per-call value.
- On iOS the whole `android` block, including the per-call flag, is ignored
  with a warning and the key is never sent to native.

### Host permissions

`android.credentialManager.origin` (`FidoAndroidRegistrationOptions`) sets the
caller origin for privileged registration requests. On Android API 34 and
above it requires the host app to hold
`android.permission.CREDENTIAL_MANAGER_SET_ORIGIN`; a non-null value without
the permission throws a `SecurityException`.

`android.credentialManager.preferDefaultProvider` and the authentication-side
`allowedProviders` require the host app to hold
`android.permission.CREDENTIAL_MANAGER_SET_ALLOWED_PROVIDERS`; without it the
provider restriction does not take effect, or a non-empty `allowedProviders`
list throws a `SecurityException`. On Android API 33 and below neither may take
effect even with the permission: control the provider through library
dependencies instead.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details
