# @ping-identity/rn-device-profile

The Device Profile module provides a structured framework for collecting device information.

## Installation


```sh
npm install @ping-identity/rn-device-profile
```


## Usage


```js
import { collectDeviceProfile } from '@ping-identity/rn-device-profile';

// ...

const profile = await collectDeviceProfile(['platform', 'hardware', 'network']);
```

## License

MIT
