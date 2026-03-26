/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Journey ValidatedCreateUsernameCallback (Tier 2 — server required)
 * Android parity: ValidatedUsernameCallbackE2ETest
 * Server journey tree: ValidatedUsernameCallbackTest
 *
 * Flow:
 *   1. ValidatedUsernameNode  → ValidatedCreateUsernameCallback:0  (must be a unique username)
 *   2. Page Node              → NameCallback:0 + PasswordCallback:0  (authenticate as owner)
 *   3. DataStoreDecision      → (true) → SuccessNode
 *
 * Note: the username entered in step 1 must NOT already exist on the server.
 * Using testUsername would fail the VALID_USERNAME policy and loop back to step 1.
 */

import { device, element, by, waitFor } from 'detox';
import { assertAppReady, hasCallbackTreesEnabled, hasJourneyEnv, E2E_ENV } from './setup';

const TREE = 'ValidatedUsernameCallbackTest';
const SKIP_REASON = 'Callback journey tests require callback trees and live Journey env. Set PING_CALLBACK_TREES_ENABLED to not false, plus PING_SERVER_URL, PING_TEST_USERNAME, and PING_TEST_PASSWORD.';
const NET_TIMEOUT = 30000;

describe('Journey — ValidatedCreateUsernameCallback', () => {
  const ensureLoginFormVisible = async (): Promise<void> => {
    try {
      await waitFor(element(by.id('journey-field-NameCallback:0')))
        .toBeVisible()
        .withTimeout(1500);
      return;
    } catch {
      // Continue with start/validated-username flow.
    }

    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(by.id('journey-field-ValidatedCreateUsernameCallback:0'))).toBeVisible().withTimeout(NET_TIMEOUT);
    const uniqueUsername = `e2enew${Date.now()}`;
    await element(by.id('journey-field-ValidatedCreateUsernameCallback:0')).typeText(uniqueUsername);
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-field-NameCallback:0'))).toBeVisible().withTimeout(NET_TIMEOUT);
  };

  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'journey',
        PING_SERVER_URL: E2E_ENV.serverUrl,
        PING_REALM_PATH: E2E_ENV.realmPath,
        PING_JOURNEY_NAME: TREE,
        PING_COOKIE_NAME: E2E_ENV.cookieName,
      },
    });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches', async () => {
    await assertAppReady();
  });

  it('start() surfaces ValidatedCreateUsernameCallback field (step 1)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) { console.warn(SKIP_REASON); return; }
    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(by.id('journey-field-ValidatedCreateUsernameCallback:0'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });

  it('submit unique new username → surfaces login form (step 2)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) { console.warn(SKIP_REASON); return; }
    // Must be unique — reusing testUsername fails the VALID_USERNAME policy
    const uniqueUsername = `e2enew${Date.now()}`;
    await element(by.id('journey-field-ValidatedCreateUsernameCallback:0')).typeText(uniqueUsername);
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-field-NameCallback:0'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });

  it('submit credentials → reaches SuccessNode (live)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) { console.warn(SKIP_REASON); return; }
    await ensureLoginFormVisible();
    await element(by.id('journey-field-NameCallback:0')).typeText(E2E_ENV.testUsername);
    await element(by.id('journey-field-PasswordCallback:0')).typeText(E2E_ENV.testPassword);
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-success'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });
});
