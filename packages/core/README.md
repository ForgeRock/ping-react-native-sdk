<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Core

The Core module provides shared runtime infrastructure required by all other Ping Identity React Native SDK packages. It does not expose a consumer API — install it once and the other packages handle the rest.

## Installation

All other Ping Identity RN SDK packages depend on this module. Install it first:

```bash
yarn add @ping-identity/rn-core
cd ios && pod install
```

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details
