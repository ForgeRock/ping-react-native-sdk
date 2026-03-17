/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — OIDC happy-path flow
 *
 * Uses PingTestRunner's deterministic OIDC test mode, so Detox does not need
 * to automate the external system browser.
 *
 * Flow under test:
 *   1. App launches in OIDC scenario mode
 *   2. authorize() transitions to browser-open state
 *   3. scenario transitions to authorized state
 *   4. userinfo() returns deterministic profile JSON
 *   5. logout() marks session as logged out
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import { assertAppReady } from './setup';

describe('OIDC — happy path', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'oidc',
        PING_OIDC_TEST_MODE: 'true',
      },
    });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches and root is visible', async () => {
    await assertAppReady();
  });

  it('OIDC authorize shows browser-open marker', async () => {
    await element(by.id('oidc-authorize-btn')).tap();
    await detoxExpect(element(by.id('oidc-browser-open'))).toBeVisible();
    await detoxExpect(element(by.id('oidc-token-result'))).toBeVisible();
  });

  it('OIDC userinfo returns deterministic profile', async () => {
    await element(by.id('oidc-userinfo-btn')).tap();
    await detoxExpect(element(by.id('oidc-userinfo-result'))).toBeVisible();
  });

  it('OIDC logout clears the session', async () => {
    await element(by.id('oidc-logout-btn')).tap();
    await detoxExpect(element(by.id('oidc-logged-out'))).toBeVisible();
  });
});
