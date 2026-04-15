/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  maxWorkers: 1,
  testRunner: 'jest-circus/runner',
  testTimeout: 300000,
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  testEnvironment: 'detox/runners/jest/testEnvironment',
  reporters: ['detox/runners/jest/reporter', 'default'],
  verbose: true,
};
