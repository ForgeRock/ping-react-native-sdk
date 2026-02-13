[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Logger

The logger module provides a unified logging abstraction for the Ping Identity unified react native SDK.

## Installation


```sh
npm install @ping-identity/rn-logger
```


## Usage


```js
import { configureLogger, logger } from '@ping-identity/rn-logger';

const log = logger({ level: 'info' });
log.info('Application started');
log.warn('Potential issue detected');
log.error('An error occurred');
log.changeLevel('debug');

// Defaults to level "none" when omitted
const silentLog = logger();

// Get native logger handle for other modules (e.g. journey config)
const logHandle = configureLogger({ level: 'info' });
```


## Contributing

TODO: Update with contributing, development workflow, issues template and code of conduct guidelines when added to repo

## License

MIT
