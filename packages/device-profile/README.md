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

### Journey usage

```js
import { collectDeviceProfileForJourney } from '@ping-identity/rn-device-profile';

// ...

const profile = await collectDeviceProfileForJourney(
  journey,
  ['platform', 'hardware', 'network', 'location'],
  callbackPayload
);
```

Note: `collectDeviceProfileForJourney` is only valid when a Device Profile callback
is active in the current Journey node. The native implementation resolves the
active Device Profile callback from the provided Journey, applies server-driven
configuration, executes the requested collectors, and returns an AIC-ready
profile payload. If available, pass the raw callback payload to ensure server
configuration is applied correctly.

## License

MIT
