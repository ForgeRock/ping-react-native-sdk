[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Protect

The Ping Protect library integrates PingOne Protect behavioral data collection into your React Native application. Acting as a plugin for the `davinci` module, it runs silent background risk signals collection during a DaVinci flow so that your backend can make an informed authentication decision.

## Table of contents

- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
  - [DaVinci lifecycle integration](#davinci-lifecycle-integration)
  - [Manual initialization](#manual-initialization)
  - [Use with Journey](#use-with-journey)
- [API reference](#api-reference)
- [Errors](#errors)

## Overview

When a DaVinci flow includes a `PROTECT` collector, the native PingOne Protect SDK collects behavioral and device signals in the background. This library bridges that native collection to your React Native app — call `collectProtect(daVinci)` from `@ping-identity/rn-protect` before advancing the flow, and the collected payload is forwarded automatically on the next `daVinci.next({})` call.

No foreground window, activity, or user interaction is required. Collection runs entirely in the background.

## Installation

> **Note:** This module requires that `@ping-identity/rn-core` and `@ping-identity/rn-davinci` are already installed.

```bash
yarn add @ping-identity/rn-protect
# iOS only
cd ios && pod install
```

Optional integration:

```bash
yarn add @ping-identity/rn-logger
```

---

## Usage

### DaVinci lifecycle integration

Initialize Protect before the first DaVinci operation. `createDaVinciClient` remains responsible only for DaVinci configuration; `startProtect` owns Protect initialization and lifecycle registration.

```ts
import { createDaVinciClient } from '@ping-identity/rn-davinci';
import { startProtect } from '@ping-identity/rn-protect';
import { logger } from '@ping-identity/rn-logger';

const protectLogger = logger({ level: 'debug' });

await startProtect({
  envId: 'your-pingone-environment-id',
  isBehavioralDataCollection: true,
  pauseBehavioralDataOnSuccess: true,
  resumeBehavioralDataOnStart: true,
  logger: protectLogger,
});

const client = createDaVinciClient({
  logger: protectLogger,
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

await client.start();
```

The DaVinci client may be created before `startProtect`, because configuration is lazy, but `startProtect` must resolve before `client.start()` or any other DaVinci operation.

When the lifecycle integration is active, call `collectProtect` from `@ping-identity/rn-protect` before advancing the flow:

```ts
import { collectProtect } from '@ping-identity/rn-protect';

await collectProtect(daVinci);
await daVinci.next({});
```

---

### Manual initialization

Use this path when you need direct control over initialization timing, or when using Protect outside a DaVinci flow.

### 1. Initialize the Protect SDK

```ts
import { startProtect } from '@ping-identity/rn-protect';

await startProtect({
  envId: 'your-pingone-environment-id',
  isBehavioralDataCollection: true,
  resumeBehavioralDataOnStart: true,
});
```

With optional logger:

```ts
import { startProtect } from '@ping-identity/rn-protect';
import { logger } from '@ping-identity/rn-logger';

const protectLogger = logger({ level: 'debug' });

await startProtect({
  envId: 'your-pingone-environment-id',
  logger: protectLogger,
});
```

### 2. Collect for a DaVinci flow

Import `collectProtect` from `@ping-identity/rn-protect` and pass the DaVinci client:

```ts
import { collectProtect } from '@ping-identity/rn-protect';

try {
  await collectProtect(daVinci);
  const node = await daVinci.next({});
} catch (error) {
  // See Errors section
}
```

### 3. Pause and resume behavioral data collection

Control behavioral data collection manually to mirror the `ProtectLifecycleModule` behavior from the native SDK. Call `pauseBehavioralData()` after a successful flow and `resumeBehavioralData()` when a new flow starts.

```ts
import {
  pauseBehavioralData,
  resumeBehavioralData,
} from '@ping-identity/rn-protect';

// After a successful authentication flow:
await pauseBehavioralData();

// At the start of a new authentication flow:
await resumeBehavioralData();
```

With an optional logger:

```ts
await pauseBehavioralData({ logger: protectLogger });
await resumeBehavioralData({ logger: protectLogger });
```

> If you set `resumeBehavioralDataOnStart: true` in `startProtect`, it calls `resumeBehavioralData()` automatically after initialization.

### 4. Use with `useDaVinciForm`

Pass `handledCollectorTypes` so PROTECT collectors are excluded from blocking submit issues. Without this, `buildNextInput` returns `canSubmit: false` when a PROTECT collector is present.

```ts
import { useDaVinci, useDaVinciForm } from '@ping-identity/rn-davinci';
import {
  collectProtect,
  protectCollectorType,
} from '@ping-identity/rn-protect';

const { node, next } = useDaVinci(daVinciClient);
const form = useDaVinciForm(node, {
  handledCollectorTypes: new Set([protectCollectorType]),
});

// Before submitting the form, run collection:
await collectProtect(daVinciClient);

if (form.canSubmit) {
  await next(form.input);
}
```

### 5. Full example

```tsx
import React, { useEffect } from 'react';
import {
  useDaVinci,
  useDaVinciForm,
  createDaVinciClient,
} from '@ping-identity/rn-davinci';
import {
  collectProtect,
  protectCollectorType,
} from '@ping-identity/rn-protect';

const daVinciClient = createDaVinciClient({
  modules: {
    oidc: {
      /* ... */
    },
  },
});

function LoginScreen() {
  const { node, next } = useDaVinci(daVinciClient);
  const form = useDaVinciForm(node, {
    handledCollectorTypes: new Set([protectCollectorType]),
  });

  useEffect(() => {
    if (node?.type !== 'ContinueNode') return;
    const hasProtect = node.collectors.some(
      (c) => c.type === protectCollectorType,
    );
    if (!hasProtect) return;

    collectProtect(daVinciClient).catch(console.error);
  }, [node]);

  async function handleSubmit() {
    if (!form.canSubmit) return;
    await next(form.input);
  }

  // ... render form fields
}
```

---

## Use with Journey

When a Journey tree includes a `PingOneProtectInitializeCallback` or a
`PingOneProtectEvaluationCallback`, both callbacks surface in the node payload
with `executionMode: 'integration_required'`: they are not advanced by
`next(...)` directly. The app executes them with this module's Journey-scoped
functions, which run the native callbacks against the current Journey
instance, then advances the flow.

### Register the callbacks at startup

Call `startProtectForJourney()` once at app startup, before the first Journey
`start()` or `next()`:

```ts
import { startProtectForJourney } from '@ping-identity/rn-protect';

await startProtectForJourney();
```

`startProtectForJourney()` does not initialize Protect, so the initialize
callback in the journey still supplies the configuration. It is safe to call on
Android, where it only resolves.

### Initialize callback

`PingOneProtectInitializeCallback` is executed with
`initializeProtectForJourney(journey)`. The function takes no configuration
argument by design: the native callback carries the journey's own configuration. A journey whose initialize callback
carries no parseable configuration fails loudly as `PROTECT_INITIALIZE_ERROR`.
There is no app-configuration fallback: substituting the app's own
configuration would silently initialize PingOneSignals against the app's
environment instead of the journey's.

### Evaluation callback

`PingOneProtectEvaluationCallback` is executed with
`collectProtectForJourney(journey, { index })`. The optional `index` selects
among multiple evaluation callbacks. The collected risk signal is written natively into the
resolved callback, or into its sibling hidden-value fields on
MetadataCallback-derived journeys.

### Journey flow example

```ts
import { callbackType } from '@ping-identity/rn-types';
import { useJourney, useJourneyForm } from '@ping-identity/rn-journey';
import {
  collectProtectForJourney,
  initializeProtectForJourney,
} from '@ping-identity/rn-protect';

const [node, actions] = useJourney(client);
const form = useJourneyForm(node, {
  handledCallbackTypes: new Set([
    callbackType.PingOneProtectInitializeCallback,
    callbackType.PingOneProtectEvaluationCallback,
  ]),
});

for (const field of form.fields) {
  if (field.ref.type === callbackType.PingOneProtectInitializeCallback) {
    await initializeProtectForJourney(journey);
  }
  if (field.ref.type === callbackType.PingOneProtectEvaluationCallback) {
    await collectProtectForJourney(journey, { index: field.ref.typeIndex });
  }
}

if (form.canSubmit) {
  await actions.next(form.input);
}
```

The Journey client returned by `createJourneyClient` satisfies
`JourneyInstance`, which is what both functions accept. Declaring both
callback types in `handledCallbackTypes` keeps `buildNextInput` from emitting
blocking `INTEGRATION_REQUIRED` issues for them, and skips the managed
hidden-value fields so a natively written signal is not overwritten with
stale defaults.

### Error handling for the Journey path

| Code                         | Type             | Meaning                                                       | Remedy                                                                       |
| ---------------------------- | ---------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `PROTECT_NOT_INITIALIZED`    | `state_error`    | Protect was not initialized by this module.                   | Call `initializeProtectForJourney()` before collecting.                      |
| `PROTECT_CALLBACK_NOT_FOUND` | `state_error`    | No Protect callback at the requested index.                   | Check the journey; verify the `index` option.                                |
| `PROTECT_ARGUMENT_ERROR`     | `argument_error` | Blank journey id.                                             | Fix the arguments before calling again.                                      |
| `PROTECT_COLLECT_ERROR`      | `auth_error`     | Native risk-signal collection failed.                         | See the note below on advancing after failure.                               |
| `PROTECT_INITIALIZE_ERROR`   | `auth_error`     | The initialize callback failed to configure or start Protect. | Verify the journey emits a valid initialize callback and check tenant setup. |

After a collect failure, the native callback has already written the failure
into its `clientError` input, so calling `next()` reports the failure to the
server. Whether to advance and let the journey decide, or to surface the error in
the app instead, is a decision to validate against your tenant; the native
sample-app example surfaces the error and does not advance.

The not-initialized guard tracks initialization performed through this module
only. Initialization done by any other path is invisible to the guard, and a
Journey collect after such an initialization rejects `PROTECT_NOT_INITIALIZED`.

### Once-only initialization ordering

Native Protect initialization is once-only. Whichever initialize path succeeds
first wins. A later successful initialize from the other path applies only its
behavioral-data resume/pause; its identity configuration (envId, customHost,
deviceAttributesToIgnore, consoleLogEnabled, lazyMetadata) is not applied, and
the bridge logs a warning naming both paths.

Apps that use Protect through Journey must not call `startProtect()`: initialize
configuration is server-driven, so the app cannot reproduce the tree's
configuration reliably; call `startProtectForJourney()` at startup and let the
journey initialize through `initializeProtectForJourney()` instead.

### Marketplace and legacy trees

Journeys that emit Protect callbacks as a `MetadataCallback` with
`_type: "PingOneProtect"` are handled the same way: call
`startProtectForJourney()` at startup, then execute the initialize
callback with `initializeProtectForJourney()` (and the evaluation callback
with `collectProtectForJourney()`), as described above. The native callback
carries the server configuration in this form as well, and
`initializeProtectForJourney()` both initializes Protect and applies it.

---

## API reference

```ts
import {
  collectProtect,
  collectProtectForJourney,
  initializeProtectForJourney,
  startProtect,
  startProtectForJourney,
  pauseBehavioralData,
  resumeBehavioralData,
} from '@ping-identity/rn-protect';
import type {
  DaVinciInstance,
  JourneyInstance,
  LoggerInstance,
} from '@ping-identity/rn-types';
import type {
  ProtectConfig,
  ProtectErrorCode,
  ProtectJourneyInitializeOptions,
  ProtectJourneyOptions,
  ProtectJourneyResult,
} from '@ping-identity/rn-protect';

function collectProtect(daVinci: DaVinciInstance): Promise<void>;
function startProtect(config?: ProtectConfig): Promise<void>;
function pauseBehavioralData(options?: {
  logger?: LoggerInstance;
}): Promise<void>;
function resumeBehavioralData(options?: {
  logger?: LoggerInstance;
}): Promise<void>;

function initializeProtectForJourney(
  journey: JourneyInstance,
  options?: ProtectJourneyInitializeOptions,
): Promise<ProtectJourneyResult>;
function collectProtectForJourney(
  journey: JourneyInstance,
  options?: ProtectJourneyOptions,
): Promise<ProtectJourneyResult>;

interface ProtectConfig {
  /** Optional logger instance from @ping-identity/rn-logger. */
  logger?: LoggerInstance;
  /** PingOne environment ID for the Protect SDK. */
  envId?: string;
  /** Whether to enable behavioral data collection. Default: true. */
  isBehavioralDataCollection?: boolean;
  /** Whether to use lazy metadata loading. Default: false. */
  isLazyMetadata?: boolean;
  /** Custom host URL for the Protect SDK. */
  customHost?: string;
  /** Whether to enable console logging inside the Protect SDK. Default: false. */
  isConsoleLogEnabled?: boolean;
  /** Device attributes to exclude from signal collection. */
  deviceAttributesToIgnore?: string[];
  /** When true, startProtect() resumes behavioral data collection automatically. Default: false. */
  resumeBehavioralDataOnStart?: boolean;
  /** Documents intent to pause after success — call pauseBehavioralData() manually. Default: false. */
  pauseBehavioralDataOnSuccess?: boolean;
}

interface ProtectJourneyOptions {
  /** Optional logger instance from @ping-identity/rn-logger. */
  logger?: LoggerInstance;
  /** Zero-based index of the evaluation callback when the node carries more than one. Default: 0. */
  index?: number;
}

interface ProtectJourneyInitializeOptions {
  /** Optional logger instance from @ping-identity/rn-logger. */
  logger?: LoggerInstance;
}

interface ProtectJourneyResult {
  /** Discriminated success outcome; the risk signal is written natively into the Journey callback and is never returned to JavaScript. */
  type: 'success';
}
```

---

## Errors

All promise rejections throw a `ProtectError` instance, which extends `PingError extends Error`. Use `instanceof` to narrow the error type:

```ts
import { collectProtect, ProtectError } from '@ping-identity/rn-protect';

try {
  await collectProtect(daVinci);
} catch (err) {
  if (err instanceof ProtectError) {
    console.log(err.code, err.message);
  }
}
```

Stable error codes:

- `PROTECT_INITIALIZE_ERROR`: the native Protect SDK failed to initialize, pause, or resume.
- `PROTECT_COLLECT_ERROR`: the native Protect SDK failed to collect signals.
- `PROTECT_COLLECTOR_NOT_FOUND`: no active PROTECT collector was found for the current DaVinci flow.
- `PROTECT_NOT_INITIALIZED`: Protect was not initialized by this module before a Journey collect; call `initializeProtectForJourney()` first.
- `PROTECT_CALLBACK_NOT_FOUND`: no Journey Protect callback at the requested index.
- `PROTECT_ARGUMENT_ERROR`: the Journey arguments were invalid (blank journey id, non-integer `index`).

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
