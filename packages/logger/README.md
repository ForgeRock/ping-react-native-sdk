[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Logger

The logger module provides a unified logging abstraction for the Ping Identity unified react native SDK.

## Installation


```sh
npm install @react-native-pingidentity/logger
```


## Usage


```js
import { configureLogger, logger } from '@react-native-pingidentity/logger';

const log = logger({ level: 'info' });
log.info('Application started');
log.warn('Potential issue detected');
log.error('An error occurred');
log.changeLevel('debug');

// Defaults to level "none" when omitted
const silentLog = logger();

// Get native logger id for other modules (e.g. journey config)
const logId = configureLogger({ level: 'info' });
```


## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
