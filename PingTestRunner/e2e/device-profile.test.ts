/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Device Profile bridge verification (Tier 1 — no server required)
 *
 * Android SDK parity:
 *   testDeviceProfileCallbackWithDefaultCollectors → empty collectors returns object
 *   testDeviceProfileCallbackWithCustomCollectors  → named collectors returns object
 *   error propagation                              → native error shown in UI
 */

import { device, element, by, expect as detoxExpect } from 'detox';
import { assertAppReady } from './setup';

describe('Device Profile — bridge verification', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { PING_TEST_SCENARIO: 'device-profile' },
    });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches in device-profile scenario', async () => {
    await assertAppReady();
  });

  it('collectDeviceProfile([]) returns a non-null object', async () => {
    await element(by.id('device-profile-collect-empty-btn')).tap();
    await detoxExpect(element(by.id('device-profile-result'))).toBeVisible();
    await detoxExpect(element(by.id('device-profile-error'))).not.toBeVisible();
  });

  it('collectDeviceProfile([platform, hardware]) returns a non-null object', async () => {
    await element(by.id('device-profile-collect-named-btn')).tap();
    await detoxExpect(element(by.id('device-profile-result'))).toBeVisible();
    await detoxExpect(element(by.id('device-profile-error'))).not.toBeVisible();
  });
});
