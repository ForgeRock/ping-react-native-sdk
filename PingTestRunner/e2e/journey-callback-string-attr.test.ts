/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Journey StringAttributeInputCallback (Tier 2 — server required)
 * Android parity: StringAttributeInputCallbackE2ETest
 * Server journey tree: StringAttributeInputCallbackTest
 *
 * Flow:
 *   1. Page Node           → NameCallback:0 + PasswordCallback:0         (login)
 *   2. Attribute Collector → StringAttributeInputCallback:0 (mail)
 *                            StringAttributeInputCallback:1 (givenName)
 *                            StringAttributeInputCallback:2 (sn)
 *   3. Fill all and submit → SuccessNode
 */

import { device, element, by, waitFor } from 'detox';
import { assertAppReady, hasCallbackTreesEnabled, hasJourneyEnv, E2E_ENV } from './setup';

const TREE = 'StringAttributeInputCallbackTest';
const SKIP_REASON = 'Callback journey tests require callback trees and live Journey env. Set PING_CALLBACK_TREES_ENABLED to not false, plus PING_SERVER_URL, PING_TEST_USERNAME, and PING_TEST_PASSWORD.';
const NET_TIMEOUT = 30000;

describe('Journey — StringAttributeInputCallback', () => {
  const ensureStringAttributeCallbackVisible = async (): Promise<void> => {
    try {
      await waitFor(element(by.id('journey-field-StringAttributeInputCallback:0')))
        .toBeVisible()
        .withTimeout(1500);
      return;
    } catch {
      // Continue with start/login flow.
    }

    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(by.id('journey-field-NameCallback:0'))).toBeVisible().withTimeout(NET_TIMEOUT);
    await element(by.id('journey-field-NameCallback:0')).typeText(E2E_ENV.testUsername);
    await element(by.id('journey-field-PasswordCallback:0')).typeText(E2E_ENV.testPassword);
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-field-StringAttributeInputCallback:0'))).toBeVisible().withTimeout(NET_TIMEOUT);
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

  it('start() surfaces login form (step 1)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) { console.warn(SKIP_REASON); return; }
    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(by.id('journey-field-NameCallback:0'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });

  it('submit credentials → surfaces StringAttributeInputCallback fields (step 2)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) { console.warn(SKIP_REASON); return; }
    await element(by.id('journey-field-NameCallback:0')).typeText(E2E_ENV.testUsername);
    await element(by.id('journey-field-PasswordCallback:0')).typeText(E2E_ENV.testPassword);
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-field-StringAttributeInputCallback:0'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });

  it('fill all string attributes and submit → reaches SuccessNode (live)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) { console.warn(SKIP_REASON); return; }
    await ensureStringAttributeCallbackVisible();
    await element(by.id('journey-field-StringAttributeInputCallback:0')).typeText('e2e@example.com');
    await element(by.id('journey-field-StringAttributeInputCallback:1')).typeText('E2E');
    await element(by.id('journey-field-StringAttributeInputCallback:2')).typeText('Test');
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-success'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });
});
