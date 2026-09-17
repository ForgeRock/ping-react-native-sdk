/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — useDaVinci + useDaVinciForm hooks (Tier 2 — server required)
 *
 * Verifies that the hook API produces correct state transitions against real
 * native bridges on device: loading state, node updates, form field rendering
 * via useDaVinciForm, and post-login actions (token, refresh, revoke, logout).
 */

import { device, element, by, waitFor } from 'detox';
import { assertAppReady, DAVINCI_ENV } from './setup';

const SKIP_REASON =
  'useDaVinci hook tests require a live DaVinci env. Set PINGONE_DISCOVERY_ENDPOINT, ' +
  'PINGONE_CLIENT_ID, PINGONE_USERNAME, and PINGONE_PASSWORD.';

const DAVINCI_USERNAME_KEY =
  process.env['PING_DAVINCI_USERNAME_KEY'] ?? 'username';
const DAVINCI_PASSWORD_KEY =
  process.env['PING_DAVINCI_PASSWORD_KEY'] ?? 'password';

const USERNAME_INPUT = by.id(`use-davinci-field-${DAVINCI_USERNAME_KEY}`);
const PASSWORD_INPUT = by.id(`use-davinci-field-${DAVINCI_PASSWORD_KEY}`);
// The login screen carries several submit buttons (Sign On / Register /
// Trouble); target Sign On by its rendered label. Falls back to the shared
// testID for single-button flows.
const SIGNON_BUTTON = by.text('Sign On');
const SUBMIT_FALLBACK = by.id('use-davinci-submit-btn');

async function tapSubmitButton(): Promise<void> {
  try {
    await element(SIGNON_BUTTON).tap();
  } catch {
    await element(SUBMIT_FALLBACK).tap();
  }
}

function hasDaVinciEnv(): boolean {
  return !!(
    DAVINCI_ENV.discoveryEndpoint &&
    DAVINCI_ENV.clientId &&
    DAVINCI_ENV.testUsername &&
    DAVINCI_ENV.testPassword
  );
}

const DAVINCI_LAUNCH_ARGS = {
  PING_TEST_SCENARIO: 'use-davinci',
  PINGONE_DISCOVERY_ENDPOINT: DAVINCI_ENV.discoveryEndpoint,
  PINGONE_CLIENT_ID: DAVINCI_ENV.clientId,
  PINGONE_REDIRECT_URI: DAVINCI_ENV.redirectUri,
  // Clear a persisted SSO session at mount so start() reaches the login form
  // instead of returning SuccessNode from a session left by a previous run.
  PING_CLEAR_STORAGE: 'true',
  ...(DAVINCI_ENV.acrValues
    ? { PINGONE_ACR_VALUES: DAVINCI_ENV.acrValues }
    : {}),
};

const NET_TIMEOUT = 30000;

describe('useDaVinci + useDaVinciForm — hook state transitions', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: DAVINCI_LAUNCH_ARGS,
    });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches', async () => {
    await assertAppReady();
  });

  it('start() surfaces login form via useDaVinciForm fields', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('use-davinci-start-btn')).tap();
    await waitFor(element(USERNAME_INPUT))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await waitFor(element(PASSWORD_INPUT)).toBeVisible().withTimeout(5000);
  });

  it('next() with valid credentials reaches SuccessNode', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(USERNAME_INPUT).typeText(DAVINCI_ENV.testUsername);
    await element(PASSWORD_INPUT).typeText(DAVINCI_ENV.testPassword);
    await tapSubmitButton();
    await waitFor(element(by.id('use-davinci-success')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('token is available after success', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await waitFor(element(by.id('use-davinci-token-result')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('userinfo() returns a payload via hook actions', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('use-davinci-userinfo-btn')).tap();
    await waitFor(element(by.id('use-davinci-userinfo-result')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('refresh() updates token via hook actions', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('use-davinci-refresh-btn')).tap();
    await waitFor(element(by.id('use-davinci-refreshed')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('revoke() completes via hook actions', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('use-davinci-revoke-btn')).tap();
    await waitFor(element(by.id('use-davinci-revoked')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('logoutUser() completes via hook actions', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('use-davinci-logout-btn')).tap();
    await waitFor(element(by.id('use-davinci-logged-out')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });
});

describe('useDaVinci — ErrorNode on wrong credentials', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: DAVINCI_LAUNCH_ARGS,
    });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches', async () => {
    await assertAppReady();
  });

  it('next() with wrong password reaches ErrorNode', async () => {
    if (!hasDaVinciEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('use-davinci-start-btn')).tap();
    await waitFor(element(USERNAME_INPUT))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await element(USERNAME_INPUT).typeText(DAVINCI_ENV.testUsername);
    await element(PASSWORD_INPUT).typeText('wrong_password');
    await tapSubmitButton();
    await waitFor(element(by.id('use-davinci-error-node')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });
});
