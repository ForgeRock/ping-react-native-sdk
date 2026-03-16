/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Detox global setup / teardown hooks for PingTestRunner E2E suite.
 *
 * Each test file that imports this module gets:
 * - beforeAll  — device install + launch
 * - afterAll   — device terminate + uninstall
 * - beforeEach — relaunch with a clean state
 */

import { device, expect as detoxExpect, element, by } from 'detox';

export async function launchApp(
  launchArgs: Record<string, string> = {}
): Promise<void> {
  await device.launchApp({
    newInstance: true,
    launchArgs,
  });
}

export async function relaunchApp(
  launchArgs: Record<string, string> = {}
): Promise<void> {
  await device.relaunchApp({
    newInstance: true,
    launchArgs,
  });
}

/**
 * Assert that the test-runner root is visible, confirming the app launched.
 */
export async function assertAppReady(): Promise<void> {
  await detoxExpect(element(by.id('ping-test-runner-root'))).toBeVisible();
}

/**
 * Required environment variables for E2E tests that exercise real auth flows.
 * These must be set in CI or a local `.env.e2e` file sourced before running.
 */
export const E2E_ENV = {
  discoveryEndpoint: process.env['PING_DISCOVERY_ENDPOINT'] ?? '',
  clientId: process.env['PING_CLIENT_ID'] ?? '',
  redirectUri: process.env['PING_REDIRECT_URI'] ?? 'org.forgerock.demo://oauth2redirect',
  serverUrl: process.env['PING_SERVER_URL'] ?? '',
  realmPath: process.env['PING_REALM_PATH'] ?? '/alpha',
  journeyName: process.env['PING_JOURNEY_NAME'] ?? 'Login',
  testUsername: process.env['PING_TEST_USERNAME'] ?? '',
  testPassword: process.env['PING_TEST_PASSWORD'] ?? '',
};

/**
 * Returns true when all required env vars for live auth tests are set.
 */
export function hasLiveAuthEnv(): boolean {
  return !!(
    E2E_ENV.discoveryEndpoint &&
    E2E_ENV.clientId &&
    E2E_ENV.serverUrl &&
    E2E_ENV.testUsername &&
    E2E_ENV.testPassword
  );
}

// Re-export Detox primitives for convenient use in test files
export { detoxExpect, element, by, device };
