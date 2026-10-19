/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Journey PingOneProtectInitializeCallback / PingOneProtectEvaluationCallback
 * (Tier 2 — server required, Protect-enabled tenant)
 * Android parity: PingOneProtectEvaluationCallbackE2ETest
 * Server journey tree: TEST_PING_ONE_PROTECT_EVALUATE
 *
 * Flow:
 *   1. Start                  → ChoiceCallback:0 (select the "evaluate-default" variant)
 *   2. Next node              → PingOneProtectInitializeCallback
 *                               (auto-handled by JourneyScenario via initializeProtectForJourney)
 *   3. Next node              → NameCallback:0 (username only, no PasswordCallback)
 *   4. Next node              → PingOneProtectEvaluationCallback
 *                               (auto-handled by JourneyScenario via collectProtectForJourney)
 *   5. Next node              → TextOutputCallback:0 ("Success")
 *   6. SuccessNode
 */

import { device, element, by, waitFor, expect as detoxExpect } from 'detox';
import {
  assertAppReady,
  hasCallbackTreesEnabled,
  hasJourneyUsernameEnv,
  E2E_ENV,
} from './setup';

const TREE = 'TEST_PING_ONE_PROTECT_EVALUATE';
const VARIANT = 'evaluate-default';
const SKIP_REASON =
  'Protect callback journey tests require callback trees and live Journey env. Set PING_CALLBACK_TREES_ENABLED to not false, plus PING_SERVER_URL and PING_TEST_USERNAME.';
const NET_TIMEOUT = 45000;

describe('Journey — PingOne Protect callbacks', () => {
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

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches', async () => {
    await assertAppReady();
  });

  it('start() initializes Protect, evaluates, and reaches SuccessNode (live)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyUsernameEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('journey-start-btn')).atIndex(0).tap();
    await waitFor(element(by.id('journey-field-ChoiceCallback:0')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await element(by.text(VARIANT)).tap();
    await element(by.id('journey-submit-btn')).tap();
    // Reaching the NameCallback proves the Initialize callback was auto-handled
    await waitFor(element(by.id('journey-field-NameCallback:0')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await element(by.id('journey-field-NameCallback:0')).typeText(
      E2E_ENV.testUsername,
    );
    await element(by.id('journey-submit-btn')).tap();
    // Reaching the TextOutputCallback proves the Evaluation callback was auto-handled
    await waitFor(element(by.id('journey-field-output-TextOutputCallback:0')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-success')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    // Re-asserted via detoxExpect: BrowserStack derives the test verdict from explicit expect calls, not waitFor polling.
    await detoxExpect(element(by.id('journey-success'))).toBeVisible();
  });
});
