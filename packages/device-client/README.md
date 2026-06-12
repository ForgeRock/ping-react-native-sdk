<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Device Client

A foundation package that provides a native-backed bridge for managing a
user's registered MFA and profile devices (OATH, Push, Bound, WebAuthn,
Profile) from React Native.

## Table of contents

- [Install](#install)
- [Prerequisites](#prerequisites)
- [Usage](#usage)
- [Logging (optional)](#logging-optional)
- [Supported device types](#supported-device-types)
- [API reference](#api-reference)
- [Errors](#errors)
- [Platform notes](#platform-notes)
- [License](#license)

## Install

> **Note:** This module requires that the `@ping-identity/rn-core` module is already set up and installed.

```bash
# Install & setup the core module
yarn add @ping-identity/rn-core
# Install the rn-device-client module
yarn add @ping-identity/rn-device-client
# If you are developing your app using iOS, run this command
cd ios && pod install
```

Optional integration packages:

```bash
yarn add @ping-identity/rn-logger
```

## Prerequisites

You need a valid SSO token from an authenticated user. In Journey apps the
token is available via `ssoToken()` on the Journey hook actions.

The following config values are **required** — there are no defaults:

| Field        | Example                           | Source                |
| ------------ | --------------------------------- | --------------------- |
| `serverUrl`  | `'https://openam.example.com/am'` | Server base URL       |
| `ssoToken`   | `session.value`                   | Journey SSO token     |
| `realm`      | `'alpha'`                         | Authentication realm  |
| `cookieName` | `'5421aeddf91aa20'`               | Session cookie header |

## Usage

`createDeviceClient` is the imperative API for managing devices. It is a
foundation-level export — no dependency on Journey, OIDC, or any provider.

```ts
import { createDeviceClient } from '@ping-identity/rn-device-client';

const client = createDeviceClient({
  serverUrl: 'https://openam.example.com/am',
  ssoToken: session.value,
  realm: 'alpha',
  cookieName: '5421aeddf91aa20',
});

const oathDevices = await client.oath.get();
await client.bound.update({ ...boundDevice, deviceName: 'My iPhone' });
await client.webAuthn.delete(webAuthnDevice);

// Optional: release native resources when you no longer need the client.
// For app-scoped clients you can skip this — the OS reclaims everything
// when the process exits.
await client.dispose();
```

The returned `DeviceClient` exposes five repositories matching the native
SDKs 1:1: `oath`, `push`, `bound`, `profile`, `webAuthn`. Each repository
has `get()`, `update(device)`, and `delete(device)`.

### Logging (optional)

```ts
import { logger } from '@ping-identity/rn-logger';

const client = createDeviceClient({
  serverUrl: 'https://openam.example.com/am',
  ssoToken: session.value,
  realm: 'alpha',
  cookieName: '5421aeddf91aa20',
  logger: logger({ level: 'debug' }),
});
```

### React hook (sample-app example)

No hook ships with this package — `createDeviceClient` is imperative by
design so the foundation stays React-agnostic. For a reference React
hook that wires Journey's SSO token into `createDeviceClient`, see
[`PingSampleApp/src/hooks/useDevices.ts`](../../PingSampleApp/src/hooks/useDevices.ts).

## Supported device types

| Kind     | JS key     | Description                                    |
| -------- | ---------- | ---------------------------------------------- |
| OATH     | `oath`     | TOTP/HOTP authenticator apps.                  |
| Push     | `push`     | Push-notification devices.                     |
| Bound    | `bound`    | Device-binding (cryptographic) MFA.            |
| WebAuthn | `webAuthn` | FIDO2 / WebAuthn credentials.                  |
| Profile  | `profile`  | Tracked device profiles (metadata / location). |

All timestamps (`createdDate`, `lastAccessDate`, `lastSelectedDate`) are
normalized to **milliseconds since epoch** so you can pass them directly
to `new Date(...)`.

## API reference

```ts
import { createDeviceClient } from '@ping-identity/rn-device-client';
import type {
  DeviceClient,
  DeviceClientConfig,
  DeviceKind,
  OathDevice,
  PushDevice,
  BoundDevice,
  WebAuthnDevice,
  ProfileDevice,
  DeviceLocation,
  DeviceClientError,
  DeviceClientErrorCode,
} from '@ping-identity/rn-device-client';

function createDeviceClient(config: DeviceClientConfig): DeviceClient;
```

`DeviceClient`:

```ts
interface DeviceClient {
  oath: DeviceRepository<OathDevice>;
  push: DeviceRepository<PushDevice>;
  bound: DeviceRepository<BoundDevice>;
  profile: DeviceRepository<ProfileDevice>;
  webAuthn: DeviceRepository<WebAuthnDevice>;
  dispose(): Promise<void>;
}

interface DeviceRepository<T> {
  get(): Promise<T[]>;
  update(device: T): Promise<T>;
  delete(device: T): Promise<T>;
}
```

## Errors

Rejected promises throw a `DeviceClientError` instance, which extends `PingError extends Error`. Use `instanceof DeviceClientError` to narrow in catch blocks.

Stable error codes:

- `DEVICE_CLIENT_ERROR`
- `DEVICE_CLIENT_NETWORK_ERROR`
- `DEVICE_CLIENT_REQUEST_FAILED` (includes `status`)
- `DEVICE_CLIENT_INVALID_TOKEN`
- `DEVICE_CLIENT_DECODING_FAILED`
- `DEVICE_CLIENT_MISSING_CONFIG`
- `DEVICE_CLIENT_NOT_FOUND`
- `DEVICE_CLIENT_HANDLE_NOT_FOUND`

## Platform notes

- iOS minimum deployment target: 16.0.
- Android minimum SDK: 29.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details
