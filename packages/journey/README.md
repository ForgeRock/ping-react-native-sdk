<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

# React Native Journey (`@ping-identity/rn-journey`)

Native-backed Journey orchestration for React Native with Android and iOS parity for core Journey callbacks, shared error contracts, and OIDC composition.

## Install

```bash
yarn add @ping-identity/rn-journey
cd ios && pod install
```

## Migration from Legacy Package Name

```ts
// Before
import { journey, useJourney } from '@react-native-pingidentity/journey';

// After
import { journey, useJourney } from '@ping-identity/rn-journey';
```

## Design Intent

- Native SDK is authoritative for Journey execution, networking, callback evaluation, and session lifecycle.
- JavaScript orchestrates flow progression (`start`, `next`, `resume`) and UI rendering for callbacks.
- Node payload exposed to JS is AM-focused (`type`, `message`, `cause`, `input`, `callbacks`) rather than native runtime internals.
- No required Provider pattern (optional `JourneyProvider` is available for multi-screen shared state).
- Multi-client support is explicit (`journey(...)` creates isolated native runtime instances).
- Shared contracts come from `@ping-identity/rn-types` (including `GenericError`, `Node`, and callback shapes).

## Architecture

### Runtime flow

1. JS creates a Journey client with `journey(config, modules?)`.
2. Native instance is created and bound to an internal journey id.
3. JS calls `start(journeyName)` or `resume(uri)`.
4. Native returns a node payload (`ContinueNode`, `SuccessNode`, `ErrorNode`, `FailureNode`).
5. For `ContinueNode`, JS renders callbacks and submits input with `next({ callbacks: [...] })`.
6. Native applies callback values, progresses the flow, and returns the next node.
7. On success, JS can fetch user session via `user()` and end session via `logoutUser()`.

### Native module layout

- Android:
  - `RNPingJourneyModule.kt`: TurboModule entry point.
  - `RNPingJourneyClassicModule.kt`: legacy bridge entry point.
  - `RNPingJourneyCommon.kt`: shared orchestration/state for both bridges.
  - `JourneyConfigParser.kt`, `JourneyClientFactory.kt`, `JourneyNodeMapper.kt`, `JourneyCallbackValueApplier.kt`, `JourneyErrorCodes.kt`, `JourneyErrorMapper.kt`
- iOS:
  - `RNPingJourney.mm`: TurboModule bridge entry point.
  - `RNPingJourneyImpl.swift`: thin bridge wrapper.
  - `RNPingJourneyCommon.swift`: shared orchestration/state.
  - `JourneyConfigParser.swift`, `JourneyClientFactory.swift`, `JourneyNodeMapper.swift`, `JourneyCallbackValueApplier.swift`, `JourneyErrorCodes.swift`, `JourneyErrorMapper.swift`

## Public API

```ts
import {
  buildNextInput,
  journey,
  JourneyProvider,
  normalizeCallbacks,
  useJourney,
  useJourneyForm,
} from '@ping-identity/rn-journey';
import type {
  JourneyBuildNextInputResult,
  JourneyCallbackType,
  JourneyClient,
  JourneyConfig,
  JourneyFormResult,
  JourneyFormValues,
  JourneyModules,
  JourneyNode,
  JourneyNextInput,
  JourneyNormalizedField,
  JourneyError,
  JourneyOidcClientHandle,
} from '@ping-identity/rn-journey';
```

For callback-type autocomplete, use shared callback constants:

```ts
import { callbackType, nativeExtensionCallbackType } from '@ping-identity/rn-types';
import type { JourneyCallbackType } from '@ping-identity/rn-journey';

const typeA: JourneyCallbackType = callbackType.NameCallback;
const typeB: JourneyCallbackType = nativeExtensionCallbackType.ConsentMappingCallback;
```

### `journey(config, modules?)`

Creates an imperative Journey client.

- `config.serverUrl` is required.
- `config.realm`, `config.cookie`, and OIDC fields are optional.
- Logger integration supports:
  - `config.logger` (JS logger instance), or
  - `config.nativeLogger` (native logger handle).
