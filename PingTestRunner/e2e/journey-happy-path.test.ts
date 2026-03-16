/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Journey happy-path and failure-path flows
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
 * Flows under test:
 *   Happy path:
 *     1. App launches in journey scenario mode
 *     2. createJourneyClient is called with config from env vars
 *     3. start() returns a NameCallback + PasswordCallback node
 *     4. User fills in credentials and calls next()
 *     5. SuccessNode is returned → session tokens are available
 *     6. userinfo() returns the user's profile
 *     7. logoutUser() clears the session
 *
 *   Failure paths:
 *     - Invalid credentials → FailureNode
 *     - Invalid serverUrl → throws synchronously
 *     - Expired / revoked session → revoke() and retry
 */

import { device, element, by } from 'detox';
import { assertAppReady, hasLiveAuthEnv, E2E_ENV } from './setup';

const SKIP_REASON =
  'Live auth env vars not set — skipping Journey E2E tests. ' +
  'See README.md §"Required env vars" to enable.';

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
      },
    });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches and root is visible', async () => {
    await assertAppReady();
  });

  it('start() renders the login form (live)', async () => {
    if (!hasLiveAuthEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('journey-start-btn')).tap();
    // Callback-driven form should appear
    await expect(element(by.id('journey-username-input'))).toBeVisible();
    await expect(element(by.id('journey-password-input'))).toBeVisible();
  });

  it('next() with valid credentials returns SuccessNode (live)', async () => {
    if (!hasLiveAuthEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('journey-username-input')).typeText(E2E_ENV.testUsername);
    await element(by.id('journey-password-input')).typeText(E2E_ENV.testPassword);
    await element(by.id('journey-submit-btn')).tap();

    await expect(element(by.id('journey-success'))).toBeVisible();
  });

  it('userinfo() returns the user profile after success (live)', async () => {
    if (!hasLiveAuthEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('journey-userinfo-btn')).tap();
    await expect(element(by.id('journey-userinfo-result'))).toBeVisible();
  });

  it('logoutUser() clears the session (live)', async () => {
    if (!hasLiveAuthEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('journey-logout-btn')).tap();
    await expect(element(by.id('journey-logged-out'))).toBeVisible();
  });
});

// ─── failure paths ───────────────────────────────────────────────────────────

describe('Journey — failure paths', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'journey-failure',
        PING_SERVER_URL: E2E_ENV.serverUrl,
        PING_REALM_PATH: E2E_ENV.realmPath,
        PING_JOURNEY_NAME: E2E_ENV.journeyName,
      },
    });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches when scenario is journey-failure', async () => {
    await assertAppReady();
  });

  it('next() with invalid credentials shows failure node (live)', async () => {
    if (!hasLiveAuthEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('journey-start-btn')).tap();
    await element(by.id('journey-username-input')).typeText('invalid_user');
    await element(by.id('journey-password-input')).typeText('wrong_password');
    await element(by.id('journey-submit-btn')).tap();

    await expect(element(by.id('journey-failure'))).toBeVisible();
  });

  it('revoke() and re-login succeeds after session expiry (live)', async () => {
    if (!hasLiveAuthEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    // Trigger session revocation
    await element(by.id('journey-revoke-btn')).tap();
    await expect(element(by.id('journey-revoked'))).toBeVisible();

    // Re-authenticate
    await element(by.id('journey-start-btn')).tap();
    await element(by.id('journey-username-input')).typeText(E2E_ENV.testUsername);
    await element(by.id('journey-password-input')).typeText(E2E_ENV.testPassword);
    await element(by.id('journey-submit-btn')).tap();
    await expect(element(by.id('journey-success'))).toBeVisible();
  });
});
