[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Protect

The Ping Protect library integrates PingOne Protect behavioral data collection into your React Native application. Acting as a plugin for the `davinci` module, it runs silent background risk signals collection during a DaVinci flow so that your backend can make an informed authentication decision.

## Table of contents

- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
  - [Automatic initialization with the ProtectLifecycle module](#automatic-initialization-with-the-protectlifecycle-module)
  - [Manual initialization](#manual-initialization)
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

### Automatic initialization with the ProtectLifecycle module

Pass `modules.protect` to `createDaVinciClient` to wire the Protect SDK into the DaVinci workflow lifecycle automatically. The native SDK initializes on workflow start, resumes behavioral data collection at the beginning of each node, and pauses it on success — without any manual `startProtect()` call.

```ts
import { createDaVinciClient } from '@ping-identity/rn-davinci';
import { logger } from '@ping-identity/rn-logger';

const client = createDaVinciClient({
  logger: logger({ level: 'debug' }),
  modules: {
    oidc: {
      clientId: 'rn-client',
      discoveryEndpoint:
        'https://auth.pingone.com/<env-id>/as/.well-known/openid-configuration',
      redirectUri: 'com.example.app://callback',
      scopes: ['openid'],
    },
    protect: {
      envId: 'your-pingone-environment-id',
      isBehavioralDataCollection: true,
      pauseBehavioralDataOnSuccess: true,
      resumeBehavioralDataOnStart: true,
      logger: logger({ level: 'debug' }), // optional — scoped to Protect operations
    },
  },
});
```

All `protect` fields are optional. If `@ping-identity/rn-protect` is not installed, the `modules.protect` value is silently ignored at runtime.

When the lifecycle module is active, call `collectProtect` from `@ping-identity/rn-protect` before advancing the flow:

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

When `modules.protect` is configured on `createDaVinciClient`, import `collectProtect` from `@ping-identity/rn-protect` and pass the DaVinci client:

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
import { collectProtect } from '@ping-identity/rn-protect';

const { node, next } = useDaVinci(daVinciClient);
const form = useDaVinciForm(node, {
  handledCollectorTypes: new Set(['PROTECT']),
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
import { collectProtect } from '@ping-identity/rn-protect';

const daVinciClient = createDaVinciClient({
  modules: {
    oidc: {
      /* ... */
    },
    protect: {
      envId: 'your-pingone-environment-id',
      resumeBehavioralDataOnStart: true,
    },
  },
});

function LoginScreen() {
  const { node, next } = useDaVinci(daVinciClient);
  const form = useDaVinciForm(node, {
    handledCollectorTypes: new Set(['PROTECT']),
  });

  useEffect(() => {
    if (node?.type !== 'ContinueNode') return;
    const hasProtect = node.collectors.some((c) => c.type === 'PROTECT');
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

## API reference

```ts
import {
  collectProtect,
  startProtect,
  pauseBehavioralData,
  resumeBehavioralData,
} from '@ping-identity/rn-protect';
import type {
  ProtectConfig,
  ProtectErrorCode,
} from '@ping-identity/rn-protect';

function collectProtect(daVinci: DaVinciInstance): Promise<void>;
function startProtect(config?: ProtectConfig): Promise<void>;
function pauseBehavioralData(options?: {
  logger?: LoggerInstance;
}): Promise<void>;
function resumeBehavioralData(options?: {
  logger?: LoggerInstance;
}): Promise<void>;

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

- `PROTECT_INITIALIZE_ERROR` — the native Protect SDK failed to initialize, pause, or resume.
- `PROTECT_COLLECT_ERROR` — the native Protect SDK failed to collect signals.
- `PROTECT_COLLECTOR_NOT_FOUND` — no active PROTECT collector was found for the current DaVinci flow.

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