- Session storage integration supports:
  - `modules.session.storage` from `@react-native-pingidentity/storage`.
  - Current platform behavior:
    - Android: storage handle is applied to Journey Session module.
    - iOS: accepted for API parity, but custom handle binding is not yet applied (`TODO(iOS SDK parity)`).
- OIDC composition supports:
  - shorthand `config.oidcClient` from `@ping-identity/rn-oidc` (`createOidcClient(...)` output),
  - direct Journey OIDC fields on `config` (base fields plus advanced OIDC options), or
  - `modules.oidc.client` from `@ping-identity/rn-oidc` (`createOidcClient(...)` output).

OIDC source-of-truth precedence is:

1. `modules.oidc.client`
2. `config.oidcClient`
3. direct OIDC fields on `config`

### `JourneyClient`

- `init(): Promise<string>`
- `getId(): Promise<string>`
- `start(journeyName, options?): Promise<JourneyNode>`
- `next(input?): Promise<JourneyNode>`
- `resume(uri): Promise<JourneyNode>`
- `user(): Promise<JourneyUserSession | null>`
- `logoutUser(): Promise<boolean>`
- `dispose(): Promise<void>`

### `useJourney(client?)`

Returns:

```ts
const [
  node,
  { start, next, resume, user, logoutUser, dispose, loading, error }
] = useJourney(client);
```

Or with provider-scoped state (for multi-screen flows):

```tsx
<JourneyProvider client={client}>
  <AuthNavigator />
</JourneyProvider>
```

```ts
const [
  node,
  { start, next, resume, user, logoutUser, dispose, loading, error }
] = useJourney();
```

### `useJourneyForm(node)`

Headless form helper for callback-driven UI.

- Derives `fields` from the active node.
- Tracks `values` keyed by normalized field id.
- Derives submit plan (`input`, `canSubmit`, `issues`) using `buildNextInput`.
- Exposes helper actions (`setValue`, `setValues`, `clearValue`, `reset`, `buildInput`, `getField`).
- Does not render UI and does not auto-run device profile or polling integrations.

Detailed usage guide: [`USE_JOURNEY_FORM.md`](./USE_JOURNEY_FORM.md)

### `normalizeCallbacks(node)`

Returns a normalized callback field list for generic UI rendering.

- Stable `id` format: `<type>:<typeIndex>`
- `field.ref.type` is `JourneyCallbackType` (sdk-types callback union plus RN native-extension callback union)
- Preserves callback `prompt` and `message` values without forcing prompt fallback policy
- Preserves option labels/defaults from callback payload without synthesizing UI fallbacks
- Includes field `kind` (`text`, `password`, `number`, `boolean`, `choice`, `kba`, `output`)
- Includes callback `capability` (`manual`, `output_only`, `integration_required`, `unsupported`)
- Includes `defaultValue` and option metadata where available

### `buildNextInput(node, values)`

Builds a `next()` payload from normalized form values.

- Returns `{ canSubmit, input, issues }`
- Blocks submission for integration-required and unsupported callbacks
- Enforces consent/terms only when callbacks are marked `required`
- Preserves deterministic `type` + `index` callback mapping

## Usage Walkthrough

### 1. Create client

```ts
import { journey } from '@ping-identity/rn-journey';
import { logger } from '@react-native-pingidentity/logger';

const log = logger({ level: 'debug' });

const client = journey({
  serverUrl: 'https://example.com/am',
  realm: 'alpha',
  clientId: 'rn-client',
  discoveryEndpoint: 'https://example.com/am/oauth2/alpha/.well-known/openid-configuration',
  redirectUri: 'com.example.app://oauth2redirect',
  scopes: ['openid', 'profile', 'email'],
  logger: log,
});
```

### 2. Start Journey

```ts
const node = await client.start('LoginJourney', {
  forceAuth: false,
  noSession: false,
});
```

