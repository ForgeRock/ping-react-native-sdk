# @react-native-pingidentity/browser

Ping Browser

## Installation


```sh
npm install @react-native-pingidentity/browser
```


## Usage

```ts
import { configureBrowser, open } from '@react-native-pingidentity/browser';

// Optional: Android-only global configuration.
configureBrowser({
  android: {
    customTabs: {
      showTitle: false,
      urlBarHidingEnabled: true,
      colorScheme: 'system',
    },
    authTabs: {
      ephemeral: true,
    },
  },
});

const result = await open('https://example.com', {
  callbackUrlScheme: 'com.example.app',
  redirectUri: 'com.example.app://callback',
});

// result: { type: 'success', url } | { type: 'cancel' }
```

### Platform notes

- Android: `configureBrowser` applies Custom Tabs and Auth Tabs customization.
- iOS: `configureBrowser` is a no-op (reserved for future). Use `open` with `callbackUrlScheme`.


## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
