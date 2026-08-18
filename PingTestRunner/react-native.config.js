/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

module.exports = {
  dependencies: {
    // rn-protect is included in package.json for integration tests (protect.test.ts)
    // and Robolectric unit tests. Excluding Android autolinking prevents the CMake
    // build from looking for codegen JNI output that only exists after a full package
    // build. iOS autolinking is kept so that use_native_modules! generates the
    // RNPingProtectSpec codegen header required by RNPingProtect.mm.
    '@ping-identity/rn-protect': {
      platforms: {
        android: null,
      },
    },
  },
};
