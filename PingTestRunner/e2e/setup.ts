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

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { device, expect as detoxExpect, element, by } from 'detox';

const e2eEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(e2eEnv)) dotenv.config({ path: e2eEnv });

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
  await device.launchApp({
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
 * Environment variables for E2E tests. Set these in PingTestRunner/.env
 * (see .env.example) or inject them as CI secrets.
 */
export const E2E_ENV = {
  serverUrl:         process.env['PING_SERVER_URL']          ?? '',
  realmPath:         process.env['PING_REALM_PATH']          ?? 'alpha',
  cookieName:        process.env['PING_COOKIE_NAME']         ?? 'iPlanetDirectoryPro',
  journeyName:       process.env['PING_JOURNEY_NAME']        ?? 'Login',
  discoveryEndpoint: process.env['PING_DISCOVERY_ENDPOINT']  ?? '',
  clientId:          process.env['PING_CLIENT_ID']           ?? '',
  redirectUri:       process.env['PING_REDIRECT_URI']        ?? 'org.forgerock.demo://oauth2redirect',
  testUsername:      process.env['PING_TEST_USERNAME']       ?? '',
  testPassword:      process.env['PING_TEST_PASSWORD']       ?? '',
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

/**
 * Returns true when journey-only env vars are set (no OIDC config required).
 */
export function hasJourneyEnv(): boolean {
  return !!(
    E2E_ENV.serverUrl &&
    E2E_ENV.testUsername &&
    E2E_ENV.testPassword
  );
}

/**
 * Returns true when per-callback journey trees are provisioned on the server.
 * Set PING_CALLBACK_TREES_ENABLED=true to enable per-callback E2E tests.
 */
export function hasCallbackTreesEnabled(): boolean {
  const value = process.env['PING_CALLBACK_TREES_ENABLED'];
  return value !== 'false';
}

// Re-export Detox primitives for convenient use in test files
export { detoxExpect, element, by, device };
