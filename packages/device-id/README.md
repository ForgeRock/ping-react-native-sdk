[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Device ID

The Device ID Module provides utilities for generating and retrieving a secure, unique device identifier for device fingerprinting, fraud detection, and user authentication.

## Features

- **Secure Implementation**: Uses Android KeyStore and iOS Keychain/Secure Enclave-backed identifiers
- **Thread-Safe**: All implementations are thread-safe with lazy initialization patterns
- **Simple API**: Consistent and easy-to-use promise-based interface
- **Cross-Platform**: Consistent behavior across Android and iOS

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

### Basic Example

```tsx
import { getDeviceId } from '@ping-identity/rn-device-id';

// Get the secure default device identifier
async function initializeApp() {
  try {
    const deviceId = await getDeviceId();
    console.log('Device ID:', deviceId);
    // Use device ID for authentication, fraud detection, etc.
  } catch (error) {
    console.error('Failed to retrieve device ID:', error);
  }
}
```

## License

MIT
