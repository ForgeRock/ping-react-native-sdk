/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — OIDC device authorization grant flow
 *
 * Uses PingTestRunner's deterministic OIDC device-flow scenario, so Detox
 * does not need a live authorization server. The scenario forces terminal
 * device-flow statuses through the PING_OIDC_DEVICE_STATUS launch argument;
 * the `success` path requires a live server and is covered by manual testing.
 *
 * Flow under test:
 *   1. App launches in oidc-device scenario mode with a forced status
 *   2. start() transitions the harness into the forced terminal state
 *   3. the matching status marker becomes visible
 */

import { device, element, by, expect as detoxExpect } from 'detox';
import { assertAppReady } from './setup';

describe('OIDC device flow — forced terminal statuses', () => {
  afterEach(async () => {
    await device.terminateApp();
  });

  it('app launches and root is visible', async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'oidc-device',
        PING_OIDC_DEVICE_STATUS: 'expired',
      },
    });
    await assertAppReady();
  });

  it('expired status reaches the expired state', async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'oidc-device',
        PING_OIDC_DEVICE_STATUS: 'expired',
      },
    });
    await assertAppReady();
    await element(by.id('oidc-device-start-btn')).tap();
    await detoxExpect(element(by.id('oidc-device-expired'))).toBeVisible();
  });

  it('accessDenied status reaches the access-denied state', async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'oidc-device',
        PING_OIDC_DEVICE_STATUS: 'accessDenied',
      },
    });
    await assertAppReady();
    await element(by.id('oidc-device-start-btn')).tap();
    await detoxExpect(
      element(by.id('oidc-device-access-denied')),
    ).toBeVisible();
  });

  it('failure status reaches the failure state', async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'oidc-device',
        PING_OIDC_DEVICE_STATUS: 'failure',
      },
    });
    await assertAppReady();
    await element(by.id('oidc-device-start-btn')).tap();
    await detoxExpect(element(by.id('oidc-device-error'))).toBeVisible();
  });
});
