<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native OATH

Native-backed OATH TOTP and HOTP one-time password management for React Native.

## Table of contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Supported URI schemes](#supported-uri-schemes)
- [API reference](#api-reference)
- [Error handling](#error-handling)

## Overview

OATH (Open Authentication) is the standard behind time-based (TOTP) and counter-based (HOTP) one-time passwords. This package provides a handle-based client for managing OATH credentials — including registration, storage, lifecycle, and code generation — on both iOS and Android.

Key characteristics:

- Credentials are stored in the native OATH store — the shared secret never crosses the bridge.
- Each call to `createOathClient` creates an independent native session; multiple clients can coexist.
- The client must be closed with `close()` when it is no longer needed to release native resources.

## Installation

```bash
yarn add @ping-identity/rn-oath
cd ios && pod install
```

Optional integrations:

```bash
yarn add @ping-identity/rn-logger   # JS/native log channel
yarn add @ping-identity/rn-storage  # custom credential storage backend
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

### With policy evaluator

By default the native SDK enforces both `biometricAvailable` and `deviceTampering` policies. Use `configureOathPolicyEvaluator` to customise which policies are enforced.

```ts
import {
  createOathClient,
  configureOathPolicyEvaluator,
} from '@ping-identity/rn-oath';

const evaluator = configureOathPolicyEvaluator({
  policies: [{ kind: 'biometricAvailable' }, { kind: 'deviceTampering' }],
});

const client = await createOathClient({ policyEvaluator: evaluator });

try {
  const credentials = await client.getCredentials();
  console.log('Stored credentials:', credentials.length);
} finally {
  await client.close();
}
```

### With all configuration options

```ts
import {
  createOathClient,
  configureOathPolicyEvaluator,
} from '@ping-identity/rn-oath';
import { logger } from '@ping-identity/rn-logger';
import { configureOathStorage } from '@ping-identity/rn-storage';

const log = logger({ level: 'debug' });

const storage = configureOathStorage({
  android: { fileName: 'oath', keyAlias: 'oath', strongBoxPreferred: true },
  ios: { account: 'com.example.oath', encryptor: true },
});

const evaluator = configureOathPolicyEvaluator({
  policies: [{ kind: 'biometricAvailable' }],
});

const client = await createOathClient({
  logger: log,
  timeout: 30, // seconds; omit to use the native default (15 s)
  enableCredentialCache: true,
  encryptionEnabled: true, // iOS-only; silently ignored on Android
  storage,
  policyEvaluator: evaluator,
});

try {
  const credentials = await client.getCredentials();
  console.log('Stored credentials:', credentials.length);
} finally {
  await client.close();
}
```

## Supported URI schemes

`addCredentialFromUri` accepts two URI schemes, both parsed natively by the underlying SDK:

| Scheme            | Type                 | Example                                                                                                          |
| ----------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `otpauth://totp/` | TOTP (time-based)    | `otpauth://totp/Issuer:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Issuer&algorithm=SHA1&digits=6&period=30` |
| `otpauth://hotp/` | HOTP (counter-based) | `otpauth://hotp/Issuer:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Issuer&algorithm=SHA1&digits=6&counter=0` |
| `mfauth://totp/`  | TOTP (Ping alias)    | `mfauth://totp/Issuer:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Issuer&algorithm=SHA1&digits=6&period=30`  |
| `mfauth://hotp/`  | HOTP (Ping alias)    | `mfauth://hotp/Issuer:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Issuer&algorithm=SHA1&digits=6&counter=0`  |

All schemes carry OATH parameters directly as query components. The `mfauth://` scheme is a Ping-specific alias for `otpauth://` and supports the same `totp` and `hotp` types.

## API reference

```ts
import {
  createOathClient,
  configureOathPolicyEvaluator,
} from '@ping-identity/rn-oath';
import type {
  OathClient,
  OathClientConfig,
  OathCodeInfo,
  OathCredential,
  OathError,
  OathErrorCode,
  OathMfaPolicy,
  OathPolicyEvaluatorConfig,
  OathPolicyEvaluatorHandle,
  OathStorageHandle,
} from '@ping-identity/rn-oath';

function createOathClient(config?: OathClientConfig): Promise<OathClient>;

function configureOathPolicyEvaluator(
  config: OathPolicyEvaluatorConfig,
): OathPolicyEvaluatorHandle;

interface OathClientConfig {
  logger?: LoggerInstance; // optional; must be from @ping-identity/rn-logger
  timeout?: number; // seconds; delegates to native SDK default (15 s) when omitted
  enableCredentialCache?: boolean; // default: false on both platforms
  encryptionEnabled?: boolean; // iOS-only; delegates to native default (true) when omitted; ignored on Android
  storage?: OathStorageHandle; // optional; handle from configureOathStorage() in @ping-identity/rn-storage
  policyEvaluator?: OathPolicyEvaluatorHandle; // optional; handle from configureOathPolicyEvaluator()
}

interface OathPolicyEvaluatorConfig {
  policies: OathMfaPolicy[]; // non-empty; valid kinds: 'biometricAvailable' | 'deviceTampering'
  loggerId?: string; // optional native logger id; inherits from OathClientConfig.logger when omitted
}

type OathMfaPolicy =
  | { kind: 'biometricAvailable' } // fails when no biometric hardware or no enrolled credentials
  | { kind: 'deviceTampering' }; // fails when root/jailbreak score meets the server-configured threshold

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

interface OathCodeInfo {
  code: string;
  timeRemaining: number; // seconds remaining in TOTP window; -1 for HOTP
  counter: number; // HOTP counter after generation; -1 for TOTP
  progress: number; // fraction of TOTP period elapsed (0.0–1.0); 0.0 for HOTP
  totalPeriod: number; // TOTP period in seconds; 0 for HOTP
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

| Code                          | Platform | Description                                                                                                                |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `OATH_INVALID_URI`            | Both     | The provided `otpauth://` URI could not be parsed.                                                                         |
| `OATH_INVALID_PARAMETER`      | Both     | A method argument has an invalid value.                                                                                    |
| `OATH_MISSING_PARAMETER`      | iOS only | A required method argument was not provided.                                                                               |
| `OATH_CREDENTIAL_NOT_FOUND`   | Both     | No credential with the given ID exists in the native store.                                                                |
| `OATH_CREDENTIAL_LOCKED`      | Both     | The credential is locked by a device policy; code generation is not allowed.                                               |
| `OATH_DUPLICATE_CREDENTIAL`   | Both     | A credential with the same ID already exists in the native store.                                                          |
| `OATH_CODE_GENERATION_FAILED` | Both     | The native SDK could not generate a code for this credential.                                                              |
| `OATH_POLICY_VIOLATION`       | Both     | The operation was blocked by a platform security policy.                                                                   |
| `OATH_INITIALIZATION_FAILED`  | Both     | The native OATH session could not be created during `createOathClient`.                                                    |
| `OATH_CLEANUP_FAILED`         | iOS only | Native cleanup failed internally. Not thrown from `close()` — iOS always resolves `close()` regardless of cleanup outcome. |
| `OATH_STORAGE_FAILURE`        | Both     | The native credential store encountered an unspecified I/O error.                                                          |
| `OATH_STORAGE_CORRUPTED`      | iOS only | Stored credential data is corrupted and cannot be read.                                                                    |
| `OATH_STORAGE_ACCESS_DENIED`  | iOS only | The app does not have permission to access the native credential store.                                                    |
| `OATH_STATE_ERROR`            | Both     | A method was called after `close()`, or the client is in an unexpected internal state.                                     |
| `OATH_UNKNOWN_ERROR`          | Both     | An unexpected error occurred that does not map to a specific code.                                                         |

---

© Copyright 2025-2026 Ping Identity Corporation. All Rights Reserved
