/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Journey backchannel (transactional) authentication.
 *
 * Two tiers:
 * 1. Offline validation matrix — always runs; verifies the blank-URI reject
 *    path and the host-mismatch FailureNode resolve path with no gateway.
 * 2. Live gateway tier — when `PING_BACKCHANNEL_CLIENT_ID` and
 *    `PING_BACKCHANNEL_CLIENT_SECRET` are set, the scenario simulates the
 *    gateway itself (client-credentials token + backchannel/initialize),
 *    mirroring the native QA harness
 *    (ping-android-sdk BackchannelAuthenticationE2ETest, journey
 *    `back-channel-authentication`). Each live test initializes a fresh
 *    transaction and drives it through the app.
 */

import { device, element, by, waitFor } from 'detox';
import { assertAppReady, E2E_ENV } from './setup';
import {
  backchannelConfigFromEnv,
  initializeBackchannelTransaction,
} from './backchannel-client';

const NET_TIMEOUT = 60000;

const SKIP_REASON =
  'PING_BACKCHANNEL_CLIENT_ID/SECRET not set — skipping live backchannel E2E. ' +
  'Set PING_SERVER_URL, PING_TEST_USERNAME, PING_BACKCHANNEL_CLIENT_ID and ' +
  'PING_BACKCHANNEL_CLIENT_SECRET (the gateway OAuth2 client with the ' +
  'back_channel_authentication scope) to enable.';

function gatewayLaunchArgs(): Record<string, string> {
  return {
    PING_TEST_SCENARIO: 'journey-backchannel',
    PING_SERVER_URL: E2E_ENV.serverUrl,
    PING_REALM_PATH: E2E_ENV.realmPath,
    PING_TEST_USERNAME: E2E_ENV.testUsername,
    PING_BACKCHANNEL_CLIENT_ID: process.env['PING_BACKCHANNEL_CLIENT_ID'] ?? '',
    PING_BACKCHANNEL_CLIENT_SECRET:
      process.env['PING_BACKCHANNEL_CLIENT_SECRET'] ?? '',
    PING_BACKCHANNEL_JOURNEY_NAME:
      process.env['PING_BACKCHANNEL_JOURNEY_NAME'] ??
      'back-channel-authentication',
  };
}

describe('Journey — backchannel authentication', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: gatewayLaunchArgs(),
    });
    await assertAppReady();
  });

  it('offline validation matrix passes without a gateway transaction', async () => {
    await element(by.id('backchannel-validation-btn')).tap();
    await waitFor(element(by.id('backchannel-success')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('live transaction initialized from gateway reaches SuccessNode', async () => {
    const config = backchannelConfigFromEnv();
    if (!config) {
      console.warn(SKIP_REASON);
      return;
    }

    // Initialize a fresh transaction from the test process, then hand the
    // redirectUri to the scenario through the launch arg so the app exercises
    // exactly the app-received path.
    const { redirectUri } = await initializeBackchannelTransaction(config);
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        ...gatewayLaunchArgs(),
        PING_BACKCHANNEL_REDIRECT_URI: redirectUri,
      },
    });

    await element(by.id('backchannel-start-btn')).tap();
    await waitFor(element(by.id('backchannel-continue-node')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);

    // The back-channel-authentication tree lands on login callbacks.
    const usernameInput = by.id('backchannel-credential-username');
    const passwordInput = by.id('backchannel-credential-password');
    await waitFor(element(usernameInput))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await element(usernameInput).typeText(E2E_ENV.testUsername);
    await element(passwordInput).typeText(E2E_ENV.testPassword);
    await element(by.id('backchannel-submit-btn')).tap();
    await waitFor(element(by.id('backchannel-success')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });

  it('unknown transaction id surfaces ErrorNode message', async () => {
    const config = backchannelConfigFromEnv();
    if (!config) {
      console.warn(SKIP_REASON);
      return;
    }

    const unknownUri =
      `${E2E_ENV.serverUrl}/UI/Login?realm=%2F${config.realm}` +
      `&authIndexType=transaction&authIndexValue=${Date.now()}-unknown`;
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        ...gatewayLaunchArgs(),
        PING_BACKCHANNEL_REDIRECT_URI: unknownUri,
      },
    });

    await element(by.id('backchannel-start-btn')).tap();
    await waitFor(element(by.id('backchannel-error-node')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
  });
});
