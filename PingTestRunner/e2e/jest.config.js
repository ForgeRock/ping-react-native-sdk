/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  maxWorkers: 1,
  testEnvironment: 'node',
  testRunner: 'jest-circus/runner',
  testTimeout: 120000,
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
  reporters: ['detox/runners/jest/reporter'],
  verbose: true,
};