### 3. Render and submit callbacks

```ts
import { callbackType } from '@ping-identity/rn-types';

const [node, actions] = useJourney(client);
const form: JourneyFormResult = useJourneyForm(node);

const findFieldId = (type: string, typeIndex = 0): string | undefined =>
  form.fields.find(
    (field) => field.ref.type === type && field.ref.typeIndex === typeIndex
  )?.id;

if (node?.type === 'ContinueNode') {
  const nameFieldId = findFieldId(callbackType.NameCallback);
  const passwordFieldId = findFieldId(callbackType.PasswordCallback);

  if (nameFieldId) {
    form.setValue(nameFieldId, 'demo-user');
  }
  if (passwordFieldId) {
    form.setValue(passwordFieldId, 'demo-password');
  }

  const plan = form.buildInput();
  if (plan.canSubmit) {
    await actions.next(plan.input);
  }
}
```

Do not hardcode callback ids like `'NameCallback:0'`. Use `field.id` from
`form.fields`. For repeated callback types, use `field.ref.typeIndex` to target
the correct instance.

### 4. Resume suspended flow

```ts
const resumedNode = await client.resume('com.example.app://oauth2redirect?code=...');
```

### 5. Resolve session and logout

```ts
const session = await client.user();
await client.logoutUser();
await client.dispose();
```

## Callback Matrix (Android + iOS core parity)

| Callback | Status | Mutation Support |
|---|---|---|
| `BooleanAttributeInputCallback` | Core supported | Yes |
| `ChoiceCallback` | Core supported | Yes |
| `ConfirmationCallback` | Core supported | Yes |
| `ConsentMappingCallback` | Core supported | Yes |
| `HiddenValueCallback` | Core supported | Yes |
| `KbaCreateCallback` | Core supported | Yes |
| `MetadataCallback` | Core supported | Output-only |
| `NameCallback` | Core supported | Yes |
| `NumberAttributeInputCallback` | Core supported | Yes |
| `PasswordCallback` | Core supported | Yes |
| `PollingWaitCallback` | Core supported | Output-only |
| `StringAttributeInputCallback` | Core supported | Yes |
| `SuspendedTextOutputCallback` | Core supported | Output-only |
| `TermsAndConditionsCallback` | Core supported | Yes |
| `TextInputCallback` | Core supported | Yes |
| `TextOutputCallback` | Core supported | Output-only |
| `ValidatedCreatePasswordCallback` | Core supported | Yes |
| `ValidatedCreateUsernameCallback` | Core supported | Yes |
| `DeviceProfileCallback` | Supported with additional module | Output-only (submit via device-profile integration) |
| `PingOneProtect*` callbacks | Supported with additional module | Integration required |
| `Fido*` / `Fido2*` callbacks | Supported with additional module | Integration required |
| `SelectIdPCallback`, `RedirectCallback`, and related IdP callbacks | Supported with additional module | Integration required |
| `ReCaptcha*` callbacks | Supported with additional module | Integration required |
| `Binding*` callbacks | Supported with additional module | Integration required |

### Unknown callbacks

- Unknown callback types are surfaced to JS with their `type` (and callback payload fields when available).
- Helper submit planning (`buildNextInput`) marks unknown callback types as `unsupported`.
- `next()` only fails when mutation is requested for unsupported/integration-dependent callback types.

## Integration-Required Callback Behavior

When integration modules are missing, callback mutation fails deterministically with `GenericError`:

- `error: JOURNEY_MISSING_INTEGRATION_ERROR` for known integration-dependent callbacks.
- `error: JOURNEY_UNSUPPORTED_CALLBACK_ERROR` for unsupported callback mutation.
- `error: JOURNEY_CALLBACK_APPLY_ERROR` for malformed input payloads.

## Error Model (`GenericError`)

All promise rejections use the shared shape from `@ping-identity/rn-types`:

- `type`
- `error`
- `message`
- optional `code`
- optional `status`

### Journey error codes

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

## Logger Contract

