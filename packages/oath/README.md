<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native OATH

Native-backed OATH TOTP and HOTP token management for React Native, powered by the Ping Identity native SDK.

## Table of contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick start](#quick-start)
- [API reference](#api-reference)
- [Error handling](#error-handling)
- [Platform notes](#platform-notes)

## Overview

OATH (Open Authentication) is the standard behind time-based (TOTP) and counter-based (HOTP) one-time passwords. This package wraps the native Ping Identity OATH SDK on both iOS and Android, exposing a handle-based client that manages credential storage, lifecycle, and code generation.

Key characteristics:

- Credentials are stored in the native OATH store — the shared secret never crosses the bridge.
- Each call to `createOathClient` creates an independent native session; multiple clients can coexist.
- The client must be closed with `close()` when it is no longer needed to release native resources.

## Installation

```bash
yarn add @ping-identity/rn-oath
cd ios && pod install
```

Optional logging integration:

```bash
yarn add @ping-identity/rn-logger
```

## Quick start

### Basic usage

```ts
import { createOathClient } from '@ping-identity/rn-oath';

// 1. Initialise a native OATH session
const client = await createOathClient();

try {
  // 2. Register a credential from an otpauth:// URI
  const credential = await client.addCredentialFromUri(
    'otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PBZ&issuer=Example',
  );

  // 3. Generate an OTP code
  const code = await client.generateCode(credential.id);
  console.log('OTP:', code);

  // 4. Generate a code with timing metadata (TOTP only)
  const info = await client.generateCodeWithValidity(credential.id);
  console.log(`OTP: ${info.code} — valid for ${info.timeRemaining}s`);
} finally {
  // 5. Release native resources when done
  await client.close();
}
```

### With logger

```ts
import { createOathClient } from '@ping-identity/rn-oath';
import { logger } from '@ping-identity/rn-logger';

const log = logger({ level: 'debug' });

const client = await createOathClient({ logger: log });

try {
  const credentials = await client.getCredentials();
  console.log('Stored credentials:', credentials.length);
} finally {
  await client.close();
}
```

### With all configuration options

```ts
import { createOathClient } from '@ping-identity/rn-oath';
import { logger } from '@ping-identity/rn-logger';

const log = logger({ level: 'debug' });

const client = await createOathClient({
  logger: log,
  timeout: 30, // seconds; omit to use the native default (15 s)
  enableCredentialCache: true,
  encryptionEnabled: true, // iOS-only; silently ignored on Android
});

try {
  const credentials = await client.getCredentials();
  console.log('Stored credentials:', credentials.length);
} finally {
  await client.close();
}
```

## API reference

```ts
import { createOathClient } from '@ping-identity/rn-oath';
import type {
  OathClient,
  OathClientConfig,
  OathCodeInfo,
  OathCredential,
  OathError,
  OathErrorCode,
} from '@ping-identity/rn-oath';

function createOathClient(config?: OathClientConfig): Promise<OathClient>;

interface OathClientConfig {
  logger?: LoggerInstance; // optional; must be from @ping-identity/rn-logger
  timeout?: number; // seconds; default: 15 (native SDK default)
  enableCredentialCache?: boolean; // default: false on both platforms
  encryptionEnabled?: boolean; // iOS-only; default: true on iOS; ignored on Android
}

interface OathClient {
  addCredentialFromUri(uri: string): Promise<OathCredential>;
  getCredential(credentialId: string): Promise<OathCredential | null>;
  getCredentials(): Promise<OathCredential[]>;
  saveCredential(credential: OathCredential): Promise<OathCredential>;
  deleteCredential(credentialId: string): Promise<boolean>;
  generateCode(credentialId: string): Promise<string>;
  generateCodeWithValidity(credentialId: string): Promise<OathCodeInfo>;
  close(): Promise<void>;
}
```

## Error handling

All rejected promises use the `OathError` shape (alias for `GenericError` from `@ping-identity/rn-types`):

```ts
try {
  const client = await createOathClient();
  const code = await client.generateCode('my-credential-id');
} catch (err) {
  const error = err as OathError;
  console.error(error.type, error.error, error.message);
}
```

### Error codes

| Code                          | Description                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `OATH_INVALID_URI`            | The provided `otpauth://` URI could not be parsed.                                     |
| `OATH_INVALID_PARAMETER`      | A method argument has an invalid value.                                                |
| `OATH_MISSING_PARAMETER`      | A required method argument was not provided.                                           |
| `OATH_URI_FORMATTING`         | The URI is structurally valid but contains a malformed field.                          |
| `OATH_CREDENTIAL_NOT_FOUND`   | No credential with the given ID exists in the native store.                            |
| `OATH_CREDENTIAL_LOCKED`      | The credential is locked by a device policy; code generation is not allowed.           |
| `OATH_DUPLICATE_CREDENTIAL`   | A credential with the same ID already exists in the native store.                      |
| `OATH_CODE_GENERATION_FAILED` | The native SDK could not generate a code for this credential.                          |
| `OATH_POLICY_VIOLATION`       | The operation was blocked by a platform security policy.                               |
| `OATH_INITIALIZATION_FAILED`  | The native OATH session could not be created during `createOathClient`.                |
| `OATH_CLEANUP_FAILED`         | Native resources could not be fully released during `close`.                           |
| `OATH_STORAGE_FAILURE`        | The native credential store encountered an unspecified I/O error.                      |
| `OATH_STORAGE_CORRUPTED`      | Stored credential data is corrupted and cannot be read.                                |
| `OATH_STORAGE_ACCESS_DENIED`  | The app does not have permission to access the native credential store.                |
| `OATH_STATE_ERROR`            | A method was called after `close()`, or the client is in an unexpected internal state. |
| `OATH_UNKNOWN_ERROR`          | An unexpected error occurred that does not map to a specific code.                     |

---

© Copyright 2025-2026 Ping Identity Corporation. All Rights Reserved
