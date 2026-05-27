/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Composite Jest config that runs everything in a single invocation:
 *
 *   1. Per-package unit tests  — each package's own jest.config.js is
 *      referenced as a project so <rootDir> inside each config resolves
 *      to that package's directory (not this file's directory).
 *
 *   2. PingTestRunner integration tests — the local jest.config.js project.
 *
 * Usage:
 *   yarn test:all              # all unit + integration
 *   yarn test:all --coverage   # with combined coverage
 *
 * Note: core and types have no test suites and are omitted intentionally.
 */

module.exports = {
  projects: [
    // ── Package unit test suites ──────────────────────────────────────────
    '<rootDir>/../packages/binding/jest.config.js',
    '<rootDir>/../packages/browser/jest.config.js',
    '<rootDir>/../packages/device-client/jest.config.js',
    '<rootDir>/../packages/device-id/jest.config.js',
    '<rootDir>/../packages/device-profile/jest.config.js',
    '<rootDir>/../packages/journey/jest.config.js',
    '<rootDir>/../packages/logger/jest.config.js',
    '<rootDir>/../packages/oidc/jest.config.js',
    '<rootDir>/../packages/push/jest.config.js',
    '<rootDir>/../packages/storage/jest.config.js',

    // ── PingTestRunner integration tests ─────────────────────────────────
    '<rootDir>/jest.config.js',
  ],

  // Combined coverage collection across all projects
  collectCoverageFrom: [
    '<rootDir>/../packages/*/src/**/*.{ts,tsx}',
    '!<rootDir>/../packages/*/src/**/*.d.ts',
    '!<rootDir>/../packages/*/src/__tests__/**',
    '!<rootDir>/../packages/*/lib/**',
  ],
  coverageDirectory: '<rootDir>/coverage/all',
  coverageReporters: ['lcov', 'text-summary'],
};
