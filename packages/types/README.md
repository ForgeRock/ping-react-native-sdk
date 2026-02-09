[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

# Ping Identity React Native Types

The Types module defines shared, platform-agnostic TypeScript contracts used across the Ping
Identity React Native SDK ecosystem. It contains types only and ships no runtime logic or
native bindings.

## Integrating the SDK into your project

Add the package to your workspace:

```bash
yarn add @ping-identity/rn-types
```

## How to Use the SDK

### Design principles

- Types are serializable across the React Native bridge.
- No native (Kotlin/Swift) constructs or platform-specific details.
- Contracts describe expectations, not runtime behavior.

### Error model

Errors rejected from native modules should conform to this shape (re-exported from
`@forgerock/sdk-types`):

```ts
export interface GenericError {
  type: ErrorType;
  error: string;
  message?: string;
  code?: string | number;
  status?: string | number;
}
```

```ts
import type { GenericError, ErrorType } from '@ping-identity/rn-types';
```

### Usage in feature modules

Feature modules should re-export or alias the shared error type instead of redefining it:

```ts
import type { GenericError } from '@ping-identity/rn-types';

export type BrowserError = GenericError;
```
