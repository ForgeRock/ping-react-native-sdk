/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Journey invalid-credential and failure handling paths.
 */

import { device, element, by, waitFor } from 'detox';
import { assertAppReady, hasJourneyEnv, E2E_ENV } from './setup';

const NET_TIMEOUT = 30000; // ms to wait for network-dependent elements

const SKIP_REASON =
  'Live journey env vars not set — skipping Journey E2E tests. ' +
  'Set PING_SERVER_URL, PING_TEST_USERNAME, PING_TEST_PASSWORD to enable.';

const USERNAME_INPUT = by.id('journey-field-NameCallback:0');
const PASSWORD_INPUT = by.id('journey-field-PasswordCallback:0');

describe('Journey — invalid-credential handling', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'journey-failure',
        PING_SERVER_URL: E2E_ENV.serverUrl,
        PING_REALM_PATH: E2E_ENV.realmPath,
        PING_JOURNEY_NAME: E2E_ENV.journeyName,
        PING_COOKIE_NAME: E2E_ENV.cookieName,
      },
    });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches when scenario is journey-failure', async () => {
    await assertAppReady();
  });

  it('next() with invalid credentials shows ErrorNode message (live)', async () => {
    if (!hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(USERNAME_INPUT))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);

    await element(USERNAME_INPUT).typeText(E2E_ENV.testUsername);
    await element(PASSWORD_INPUT).typeText('wrong_password');
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-failure')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);

    const messageMatchers = [
      by.text('Login Failure'),
      by.text('Login failure'),
      by.id('journey-failure-message'),
    ];

    let matched = false;
    for (const matcher of messageMatchers) {
      try {
        await waitFor(element(matcher)).toBeVisible().withTimeout(5000);
        matched = true;
        break;
      } catch {
        // Try the next acceptable message variant.
      }
    }

    if (!matched) {
      throw new Error(
        'Expected a failure message for invalid credentials, but none matched.',
      );
    }
  });

  it('revoke() and re-login succeeds after session expiry (live)', async () => {
    if (!hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }

    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'journey',
        PING_SERVER_URL: E2E_ENV.serverUrl,
        PING_REALM_PATH: E2E_ENV.realmPath,
        PING_JOURNEY_NAME: E2E_ENV.journeyName,
        PING_COOKIE_NAME: E2E_ENV.cookieName,
      },
    });
    await device.disableSynchronization();

    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(USERNAME_INPUT))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await element(USERNAME_INPUT).typeText(E2E_ENV.testUsername);
    await element(PASSWORD_INPUT).typeText(E2E_ENV.testPassword);
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-success')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);

    await element(by.id('journey-revoke-btn')).tap();
    await waitFor(element(by.id('journey-revoked')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);

    await element(by.id('journey-start-btn')).tap();
    await waitFor(element(USERNAME_INPUT))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await element(USERNAME_INPUT).typeText(E2E_ENV.testUsername);
    await element(PASSWORD_INPUT).typeText(E2E_ENV.testPassword);
    await element(by.id('journey-submit-btn')).tap();
    await waitFor(element(by.id('journey-success')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });
});
