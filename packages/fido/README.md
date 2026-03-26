<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->
[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native FIDO

This module exposes a native-backed FIDO bridge for React Native.

## Integrating the SDK into your project

```bash
yarn add @ping-identity/rn-fido
cd ios && pod install
```

## How to Use the SDK

```ts
import { getFido } from '@ping-identity/rn-fido';

const fido = await getFido();
console.log('FIDO:', fido);
```

## API reference

```ts
import { getFido } from '@ping-identity/rn-fido';
import type { FidoError, FidoErrorCode } from '@ping-identity/rn-fido';

function getFido(): Promise<string>;
```

## Error handling

All promise rejections use the shared `GenericError` contract from `@ping-identity/rn-types`.

## License

MIT
