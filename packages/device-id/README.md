<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Device ID

This module provides a native-backed secure device identifier for device fingerprinting,
risk signals, and authentication flows.

## Table of contents

- [Integrating the SDK into your project](#integrating-the-sdk-into-your-project)
- [How to Use the SDK](#how-to-use-the-sdk)
- [Platform behavior](#platform-behavior)
- [Error handling](#error-handling)
- [License](#license)

## Integrating the SDK into your project

> **Note:** This module requires that the `@ping-identity/rn-core` module is already set up and installed.

```bash
# Install & setup the core module
yarn add @ping-identity/rn-core
# Install the rn-device-id module
yarn add @ping-identity/rn-device-id
# If you are developing your app using iOS, run this command
cd ios && pod install
```

Or using npm:

```bash
npm install @ping-identity/rn-device-id
cd ios && pod install
```

## How to Use the SDK

### Get the default device ID

```ts
import { getDeviceId } from '@ping-identity/rn-device-id';

const deviceId = await getDeviceId();
console.log('Device ID:', deviceId);
```

### API reference

```ts
import { getDeviceId } from '@ping-identity/rn-device-id';
import type {
  DeviceIdError,
  DeviceIdErrorCode,
  DeviceIdLoggerOptions,
} from '@ping-identity/rn-device-id';

function getDeviceId(options?: DeviceIdLoggerOptions): Promise<string>;
```

## Platform behavior

`getDeviceId` resolves a stable, secure identifier backed by native platform storage.

- Android: backed by KeyStore-generated material and generally resets after uninstall.
- iOS: backed by Keychain and typically persists across uninstall/reinstall.
- Both platforms: identifier is app/device scoped and returned as a `string`.

## Error handling

All promise rejections throw a `DeviceIdError` instance, which extends `PingError extends Error`.
Use `instanceof` to narrow the error type:

```ts
import { DeviceIdError } from '@ping-identity/rn-device-id';

try {
  await getDeviceId();
} catch (err) {
  if (err instanceof DeviceIdError) {
    console.log(err.code, err.type, err.message);
  }
}
```

## License

MIT
