/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

module.exports = {
  displayName: 'PingTestRunner Integration',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__/integration'],
  testMatch: ['**/*.test.ts?(x)'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:@forgerock/sdk-types|@forgerock/sdk-logger|react-native|@react-native|@react-native-community|@testing-library/react-native)/)',
  ],
  moduleNameMapper: {
    // Map workspace packages to source so tests exercise real JS logic.
    // Use $ anchors to prevent subpath imports (e.g. package.json) from being captured.
    '^@ping-identity/rn-browser$':
      '<rootDir>/../packages/browser/src/index.tsx',
    '^@ping-identity/rn-core$': '<rootDir>/../packages/core/index.js',
    '^@ping-identity/rn-device-client$':
      '<rootDir>/../packages/device-client/src/index.tsx',
    '^@ping-identity/rn-device-id$':
      '<rootDir>/../packages/device-id/src/index.tsx',
    '^@ping-identity/rn-device-profile$':
      '<rootDir>/../packages/device-profile/src/index.tsx',
    '^@ping-identity/rn-fido$': '<rootDir>/../packages/fido/src/index.tsx',
    '^@ping-identity/rn-journey$':
      '<rootDir>/../packages/journey/src/index.tsx',
    '^@ping-identity/rn-logger$': '<rootDir>/../packages/logger/src/index.tsx',
    '^@ping-identity/rn-oidc$': '<rootDir>/../packages/oidc/src/index.tsx',
    '^@ping-identity/rn-storage$':
      '<rootDir>/../packages/storage/src/index.tsx',
    '^@ping-identity/rn-types$': '<rootDir>/../packages/types/src/index.ts',
  },
  collectCoverageFrom: [
    '../packages/*/src/**/*.{ts,tsx}',
    '!../packages/*/src/**/*.d.ts',
    '!../packages/*/src/__tests__/**',
  ],
  coverageDirectory: '<rootDir>/coverage/integration',
  coverageReporters: ['lcov', 'text-summary'],
};
