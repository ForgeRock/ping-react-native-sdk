<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Binding

This package provides native-backed device binding and signing-verifier capabilities for React Native.

## Table of contents

- [Install](#install)
- [Journey integration](#journey-integration)
- [Optional `useJourneyForm` integration](#optional-usejourneyform-integration)
- [Custom UI collectors](#custom-ui-collectors)
- [User key storage](#user-key-storage)
- [Managing stored keys](#managing-stored-keys)
- [Advanced configuration example](#advanced-configuration-example)
- [API reference](#api-reference)
- [Errors](#errors)
- [Platform notes](#platform-notes)
- [Security notes](#security-notes)
- [License](#license)

## Install

```bash
yarn add @ping-identity/rn-binding
cd ios && pod install
```

Optional integration packages:

```bash
yarn add @ping-identity/rn-logger
yarn add @ping-identity/rn-storage
```

## Journey integration

Run Journey binding callbacks explicitly before `journey.next(...)`.

```ts
import { createBindingClient } from '@ping-identity/rn-binding';

const binding = createBindingClient();

if (node.type === 'ContinueNode') {
  for (const callback of node.callbacks ?? []) {
    if (callback.type === 'DeviceBindingCallback') {
      await binding.bindForJourney(journey, { index: 0 });
    }

    if (callback.type === 'DeviceSigningVerifierCallback') {
      await binding.signForJourney(journey, { index: 0 });
    }
  }

  await journey.next({});
}
```

### Logging integration (optional)

```ts
import { createBindingClient } from '@ping-identity/rn-binding';
import { logger } from '@ping-identity/rn-logger';

const binding = createBindingClient({
  logger: logger({ level: 'debug' }),
});
```

## Optional `useJourneyForm` integration

When using `useJourneyForm`, binding fields are marked with `executionMode: 'integration_required'`.
This indicates app code must run binding integration explicitly.

```ts
import { useJourneyForm } from '@ping-identity/rn-journey';
import { createBindingClient } from '@ping-identity/rn-binding';

const form = useJourneyForm(node);
const binding = createBindingClient();

for (const field of form.fields) {
  if (field.ref.type === 'DeviceBindingCallback') {
    await binding.bindForJourney(journey, {
      index: field.ref.typeIndex,
    });
  }

  if (field.ref.type === 'DeviceSigningVerifierCallback') {
    await binding.signForJourney(journey, {
      index: field.ref.typeIndex,
    });
  }
}

await journey.next({});
```

## Custom UI collectors

Use `pinCollector` and `userKeySelector` only when you want app-owned UI.
When omitted, the native SDK default UI is used on each platform.

```ts
import {
  createBindingClient,
  type BindingPrompt,
  type UserKeyOption,
} from '@ping-identity/rn-binding';

const binding = createBindingClient({
  ui: {
    pinCollector: async (prompt: BindingPrompt) => {
      // Show app PIN modal and resolve with the entered PIN.
      return showPinModal(prompt);
    },
    userKeySelector: async (keys: UserKeyOption[]) => {
      // Show app key-selection UI and resolve with the chosen key.
      return showKeySelector(keys);
    },
  },
});
```

## User key storage

By default, key metadata is stored in a shared location. Pass a custom storage handle
(created by `configureBindingUserKeyStorage` from `@ping-identity/rn-storage`) to isolate
key storage per app or configuration.

```ts
import { createBindingClient } from '@ping-identity/rn-binding';
import { configureBindingUserKeyStorage } from '@ping-identity/rn-storage';

const binding = createBindingClient({
  userKeyStorage: configureBindingUserKeyStorage({
    android: {
      keyAlias: 'binding_user_keys',
      fileName: 'binding_user_keys',
      strongBoxPreferred: true,
      cacheStrategy: 'no_cache',
    },
    ios: {
      account: 'com.example.binding.keys',
      encryptor: true,
    },
  }),
});
```

## Managing stored keys

After a successful bind, a key record is stored locally on the device. Use these module-level
utilities to inspect and clean up stored keys — for example when a user logs out, de-registers a
device, or you need to recover from a corrupted binding state.

```ts
import {
  getAllKeys,
  deleteKey,
  deleteAllKeys,
  type UserKeyOption,
} from '@ping-identity/rn-binding';

// Retrieve all locally stored binding keys
const keys: UserKeyOption[] = await getAllKeys();
// [{ id: 'abc123', userId: 'user-001', username: 'alice', authenticationType: 'BIOMETRIC_ONLY' }]

// Delete a single key (pass the UserKeyOption returned by getAllKeys)
await deleteKey(keys[0]);

// Delete all locally stored keys
await deleteAllKeys();
```

These functions are stateless utilities — they do not require a `BindingClient` instance.

### What gets deleted

On both platforms, deleting a key removes:

- The **key metadata** record (username, userId, authenticationType) stored in encrypted
  SharedPreferences (Android) or Keychain (iOS).
- The **cryptographic key material** stored in Android Keystore or iOS Secure Enclave.

Deleting a key locally does **not** remove the device registration record from the server.
If you need to deregister the device server-side, use the `device-client` package first, then
call `deleteKey` to clean up the local key.

### Error handling

`deleteKey` rejects with `BINDING_KEY_DELETE_ERROR` if the specified key is not found.

```ts
try {
  const keys = await getAllKeys();
  if (keys.length > 0) {
    await deleteKey(keys[0]);
  }
} catch (err) {
  if (err instanceof BindingError) {
    // err.code === 'BINDING_KEY_DELETE_ERROR'
  }
}
```

## Advanced configuration example

`appPin`, `biometric`, `jwt`, and `signingAlgorithm` are per-call options passed directly to
`bindForJourney` or `signForJourney`. Options marked `// iOS only` or `// Android only` are
silently ignored on the other platform.

```ts
import {
  createBindingClient,
  type BindingPrompt,
  type UserKeyOption,
} from '@ping-identity/rn-binding';
import { configureBindingUserKeyStorage } from '@ping-identity/rn-storage';
import { logger } from '@ping-identity/rn-logger';

const binding = createBindingClient({
  logger: logger({ level: 'debug' }),
  ui: {
    pinCollector: async (prompt: BindingPrompt) => showPinModal(prompt),
    userKeySelector: async (keys: UserKeyOption[]) => showKeySelector(keys),
  },
  userKeyStorage: configureBindingUserKeyStorage({
    android: { keyAlias: 'binding_user_keys', fileName: 'binding_user_keys' },
    ios: { account: 'com.example.binding.keys', encryptor: true },
  }),
});

// Bind — all authenticator options are per-call
await binding.bindForJourney(journey, {
  deviceName: 'My Phone',
  signingAlgorithm: 'RS256', // Android only
  appPin: {
    maxAttempts: 5,
    keystoreType: 'PKCS12', // Android only
    keyTag: 'com.example.apppin.key', // iOS only
    prompt: {
      title: 'Enter PIN',
      subtitle: 'Verify your identity',
      description: 'Enter your application PIN',
    },
  },
  biometric: {
    android: {
      strongBoxPreferred: true, // Android only
      prompt: {
        title: 'Verify identity',
        subtitle: 'Authentication required',
        description: 'Use your biometric to continue',
        negativeButtonText: 'Cancel', // shown for BIOMETRIC_ONLY auth type
      },
    },
    ios: {
      keyTag: 'com.example.biometric.key',
    },
  },
  jwt: {
    issueTimeEpochSeconds: Math.floor(Date.now() / 1000),
    notBeforeTimeEpochSeconds: Math.floor(Date.now() / 1000),
    expirationTimeEpochSeconds: Math.floor(Date.now() / 1000) + 300,
  },
});

// Sign — same options plus claims
await binding.signForJourney(journey, {
  claims: {
    transaction_id: 'txn_abc123',
    amount: '100.00',
  },
  signingAlgorithm: 'RS256', // Android only
  appPin: {
    maxAttempts: 5,
  },
  biometric: {
    android: {
      strongBoxPreferred: true,
    },
  },
  jwt: {
    issueTimeEpochSeconds: Math.floor(Date.now() / 1000),
    expirationTimeEpochSeconds: Math.floor(Date.now() / 1000) + 300,
  },
});
```

## API reference

```ts
import {
  createBindingClient,
  getAllKeys,
  deleteKey,
  deleteAllKeys,
} from '@ping-identity/rn-binding';
import type {
  BindingClient,
  BindingConfig,
  BindingJourneyBindOptions,
  BindingJourneySignOptions,
  BindingJourneyResult,
  JourneyInstance,
  UserKeyOption,
} from '@ping-identity/rn-binding';

// Journey binding client
function createBindingClient(config?: BindingConfig): BindingClient;

interface BindingClient {
  bindForJourney(
    journey: JourneyInstance,
    options?: BindingJourneyBindOptions,
  ): Promise<BindingJourneyResult>;
  signForJourney(
    journey: JourneyInstance,
    options?: BindingJourneySignOptions,
  ): Promise<BindingJourneyResult>;
}

// Key management utilities (no client instance required)
function getAllKeys(): Promise<UserKeyOption[]>;
function deleteKey(key: UserKeyOption): Promise<void>;
function deleteAllKeys(): Promise<void>;

type UserKeyOption = {
  id: string; // Unique key identifier (kid)
  userId: string; // User identifier associated with this key
  username: string; // Human-readable username associated with this key
  authenticationType: string; // e.g. "BIOMETRIC_ONLY", "APPLICATION_PIN", "NONE"
};
```

## Configuration options

### Client config (`createBindingClient`)

The client holds only stateful, shared concerns. Per-operation options are passed directly to
`bindForJourney` / `signForJourney`.

| Option               | Type                               | Description                                               |
| -------------------- | ---------------------------------- | --------------------------------------------------------- |
| `logger`             | `LoggerInstance`                   | JS logger from `@ping-identity/rn-logger`.                |
| `ui.pinCollector`    | `(prompt) => Promise<string>`      | App-owned PIN collection UI callback.                     |
| `ui.userKeySelector` | `(keys) => Promise<UserKeyOption>` | App-owned user-key selection callback.                    |
| `userKeyStorage`     | `UserKeyStorage`                   | Handle returned by `configureBindingUserKeyStorage(...)`. |

### Bind options (`bindForJourney`)

| Option             | Type                         | Default           | Description                                                                  |
| ------------------ | ---------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `index`            | `number`                     | `0`               | Callback index when multiple bind callbacks exist.                           |
| `deviceName`       | `string`                     | Device model name | Human-readable device name sent to the server.                               |
| `signingAlgorithm` | `string`                     | `"RS512"`         | JWS algorithm for the signed JWT proof. Android only; iOS always uses ES256. |
| `appPin`           | `BindingAppPinConfig`        | —                 | App PIN authenticator options.                                               |
| `biometric`        | `BindingBiometricBindConfig` | —                 | Biometric authenticator options.                                             |
| `jwt`              | `BindingJwtConfig`           | —                 | JWT proof timing options.                                                    |

### Sign options (`signForJourney`)

| Option             | Type                         | Default   | Description                                                                  |
| ------------------ | ---------------------------- | --------- | ---------------------------------------------------------------------------- |
| `index`            | `number`                     | `0`       | Callback index when multiple sign callbacks exist.                           |
| `claims`           | `Record<string, unknown>`    | `{}`      | Custom claims added to the signed JWT payload.                               |
| `signingAlgorithm` | `string`                     | `"RS512"` | JWS algorithm for the signed JWT proof. Android only; iOS always uses ES256. |
| `appPin`           | `BindingAppPinConfig`        | —         | App PIN authenticator options.                                               |
| `biometric`        | `BindingBiometricSignConfig` | —         | Biometric authenticator options.                                             |
| `jwt`              | `BindingJwtConfig`           | —         | JWT proof timing options.                                                    |

Reserved claim names (`sub`, `exp`, `iat`, `nbf`, `iss`, `challenge`) cannot be used in `claims`.

### `BindingAppPinConfig`

| Option               | Type     | Platform            | Description                                                                                          |
| -------------------- | -------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| `maxAttempts`        | `number` | Both                | Maximum PIN retry count.                                                                             |
| `prompt.title`       | `string` | Both                | PIN prompt title override.                                                                           |
| `prompt.subtitle`    | `string` | Both                | PIN prompt subtitle override.                                                                        |
| `prompt.description` | `string` | Both                | PIN prompt description override.                                                                     |
| `keyTag`             | `string` | iOS only, bind only | Keychain key tag for the app PIN authenticator key. Stored at bind time; used automatically on sign. |
| `keystoreType`       | `string` | Android only        | KeyStore type for app PIN key storage. Defaults to `"PKCS12"`.                                       |

### `BindingBiometricBindConfig` / `BindingBiometricSignConfig`

| Option                              | Type      | Platform       | Description                                                                                            |
| ----------------------------------- | --------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| `android.prompt.title`              | `string`  | Android        | Biometric prompt title.                                                                                |
| `android.prompt.subtitle`           | `string`  | Android        | Biometric prompt subtitle.                                                                             |
| `android.prompt.description`        | `string`  | Android        | Biometric prompt description.                                                                          |
| `android.prompt.negativeButtonText` | `string`  | Android        | Cancel button label (shown for `BIOMETRIC_ONLY`).                                                      |
| `android.strongBoxPreferred`        | `boolean` | Android        | Prefer StrongBox-backed key storage. Defaults to `false`.                                              |
| `ios.keyTag`                        | `string`  | iOS, bind only | Keychain key tag for the biometric authenticator key. Stored at bind time; used automatically on sign. |

### `BindingJwtConfig`

| Option                       | Type     | Platform | Description              |
| ---------------------------- | -------- | -------- | ------------------------ |
| `issueTimeEpochSeconds`      | `number` | Both     | Fixed `iat` claim value. |
| `notBeforeTimeEpochSeconds`  | `number` | Both     | Fixed `nbf` claim value. |
| `expirationTimeEpochSeconds` | `number` | Both     | Fixed `exp` claim value. |

## Errors

Rejected promises throw a `BindingError` instance, which extends `PingError extends Error`. Use `instanceof BindingError` to narrow in catch blocks.

Stable error codes:

| Code                         | Description                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BINDING_ERROR`              | Unexpected error.                                                                                                                                                              |
| `BINDING_BIND_ERROR`         | Bind operation failed.                                                                                                                                                         |
| `BINDING_SIGN_ERROR`         | Sign operation failed.                                                                                                                                                         |
| `BINDING_CANCELLED`          | User cancelled the authentication prompt, or the operation timed out.                                                                                                          |
| `BINDING_UNSUPPORTED_DEVICE` | Device lacks the hardware or OS capabilities required for binding.                                                                                                             |
| `BINDING_NOT_REGISTERED`     | No local key found for this user on this device — device must be bound first.                                                                                                  |
| `BINDING_KEY_INVALIDATED`    | The signing key on this device is no longer usable — typically caused by a biometric enrollment change. The user must re-bind; their account and other devices are unaffected. |
| `BINDING_AUTH_FAILED`        | Authentication failed — wrong fingerprint, wrong PIN, or biometric lockout. The key is intact and the operation can be retried.                                                |
| `BINDING_UI_UNAVAILABLE`     | No foreground Activity (Android) or UIWindowScene (iOS) available.                                                                                                             |
| `BINDING_CALLBACK_NOT_FOUND` | No matching Journey callback found for the given journey id and index.                                                                                                         |
| `BINDING_INVALID_CONFIG`     | Reserved claim names were used in `claims`, or another configuration error.                                                                                                    |
| `BINDING_KEY_DELETE_ERROR`   | `deleteKey` could not find the specified key in local storage.                                                                                                                 |

### Handling key invalidation

`BINDING_KEY_INVALIDATED` and `BINDING_NOT_REGISTERED` both mean the key on this device is gone — the user must re-bind. The user's account and any keys bound on other devices are unaffected.

```ts
import { BindingError } from '@ping-identity/rn-binding';

try {
  await binding.signForJourney(journey);
} catch (err) {
  if (
    err instanceof BindingError &&
    (err.code === 'BINDING_KEY_INVALIDATED' ||
      err.code === 'BINDING_NOT_REGISTERED')
  ) {
    // Key is gone on this device — clean up and re-bind.
    const keys = await getAllKeys();
    const stale = keys.find((k) => k.userId === currentUserId);
    if (stale) await deleteKey(stale);
    // redirect user to bind flow
  }
}
```

## Platform notes

- Android requires a foreground `Activity` for binding and signing calls.
- iOS requires an active `UIWindowScene`/`ASPresentationAnchor` for binding and signing calls.
- Journey callback execution follows native SDK behavior on both platforms.
- Key material generated during binding never leaves the device.
- PIN prompt sequencing is controlled by native SDK flow behavior. Prompt counts and prompt semantics may differ by platform.

### Built-in authentication UI

The package ships with the native SDK's default UI for each authenticator type:

| Authenticator (server-configured) | UI shown                                                               |
| --------------------------------- | ---------------------------------------------------------------------- |
| `BIOMETRIC_ONLY`                  | System biometric prompt (Android `BiometricPrompt` / iOS `LAContext`). |
| `BIOMETRIC_ALLOW_FALLBACK`        | Biometric prompt with device-credential fallback.                      |
| `APPLICATION_PIN`                 | SDK-built PIN entry dialog.                                            |
| `NONE`                            | No UI; keys are generated without user prompt.                         |

When multiple registered keys exist for a `signForJourney` operation, the SDK presents a built-in picker dialog so the user can choose which key to sign with.

The authenticator type is configured on the AM Journey node, not from JavaScript.

## Security notes

- Private keys are stored in platform-secure enclaves (Android Keystore / iOS Secure Enclave) and never exported.
- Biometric gating is enforced at the OS level when the `biometric` authenticator is selected.
- Signed JWT proofs are generated on-device and submitted as part of the Journey callback flow.

## License

MIT
