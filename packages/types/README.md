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

### Error handling

All native module rejections are surfaced as `PingError` instances, which extend the standard
`Error` class and carry structured fields from the native bridge:

```ts
import { PingError } from '@ping-identity/rn-types';

try {
  await someOperation();
} catch (err) {
  if (err instanceof PingError) {
    console.log(err.code, err.type, err.message, err.status);
  }
}
```

### Usage in feature modules

Each feature package exports its own subclass of `PingError`, enabling per-package `instanceof`
narrowing. Use `PingError` as the common base when a single catch handles errors from multiple
packages:

```ts
import { PingError } from '@ping-identity/rn-types';

export class BrowserError extends PingError {
  constructor(message: string, code: string, type: string, status?: number) {
    super(message, code, type, status);
    this.name = 'BrowserError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static from(raw: unknown): BrowserError { ... }
}
```
