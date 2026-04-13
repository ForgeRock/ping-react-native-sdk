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

Add the package and let autolinking wire the native code:

```bash
yarn add @ping-identity/rn-device-id
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

All promise rejections use the shared `GenericError` contract from `@ping-identity/rn-types`.

```ts
import type { DeviceIdError } from '@ping-identity/rn-device-id';

try {
  await getDeviceId();
} catch (error) {
  const deviceIdError = error as DeviceIdError;
  console.log(deviceIdError.type, deviceIdError.error, deviceIdError.message);
}
```

## License

MIT
