/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Journey TextOutputCallback (Tier 2 — server required)
 * Android parity: TextOutputCallbackCallbackE2ETest
 * Server journey tree: TextOutputCallbackTest
 *
 * Flow:
 *   1. UsernameCollectorNode  → NameCallback:0         (username — separate node)
 *   2. PasswordCollectorNode  → PasswordCallback:0     (password — separate node)
 *   3. DataStoreDecision      → (true)
 *   4. ScriptedDecision       → TextOutputCallback:0/1/2  (INFO, WARNING, ERROR — output only)
 *   5. Submit (no user input) → SuccessNode
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { device, element, by, waitFor } from 'detox';
import { expect as jestExpect } from '@jest/globals';
import {
  assertAppReady,
  hasCallbackTreesEnabled,
  hasJourneyEnv,
  E2E_ENV,
} from './setup';

const TREE = 'TextOutputCallbackTest';
const SKIP_REASON =
  'Callback journey tests require callback trees and live Journey env. Set PING_CALLBACK_TREES_ENABLED to not false, plus PING_SERVER_URL, PING_TEST_USERNAME, and PING_TEST_PASSWORD.';
const NET_TIMEOUT = 30000;

describe('Journey — TextOutputCallback', () => {
  const ensureTextOutputCallbackVisible = async (): Promise<void> => {
    try {
      await waitFor(element(by.id('journey-field-output-TextOutputCallback:0')))
        .toBeVisible()
        .withTimeout(1500);
      return;
    } catch {
      // Continue with start/username/password flow.
    }

    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(by.id('journey-field-NameCallback:0')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await element(by.id('journey-field-NameCallback:0')).typeText(
      E2E_ENV.testUsername,
    );
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-field-PasswordCallback:0')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await element(by.id('journey-field-PasswordCallback:0')).typeText(
      E2E_ENV.testPassword,
    );
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-field-output-TextOutputCallback:0')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
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

  it('start() surfaces NameCallback field (step 1 — username collector as separate node)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(by.id('journey-field-NameCallback:0')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('submit username → surfaces PasswordCallback field (step 2 — separate node)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('journey-field-NameCallback:0')).typeText(
      E2E_ENV.testUsername,
    );
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-field-PasswordCallback:0')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('submit password → surfaces TextOutputCallback display text (step 3)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('journey-field-PasswordCallback:0')).typeText(
      E2E_ENV.testPassword,
    );
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-field-output-TextOutputCallback:0')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    const attrs = await element(
      by.id('journey-field-output-TextOutputCallback:0'),
    ).getAttributes();
    const text = (attrs as any).text ?? (attrs as any).label ?? '';
    jestExpect(text.length).toBeGreaterThan(0);
  });

  it('submit output-only callbacks → reaches SuccessNode (live)', async () => {
    if (!hasCallbackTreesEnabled() || !hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await ensureTextOutputCallbackVisible();
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-success')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });
});
