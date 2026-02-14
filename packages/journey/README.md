<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

# React Native Journey (`@ping-identity/rn-journey`)

Native-backed Journey orchestration for React Native, with Android-first maturity and iOS follow-up parity.

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
- No required Provider pattern (optional `JourneyProvider` is available for multi-screen shared state).
- Multi-client support is explicit (`journey(...)` creates isolated native runtime instances).
- Shared contracts come from `@ping-identity/rn-types` (including `GenericError`, `Node`, and callback shapes).

## Architecture (Android-first)

### Runtime flow

1. JS creates a Journey client with `journey(config, modules?)`.
2. Native instance is created and bound to an internal journey id.
3. JS calls `start(journeyName)` or `resume(uri)`.
4. Native returns a node payload (`ContinueNode`, `SuccessNode`, `ErrorNode`, `FailureNode`).
5. For `ContinueNode`, JS renders callbacks and submits input with `next({ callbacks: [...] })`.
6. Native applies callback values, progresses the flow, and returns the next node.
7. On success, JS can fetch user session via `user()` and end session via `logoutUser()`.

### Android module layout

- `RNPingJourneyModule.kt`: TurboModule entry point.
- `RNPingJourneyClassicModule.kt`: legacy bridge entry point.
- `RNPingJourneyCommon.kt`: shared orchestration/state for both bridges.
- `JourneyConfigParser.kt`: config parsing and validation.
- `JourneyClientFactory.kt`: native workflow creation + logger/storage composition.
- `JourneyNodeMapper.kt`: node/callback payload mapping to JS.
- `JourneyCallbackValueApplier.kt`: callback mutation rules and validation.
- `JourneyErrorCodes.kt` + `JourneyErrorMapper.kt`: stable `GenericError`-aligned rejections.

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
  JourneyClient,
  JourneyConfig,
  JourneyFormResult,
  JourneyFormValues,
  JourneyModules,
  JourneyNode,
  JourneyNextInput,
  JourneyNormalizedField,
  JourneyError,
} from '@ping-identity/rn-journey';
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

### `useJourneyForm(node, options?)`

Headless form helper for callback-driven UI.

- Derives `fields` from the active node.
- Tracks `values` keyed by normalized field id.
- Derives submit plan (`input`, `canSubmit`, `issues`) using `buildNextInput`.
- Exposes helper actions (`setValue`, `setValues`, `clearValue`, `reset`, `buildInput`, `getField`).
- Does not render UI and does not auto-run device profile or polling integrations.

### `normalizeCallbacks(node)`

Returns a normalized callback field list for generic UI rendering.

- Stable `id` format: `<type>:<typeIndex>`
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
const [node, actions] = useJourney(client);
const form: JourneyFormResult = useJourneyForm(node);

if (node?.type === 'ContinueNode') {
  form.setValues({
    'NameCallback:0': 'demo-user',
    'PasswordCallback:0': 'demo-password',
  });

  if (form.canSubmit) {
    await actions.next(form.input);
  }
}
```

Use `index` when a node has multiple callbacks of the same `type`.

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

## Callback Matrix (Android)

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
| `SelectIdPCallback` and related IdP callbacks | Supported with additional module | Integration required |
| `ReCaptcha*` callbacks | Supported with additional module | Integration required |
| `Binding*` callbacks | Supported with additional module | Integration required |

### Unknown callbacks

- Unknown callback types are still surfaced to JS with opaque metadata (`type`, `opaque`, `nativeClass`).
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
- Callback mutation tests for all core Android callback families listed in the matrix.

Recommended release gate for Android-first milestone:

1. `yarn workspace @ping-identity/rn-journey build`
2. `yarn workspace @ping-identity/rn-journey test`
3. `./gradlew :ping-identity_rn-journey:compileDebugKotlin`
4. `./gradlew :ping-identity_rn-journey:testDebugUnitTest`

## Platform Status

- Android: primary implementation target for this milestone.
- iOS: existing bridge available; callback parity hardening and lifecycle parity remain follow-up work.
