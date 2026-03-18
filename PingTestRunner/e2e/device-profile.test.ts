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

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import { expect as jestExpect } from '@jest/globals';
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

  it('collectDeviceProfile([]) returns a non-null object with profile data', async () => {
    await element(by.id('device-profile-collect-empty-btn')).tap();
    await waitFor(element(by.id('device-profile-result'))).toBeVisible().withTimeout(5000);
    await detoxExpect(element(by.id('device-profile-error'))).not.toBeVisible();
    const attrs = await element(by.id('device-profile-result')).getAttributes();
    const text = (attrs as any).text ?? (attrs as any).label ?? '';
    const profile = JSON.parse(text);
    jestExpect(typeof profile).toBe('object');
    jestExpect(profile).not.toBeNull();
  });

  it('collectDeviceProfile([platform, hardware]) returns profile with platform and hardware keys', async () => {
    await element(by.id('device-profile-collect-named-btn')).tap();
    await waitFor(element(by.id('device-profile-result'))).toBeVisible().withTimeout(5000);
    await detoxExpect(element(by.id('device-profile-error'))).not.toBeVisible();
    const attrs = await element(by.id('device-profile-result')).getAttributes();
    const text = (attrs as any).text ?? (attrs as any).label ?? '';
    const profile = JSON.parse(text);
    jestExpect(profile).toHaveProperty('platform');
    jestExpect(profile).toHaveProperty('hardware');
  });
});
