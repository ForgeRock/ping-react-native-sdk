/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Journey TextInputCallback (Tier 2 — server required)
 * Android parity: TextInputCallbackCallbackE2ETest
 * Server journey tree: TextInputCallbackTest
 *
 * Flow:
 *   1. UsernameCollectorNode → NameCallback:0       (collect username)
 *   2. ScriptedDecisionNode  → TextInputCallback:0  (re-enter same username to verify)
 *   3. MessageNode "Success" → ConfirmationCallback:0 (tap True) → SuccessNode
 */

import { device, element, by, waitFor } from 'detox';
import { assertAppReady, hasCallbackTreesEnabled, hasJourneyEnv, E2E_ENV } from './setup';

const TREE = 'TextInputCallbackTest';
const SKIP_REASON = 'Callback journey tests require callback trees and live Journey env. Set PING_CALLBACK_TREES_ENABLED to not false, plus PING_SERVER_URL, PING_TEST_USERNAME, and PING_TEST_PASSWORD.';
const NET_TIMEOUT = 30000;

describe('Journey — TextInputCallback', () => {
  const ensureTextInputCallbackVisible = async (): Promise<void> => {
    try {
      await waitFor(element(by.id('journey-field-TextInputCallback:0')))
        .toBeVisible()
        .withTimeout(1500);
      return;
    } catch {
      // Continue with start/username flow.
    }

    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(by.id('journey-field-NameCallback:0'))).toBeVisible().withTimeout(NET_TIMEOUT);
    await element(by.id('journey-field-NameCallback:0')).typeText(E2E_ENV.testUsername);
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-field-TextInputCallback:0'))).toBeVisible().withTimeout(NET_TIMEOUT);
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

  it('start() surfaces NameCallback field (step 1 — username collector)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) { console.warn(SKIP_REASON); return; }
    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(by.id('journey-field-NameCallback:0'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });

  it('submit username → surfaces TextInputCallback field (step 2)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) { console.warn(SKIP_REASON); return; }
    await element(by.id('journey-field-NameCallback:0')).typeText(E2E_ENV.testUsername);
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-field-TextInputCallback:0'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });

  it('submit matching text → ConfirmationCallback then SuccessNode (live)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) { console.warn(SKIP_REASON); return; }
    await ensureTextInputCallbackVisible();
    await element(by.id('journey-field-TextInputCallback:0')).typeText(E2E_ENV.testUsername);
    await element(by.id('journey-submit-btn')).tap();
    // MessageNode "Success" renders ConfirmationCallback — tap True to reach SuccessNode
    await waitFor(element(by.id('journey-field-ConfirmationCallback:0'))).toBeVisible().withTimeout(NET_TIMEOUT);
    await element(by.id('journey-field-ConfirmationCallback:0-option-0')).tap();
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-success'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });
});
