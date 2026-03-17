/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — OIDC failure-path flow
 *
 * Runs OIDC in deterministic failure mode to validate that authorize failures
 * surface the in-app error UI without relying on external browser automation.
 */

import { device, element, by, waitFor } from 'detox';
import { assertAppReady, detoxExpect } from './setup';

describe('OIDC — failure paths', () => {
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

  it('app launches in oidc scenario', async () => {
    await assertAppReady();
  });

  it('shows error UI when failure is forced in test mode', async () => {
    await element(by.id('oidc-force-failure-btn')).tap();
    await waitFor(element(by.id('oidc-error-message')))
      .toBeVisible()
      .withTimeout(5000);
    await detoxExpect(element(by.id('oidc-error-message'))).toBeVisible();
  });
});
