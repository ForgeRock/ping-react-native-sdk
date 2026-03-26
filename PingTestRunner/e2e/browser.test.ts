/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Browser bridge (Tier 1 — no server required)
 *
 * Verifies the native browser bridge module loads correctly and that the
 * two configuration APIs do not throw on the current platform:
 *   - configureBrowser({}) — no-op on iOS, applies config on Android
 *   - resetBrowser()       — no-op on Android, cancels active session on iOS
 */

import { device, element, by, waitFor } from 'detox';
import { assertAppReady } from './setup';

describe('Browser — native bridge', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { PING_TEST_SCENARIO: 'browser' },
    });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches', async () => {
    await assertAppReady();
  });

  it('configureBrowser({}) completes without throwing', async () => {
    await element(by.id('browser-configure-btn')).tap();
    await waitFor(element(by.id('browser-configure-result')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('resetBrowser() completes without throwing', async () => {
    await element(by.id('browser-reset-btn')).tap();
    await waitFor(element(by.id('browser-reset-result')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
