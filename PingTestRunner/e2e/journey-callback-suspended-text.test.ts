/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Journey SuspendedTextOutputCallback (Tier 2 — server required)
 * Android parity: SuspendedTextCallbackE2ETest
 * Server journey tree: SuspendedTextCallbackTest
 *
 * Flow:
 *   1. Page Node              → NameCallback:0 + PasswordCallback:0 (login)
 *   2. Suspended node         → SuspendedTextOutputCallback:0
 *   3. Flow pauses for resume → no submit in this tree
 */

import { device, element, by, waitFor } from 'detox';
import {
  assertAppReady,
  hasCallbackTreesEnabled,
  hasJourneyEnv,
  E2E_ENV,
} from './setup';

const TREE = 'SuspendedTextCallbackTest';
const SKIP_REASON =
  'Callback journey tests require callback trees and live Journey env. Set PING_CALLBACK_TREES_ENABLED to not false, plus PING_SERVER_URL, PING_TEST_USERNAME, and PING_TEST_PASSWORD.';
const NET_TIMEOUT = 30000;

describe('Journey — SuspendedTextOutputCallback', () => {
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

  it('login surfaces SuspendedTextOutputCallback message', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(by.id('journey-field-NameCallback:0')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await element(by.id('journey-field-NameCallback:0')).typeText(
      E2E_ENV.testUsername,
    );
    await element(by.id('journey-field-PasswordCallback:0')).typeText(
      E2E_ENV.testPassword,
    );
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(
      element(by.id('journey-field-output-SuspendedTextOutputCallback:0')),
    )
      .toExist()
      .withTimeout(NET_TIMEOUT);
  });
});
