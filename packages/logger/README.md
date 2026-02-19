<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->
[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Logger

The logger module provides a unified logging abstraction across JavaScript and native layers for
Ping Identity React Native SDK modules.

## Table of contents

- [Overview](#overview)
- [Integrating the SDK into your project](#integrating-the-sdk-into-your-project)
- [How to use the SDK](#how-to-use-the-sdk)
- [Log levels](#log-levels)
- [API reference](#api-reference)
- [Error handling](#error-handling)
- [License](#license)

## Overview

Use this module to:

- Create logger instances for JavaScript logging.
- Register and synchronize logger level with native iOS/Android modules.
- Provide logger handles to modules that accept native logger configuration.

By default, logging is disabled (`level: 'none'`) when no level is provided.

## Integrating the SDK into your project

Add the package and let autolinking wire the native code:

```bash
yarn add @ping-identity/rn-logger
cd ios && pod install
```

## How to use the SDK

### Create a logger instance

```ts
import { configureLogger, logger } from '@ping-identity/rn-logger';

const log = logger({ level: 'info' });
log.info('Application started');
log.warn('Potential issue detected');
log.error('An error occurred');
log.changeLevel('debug');

// Defaults to level "none" when omitted
const silentLog = logger();

// Get native logger handle for modules that accept native logger config
const logHandle = configureLogger({ level: 'info' });
```

### Configure a custom logger sink

You can forward logs to your own logger implementation.

```ts
import { logger } from '@ping-identity/rn-logger';

const log = logger({
  level: 'debug',
  custom: {
    error: (...args) => {
      console.log('[ERROR]', ...args);
      return true;
    },
    warn: (...args) => {
      console.log('[WARN]', ...args);
      return true;
    },
    info: (...args) => {
      console.log('[INFO]', ...args);
      return true;
    },
    debug: (...args) => {
      console.log('[DEBUG]', ...args);
      return true;
    },
  },
});

log.debug('diagnostics enabled');
```

## Log levels

Supported levels:

- `debug`
- `info`
- `warn`
- `error`
- `none`

## API reference

```ts
import type {
  LoggerConfig,
  LoggerInstance,
  NativeLoggerHandle,
  LogLevel,
} from '@ping-identity/rn-logger';

function configureLogger(config?: LoggerConfig): NativeLoggerHandle;
function logger(config?: LoggerConfig): LoggerInstance;

type LoggerConfig = {
  level?: LogLevel;
  custom?: {
    error: (...args: unknown[]) => boolean;
    warn: (...args: unknown[]) => boolean;
    info: (...args: unknown[]) => boolean;
    debug: (...args: unknown[]) => boolean;
  };
};
```

## Error handling

`configureLogger` throws when native logger registration fails.

```ts
import { configureLogger } from '@ping-identity/rn-logger';

try {
  const nativeHandle = configureLogger({ level: 'info' });
  console.log(nativeHandle.id);
} catch (error) {
  console.error('Failed to configure logger', error);
}
```

## License

MIT
