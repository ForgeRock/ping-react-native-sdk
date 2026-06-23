/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — DaVinci happy-path flow
 *
 * Exercises the DaVinci workflow against a live PingOne DaVinci environment
 * when the required environment variables are set:
 *
 *   PING_DISCOVERY_ENDPOINT  — DaVinci OIDC discovery endpoint
 *   PING_CLIENT_ID           — OIDC client id
 *   PING_REDIRECT_URI        — OIDC redirect URI (optional, defaults to org.forgerock.demo://oauth2redirect)
 *   PING_TEST_USERNAME       — DaVinci username collector value
 *   PING_TEST_PASSWORD       — DaVinci password collector value
 *
 * When env vars are absent the live cases self-skip while the launch smoke test
 * still verifies the scenario screen mounts.
 *
 * Collector testID scheme: `davinci-field-{key}` (e.g. `davinci-field-username`).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import { expect as jestExpect } from '@jest/globals';
import { assertAppReady, E2E_ENV } from './setup';

const NET_TIMEOUT = 30000;

const DAVINCI_USERNAME_KEY =
  process.env['PING_DAVINCI_USERNAME_KEY'] ?? 'username';
const DAVINCI_PASSWORD_KEY =
  process.env['PING_DAVINCI_PASSWORD_KEY'] ?? 'password';

const USERNAME_INPUT = by.id(`davinci-field-${DAVINCI_USERNAME_KEY}`);
const PASSWORD_INPUT = by.id(`davinci-field-${DAVINCI_PASSWORD_KEY}`);

const SKIP_REASON =
  'Live DaVinci env vars not set — skipping DaVinci E2E tests. ' +
  'Set PING_DISCOVERY_ENDPOINT, PING_CLIENT_ID, PING_TEST_USERNAME, PING_TEST_PASSWORD to enable.';

function hasDaVinciEnv(): boolean {
  return !!(
    E2E_ENV.discoveryEndpoint &&
    E2E_ENV.clientId &&
    E2E_ENV.testUsername &&
    E2E_ENV.testPassword
  );
}

describe('DaVinci — happy path', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'davinci',
        ...(E2E_ENV.discoveryEndpoint
          ? { PING_DISCOVERY_ENDPOINT: E2E_ENV.discoveryEndpoint }
          : {}),
        ...(E2E_ENV.clientId ? { PING_CLIENT_ID: E2E_ENV.clientId } : {}),
        ...(E2E_ENV.redirectUri
          ? { PING_REDIRECT_URI: E2E_ENV.redirectUri }
          : {}),
      },
    });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches and root is visible', async () => {
    await assertAppReady();
  });

  it('start button is rendered', async () => {
    await detoxExpect(element(by.id('davinci-start-btn'))).toBeVisible();
  });

  it('start() renders the login form (live)', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('davinci-start-btn')).tap();
    await waitFor(element(USERNAME_INPUT))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await waitFor(element(PASSWORD_INPUT))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('next() with valid credentials returns SuccessNode (live)', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(USERNAME_INPUT).typeText(E2E_ENV.testUsername);
    await element(PASSWORD_INPUT).typeText(E2E_ENV.testPassword);
    await element(by.id('davinci-submit-btn')).tap();
    await waitFor(element(by.id('davinci-success')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('access token is available and non-empty after successful login (live)', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await waitFor(element(by.id('davinci-token-result')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    const attrs = await element(by.id('davinci-token-result')).getAttributes();
    const token = (attrs as any).text ?? (attrs as any).label ?? '';
    jestExpect(token.length).toBeGreaterThan(0);
    jestExpect(token).not.toBe('null');
    jestExpect(token).not.toBe('undefined');
  });

  it('userinfo() returns a payload containing sub (live)', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('davinci-userinfo-btn')).tap();
    await waitFor(element(by.id('davinci-userinfo-result')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    const attrs = await element(
      by.id('davinci-userinfo-result'),
    ).getAttributes();
    const text = (attrs as any).text ?? (attrs as any).label ?? '';
    jestExpect(text).toContain('"sub"');
  });

  it('refresh() obtains a new token (live)', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('davinci-refresh-btn')).tap();
    await waitFor(element(by.id('davinci-refreshed')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('revoke() invalidates the session (live)', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('davinci-revoke-btn')).tap();
    await waitFor(element(by.id('davinci-revoked')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('logoutUser() clears the session (live)', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('davinci-logout-btn')).tap();
    await waitFor(element(by.id('davinci-logged-out')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });
});
