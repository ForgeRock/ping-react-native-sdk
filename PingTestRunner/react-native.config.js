/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

module.exports = {
  dependencies: {
    // rn-protect is included in package.json for Robolectric unit tests only.
    // Excluding it from autolinking prevents the CMake build from looking for
    // codegen JNI output that only exists after a full package build.
    '@ping-identity/rn-protect': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
