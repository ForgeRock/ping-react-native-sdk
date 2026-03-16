/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — OIDC happy-path flow
 *
 * Exercises the full OIDC authorization code flow against a live PingOne /
 * PingAM server when the required environment variables are set:
 *
 *   PING_DISCOVERY_ENDPOINT   — OIDC discovery endpoint
 *   PING_CLIENT_ID            — OAuth2 client ID
 *   PING_REDIRECT_URI         — Redirect URI registered on the server
 *   PING_TEST_USERNAME        — Test user's username
 *   PING_TEST_PASSWORD        — Test user's password
 *
 * When the env vars are absent the suite is skipped automatically; the
 * remaining tests still run to validate the app's baseline behaviour.
 *
 * Flow under test:
 *   1. App launches in OIDC scenario mode
 *   2. createOidcClient is called with config from env vars
 *   3. createOidcWebClient wraps the client
 *   4. authorize() opens the browser
 *   5. User logs in; browser redirects back
 *   6. tokens are available via user.token()
 *   7. userinfo() returns the authenticated user's profile
 *   8. logout() clears the session
 */

import { device, element, by } from 'detox';
import { assertAppReady, hasLiveAuthEnv, E2E_ENV } from './setup';

const SKIP_REASON =
  'Live auth env vars not set — skipping OIDC E2E tests. ' +
  'See README.md §"Required env vars" to enable.';

describe('OIDC — happy path', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'oidc',
        PING_DISCOVERY_ENDPOINT: E2E_ENV.discoveryEndpoint,
        PING_CLIENT_ID: E2E_ENV.clientId,
        PING_REDIRECT_URI: E2E_ENV.redirectUri,
      },
    });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches and root is visible', async () => {
    await assertAppReady();
  });

  // ── Live-server tests (skipped when env vars are absent) ──────────────────

  it('OIDC authorize opens external browser (live)', async () => {
    if (!hasLiveAuthEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    // Tap the authorize button (rendered when PING_TEST_SCENARIO=oidc)
    await element(by.id('oidc-authorize-btn')).tap();
    // The in-app browser / Chrome Custom Tab should open
    await expect(element(by.id('oidc-browser-open'))).toBeVisible();
  });

  it('OIDC tokens are available after successful login (live)', async () => {
    if (!hasLiveAuthEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    // Fill in credentials inside the browser WebView
    await element(by.id('username-input')).typeText(E2E_ENV.testUsername);
    await element(by.id('password-input')).typeText(E2E_ENV.testPassword);
    await element(by.id('submit-btn')).tap();

    // After redirect back, token result screen should be visible
    await expect(element(by.id('oidc-token-result'))).toBeVisible();
  });

  it('OIDC userinfo returns authenticated profile (live)', async () => {
    if (!hasLiveAuthEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('oidc-userinfo-btn')).tap();
    await expect(element(by.id('oidc-userinfo-result'))).toBeVisible();
  });

  it('OIDC logout clears the session (live)', async () => {
    if (!hasLiveAuthEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('oidc-logout-btn')).tap();
    await expect(element(by.id('oidc-logged-out'))).toBeVisible();
  });
});

describe('OIDC — failure paths', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { PING_TEST_SCENARIO: 'oidc-failure' },
    });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches when scenario is oidc-failure', async () => {
    await assertAppReady();
  });

  it('shows error UI when discoveryEndpoint is unreachable (live)', async () => {
    if (!hasLiveAuthEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('oidc-authorize-btn')).tap();
    await expect(element(by.id('oidc-error-message'))).toBeVisible();
  });
});
