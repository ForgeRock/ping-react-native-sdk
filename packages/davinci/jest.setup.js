/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

global.__DEV__ = true;

const originalConsoleError = console.error.bind(console);

// Temp fix to suppress react-test-renderer deprecation warning until we can update to the latest @testing-library/react-native
console.error = (...args) => {
  const first = args[0];
  if (
    typeof first === 'string' &&
    first.includes('react-test-renderer is deprecated')
  ) {
    return;
  }

  originalConsoleError(...args);
};
