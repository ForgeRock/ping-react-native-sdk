/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — useJourney + useJourneyForm hooks (Tier 2 — server required)
 *
 * Verifies that the hook API produces correct state transitions against real
 * native bridges on device: loading state, node updates, form field rendering
 * via useJourneyForm, and post-login actions (token, refresh, revoke, logout).
 */

import { device, element, by, waitFor } from 'detox';
import { assertAppReady, hasJourneyEnv, E2E_ENV } from './setup';

const SKIP_REASON =
  'useJourney hook tests require a live Journey env. Set PING_SERVER_URL, PING_TEST_USERNAME, and PING_TEST_PASSWORD.';

const JOURNEY_LAUNCH_ARGS = {
  PING_TEST_SCENARIO: 'use-journey',
  PING_SERVER_URL: E2E_ENV.serverUrl,
  PING_REALM_PATH: E2E_ENV.realmPath,
  PING_JOURNEY_NAME: E2E_ENV.journeyName,
  PING_COOKIE_NAME: E2E_ENV.cookieName,
  PING_CLIENT_ID: E2E_ENV.clientId,
  PING_DISCOVERY_ENDPOINT: E2E_ENV.discoveryEndpoint,
  PING_REDIRECT_URI: E2E_ENV.redirectUri,
};

// No OIDC config — avoids discovery requests that can interfere with failure-path timing.
const JOURNEY_NO_OIDC_ARGS = {
  PING_TEST_SCENARIO: 'use-journey',
  PING_SERVER_URL: E2E_ENV.serverUrl,
  PING_REALM_PATH: E2E_ENV.realmPath,
  PING_JOURNEY_NAME: E2E_ENV.journeyName,
  PING_COOKIE_NAME: E2E_ENV.cookieName,
};

const NET_TIMEOUT = 30000;

describe('useJourney + useJourneyForm — hook state transitions', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: JOURNEY_LAUNCH_ARGS,
    });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches', async () => {
    await assertAppReady();
  });

  it('start() surfaces login form via useJourneyForm fields', async () => {
    if (!hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('use-journey-start-btn')).tap();
    await waitFor(element(by.id('use-journey-field-NameCallback:0')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await waitFor(element(by.id('use-journey-field-PasswordCallback:0')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('next() with valid credentials reaches SuccessNode', async () => {
    if (!hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('use-journey-field-NameCallback:0')).typeText(
      E2E_ENV.testUsername,
    );
    await element(by.id('use-journey-field-PasswordCallback:0')).typeText(
      E2E_ENV.testPassword,
    );
    await element(by.id('use-journey-submit-btn')).tap();
    await waitFor(element(by.id('use-journey-success')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('token is available after success', async () => {
    if (!hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await waitFor(element(by.id('use-journey-token-result')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('userinfo() returns a payload via hook actions', async () => {
    if (!hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('use-journey-userinfo-btn')).tap();
    await waitFor(element(by.id('use-journey-userinfo-result')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('refresh() updates token via hook actions', async () => {
    if (!hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('use-journey-refresh-btn')).tap();
    await waitFor(element(by.id('use-journey-refreshed')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('revoke() completes via hook actions', async () => {
    if (!hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('use-journey-revoke-btn')).tap();
    await waitFor(element(by.id('use-journey-revoked')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('logoutUser() completes via hook actions', async () => {
    if (!hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('use-journey-logout-btn')).tap();
    await waitFor(element(by.id('use-journey-logged-out')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });
});

describe('useJourney — FailureNode on wrong credentials', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: JOURNEY_NO_OIDC_ARGS,
    });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches', async () => {
    await assertAppReady();
  });

  it('next() with wrong password reaches FailureNode', async () => {
    if (!hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('use-journey-start-btn')).tap();
    await waitFor(element(by.id('use-journey-field-NameCallback:0')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await element(by.id('use-journey-field-NameCallback:0')).typeText(
      E2E_ENV.testUsername,
    );
    await element(by.id('use-journey-field-PasswordCallback:0')).typeText(
      'wrong_password',
    );
    await element(by.id('use-journey-submit-btn')).tap();
    await waitFor(element(by.id('use-journey-failure')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });
});