- Logger is resolved via shared logger registry (`loggerId`) to match mature package behavior.
- Logger is applied per Journey client instance.
- Do not log sensitive callback values (passwords, OTPs, token values, secrets).

## Storage Contract

Session storage can be composed via `modules.session.storage`:

```ts
import { configureSessionStorage } from '@react-native-pingidentity/storage';
import { journey } from '@ping-identity/rn-journey';

const sessionStorage = configureSessionStorage({
  android: {
    fileName: 'journey-session',
    keyAlias: 'journey-session',
    strongBoxPreferred: true,
    cacheStrategy: 'cache_on_failure',
  },
});

const client = journey(
  { serverUrl: 'https://example.com/am' },
  { session: { storage: sessionStorage } }
);
```

If no storage client is provided, native defaults are used.

## OIDC Composition Contract

Journey can reuse an existing OIDC client from `@ping-identity/rn-oidc`:

```ts
import { createOidcClient } from '@ping-identity/rn-oidc';
import { journey } from '@ping-identity/rn-journey';

const oidcClient = createOidcClient({
  clientId: 'rn-client',
  discoveryEndpoint: 'https://example.com/am/oauth2/alpha/.well-known/openid-configuration',
  redirectUri: 'com.example.app://oauth2redirect',
  scopes: ['openid', 'profile', 'email'],
});

// Shorthand config DX
const client = journey({
  serverUrl: 'https://example.com/am',
  realm: 'alpha',
  oidcClient,
});

// Equivalent explicit module composition
const clientFromModules = journey(
  { serverUrl: 'https://example.com/am', realm: 'alpha' },
  { oidc: { client: oidcClient } }
);
```

When Journey composes with an OIDC client handle, it reuses OIDC client
configuration (for example: `openId`, `acrValues`, `state`, `nonce`,
`uiLocales`, `refreshThreshold`, `loginHint`, `display`, `prompt`, and
`additionalParameters`).

`signOutRedirectUri` is currently applied on Android. iOS native OIDC config
does not yet expose this field; see `TODO(iOS SDK parity)` notes in native code.

If you do not compose via `modules.oidc.client` or `config.oidcClient`, provide
direct OIDC fields on `JourneyConfig`.

## Security Notes

- Native SDK remains authoritative for sensitive operations.
- JS should avoid storing raw credentials/callback secrets outside ephemeral UI state.
- Do not disable TLS validation.
- Do not hard-code secrets.
- Avoid logging token/callback secret values.

## Testing Guidance

Current Journey package test strategy includes:

- JS unit tests for client lifecycle (`init`, `start`, `next`, `resume`, `user`, `logoutUser`, `dispose`).
- Android unit tests for parser, mapper, callback applier, and error mapping.
- iOS Swift tests for parser, mapper, callback applier, factory wiring, and common error behavior are present under `packages/journey/ios/Tests`.
- Current CocoaPods/Xcode schemes are not configured with a Journey test action (`xcodebuild test` on `PingJourney`/`RNPingJourney` is unavailable), so iOS tests require explicit test-target wiring in the workspace to run automatically.
- Callback mutation tests for core callback families listed in the matrix.

Recommended release gate:

1. `yarn workspace @ping-identity/rn-journey build`
2. `yarn jest --config packages/journey/jest.config.js --runInBand`
3. `./gradlew :ping-identity_rn-journey:compileDebugKotlin`
4. `./gradlew :ping-identity_rn-journey:testDebugUnitTest`
5. `yarn sample:run:ios`

## Platform Status

- Android: core callbacks and composition contracts implemented.
- iOS: core callbacks and composition contracts implemented.
- Known iOS native SDK gaps (explicitly flagged in code with `TODO(iOS SDK parity)`):
  - `sessionStorageId` is accepted for cross-platform parity, but custom storage handle binding is not yet applied; iOS currently uses PingJourney SessionModule default storage.
  - `signOutRedirectUri` is not currently exposed by iOS OIDC client config.
