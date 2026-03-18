/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — useOidc hook (Tier 1 — no server required)
 *
 * Uses a JS-only mock OidcWebClient so no native OIDC calls are made.
 * Verifies that useOidc correctly manages hook state transitions:
 *   - isAuthenticated after authorize()
 *   - user / tokens / userInfo populated after respective actions
 *   - isAuthenticated cleared after revoke() / logout()
 */

import { device, element, by, waitFor } from 'detox';
import { assertAppReady } from './setup';

const ACTION_TIMEOUT = 5000;

describe('useOidc — hook state transitions (mock client)', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { PING_TEST_SCENARIO: 'use-oidc' },
    });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches', async () => {
    await assertAppReady();
  });

  it('authorize() sets isAuthenticated and user', async () => {
    await element(by.id('use-oidc-authorize-btn')).tap();
    await waitFor(element(by.id('use-oidc-authenticated')))
      .toBeVisible()
      .withTimeout(ACTION_TIMEOUT);
    await waitFor(element(by.id('use-oidc-user-result')))
      .toBeVisible()
      .withTimeout(ACTION_TIMEOUT);
  });

  it('token() populates tokens state', async () => {
    await element(by.id('use-oidc-token-btn')).tap();
    await waitFor(element(by.id('use-oidc-token-result')))
      .toBeVisible()
      .withTimeout(ACTION_TIMEOUT);
  });

  it('refresh() keeps tokens populated', async () => {
    await element(by.id('use-oidc-refresh-btn')).tap();
    await waitFor(element(by.id('use-oidc-token-result')))
      .toBeVisible()
      .withTimeout(ACTION_TIMEOUT);
  });

  it('userinfo() populates userInfo state', async () => {
    await element(by.id('use-oidc-userinfo-btn')).tap();
    await waitFor(element(by.id('use-oidc-userinfo-result')))
      .toBeVisible()
      .withTimeout(ACTION_TIMEOUT);
  });

  it('revoke() clears isAuthenticated', async () => {
    await element(by.id('use-oidc-revoke-btn')).tap();
    await waitFor(element(by.id('use-oidc-logged-out')))
      .toBeVisible()
      .withTimeout(ACTION_TIMEOUT);
  });

  it('authorize() then logout() clears isAuthenticated', async () => {
    await element(by.id('use-oidc-authorize-btn')).tap();
    await waitFor(element(by.id('use-oidc-authenticated')))
      .toBeVisible()
      .withTimeout(ACTION_TIMEOUT);
    await element(by.id('use-oidc-logout-btn')).tap();
    await waitFor(element(by.id('use-oidc-logged-out')))
      .toBeVisible()
      .withTimeout(ACTION_TIMEOUT);
  });
});

describe('useOidc — state.error on authorize failure', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { PING_TEST_SCENARIO: 'use-oidc-error' },
    });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches', async () => {
    await assertAppReady();
  });

  it('authorize() failure sets state.error', async () => {
    await element(by.id('use-oidc-authorize-btn')).tap();
    await waitFor(element(by.id('use-oidc-error')))
      .toBeVisible()
      .withTimeout(ACTION_TIMEOUT);
  });
});
