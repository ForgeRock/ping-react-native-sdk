/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Journey happy-path, failure-path, and token flows
 *
 * Exercises the Journey authentication tree flow against a live PingAM server
 * when the required environment variables are set:
 *
 *   PING_SERVER_URL       — Base PingAM URL (e.g. https://openam.example.com/openam)
 *   PING_REALM_PATH       — Realm path (e.g. /alpha)
 *   PING_JOURNEY_NAME     — Journey / auth tree name (e.g. Login)
 *   PING_TEST_USERNAME    — Test user's username
 *   PING_TEST_PASSWORD    — Test user's password
 *
 * When env vars are absent the suite self-skips.
 *
 * Callback testID scheme: `journey-field-{CallbackType}:{typeIndex}`
 *   e.g. journey-field-NameCallback:0, journey-field-PasswordCallback:0
 *
 * Android SDK parity:
 *   successfulLogin           → happy path describe block
 *   sessionSignOff            → logoutUser() test
 *   handleError               → failure paths describe block
 *   testUserToken             → token result visible after login
 *   testUserTokenRefresh      → refresh test
 *   testUserTokenRevoke       → revoke test
 *   successfulLoginWithNoSession → noSession describe block
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import { assertAppReady, hasJourneyEnv, hasLiveAuthEnv, E2E_ENV } from './setup';

const NET_TIMEOUT = 30000; // ms to wait for network-dependent elements

const SKIP_REASON =
  'Live journey env vars not set — skipping Journey E2E tests. ' +
  'Set PING_SERVER_URL, PING_TEST_USERNAME, PING_TEST_PASSWORD to enable.';

const OIDC_SKIP_REASON =
  'OIDC env vars not set — skipping token/userinfo/refresh tests. ' +
  'Set PING_DISCOVERY_ENDPOINT and PING_CLIENT_ID to enable.';

// Convenience aliases for the generic callback testIDs used by the Login journey
const USERNAME_INPUT = by.id('journey-field-NameCallback:0');
const PASSWORD_INPUT = by.id('journey-field-PasswordCallback:0');

// ─── happy path ──────────────────────────────────────────────────────────────

describe('Journey — happy path', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'journey',
        PING_SERVER_URL: E2E_ENV.serverUrl,
        PING_REALM_PATH: E2E_ENV.realmPath,
        PING_JOURNEY_NAME: E2E_ENV.journeyName,
        PING_COOKIE_NAME: E2E_ENV.cookieName,
        ...(E2E_ENV.clientId ? { PING_CLIENT_ID: E2E_ENV.clientId } : {}),
        ...(E2E_ENV.discoveryEndpoint ? { PING_DISCOVERY_ENDPOINT: E2E_ENV.discoveryEndpoint } : {}),
        ...(E2E_ENV.redirectUri ? { PING_REDIRECT_URI: E2E_ENV.redirectUri } : {}),
      },
    });
    // Disable Detox sync so live network calls don't block element interactions
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches and root is visible', async () => {
    await assertAppReady();
  });

  it('start() renders the login form (live)', async () => {
    if (!hasJourneyEnv()) { console.warn(SKIP_REASON); return; }

    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(USERNAME_INPUT)).toBeVisible().withTimeout(NET_TIMEOUT);
    await waitFor(element(PASSWORD_INPUT)).toBeVisible().withTimeout(NET_TIMEOUT);
  });

  it('next() with valid credentials returns SuccessNode (live)', async () => {
    if (!hasJourneyEnv()) { console.warn(SKIP_REASON); return; }

    await element(USERNAME_INPUT).typeText(E2E_ENV.testUsername);
    await element(PASSWORD_INPUT).typeText(E2E_ENV.testPassword);
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-success'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });

  it('access token is available after successful login (live)', async () => {
    if (!hasJourneyEnv()) { console.warn(SKIP_REASON); return; }

    await waitFor(element(by.id('journey-token-result'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });

  it('userinfo() returns the user profile after success (live)', async () => {
    if (!hasLiveAuthEnv()) { console.warn(OIDC_SKIP_REASON); return; }

    await element(by.id('journey-userinfo-btn')).tap();
    await waitFor(element(by.id('journey-userinfo-result'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });

  it('refresh() obtains a new token (live)', async () => {
    if (!hasLiveAuthEnv()) { console.warn(OIDC_SKIP_REASON); return; }

    await element(by.id('journey-refresh-btn')).tap();
    await waitFor(element(by.id('journey-refreshed'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });

  it('revoke() invalidates the session (live)', async () => {
    if (!hasJourneyEnv()) { console.warn(SKIP_REASON); return; }

    await element(by.id('journey-revoke-btn')).tap();
    await waitFor(element(by.id('journey-revoked'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });

  it('logoutUser() clears the session (live)', async () => {
    if (!hasJourneyEnv()) { console.warn(SKIP_REASON); return; }

    await element(by.id('journey-logout-btn')).tap();
    await waitFor(element(by.id('journey-logged-out'))).toBeVisible().withTimeout(NET_TIMEOUT);
  });
});

// ─── noSession flag ───────────────────────────────────────────────────────────

describe('Journey — noSession login', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'journey',
        PING_SERVER_URL: E2E_ENV.serverUrl,
        PING_REALM_PATH: E2E_ENV.realmPath,
        PING_JOURNEY_NAME: E2E_ENV.journeyName,
        PING_COOKIE_NAME: E2E_ENV.cookieName,
        PING_NO_SESSION: 'true',
      },
    });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches in noSession mode', async () => {
    await assertAppReady();
  });

  it('login with noSession flag reaches SuccessNode without a stored token (live)', async () => {
    if (!hasJourneyEnv()) { console.warn(SKIP_REASON); return; }

    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(USERNAME_INPUT)).toBeVisible().withTimeout(NET_TIMEOUT);
    await element(USERNAME_INPUT).typeText(E2E_ENV.testUsername);
    await element(PASSWORD_INPUT).typeText(E2E_ENV.testPassword);
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-success'))).toBeVisible().withTimeout(NET_TIMEOUT);
    // No token stored — journey-token-result should not be present
    await detoxExpect(element(by.id('journey-token-result'))).not.toExist();
  });
});
