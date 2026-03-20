/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts?(x)'],
  modulePathIgnorePatterns: ['<rootDir>/lib/'],
  watchPathIgnorePatterns: ['<rootDir>/lib/'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:@forgerock/sdk-types|react-native|@react-native|@react-native-community|@testing-library/react-native)/)',
  ],
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './build/test-results/js',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
    }],
  ],
};

