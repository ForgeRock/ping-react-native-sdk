/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — reCAPTCHA Enterprise wiring (Tier 2 — server required for live path)
 * Server journey tree: a tree containing a ReCaptchaEnterpriseCallback node
 * (site key bound to the test app's package/bundle id).
 *
 * Flow:
 *   1. Launch with PING_TEST_SCENARIO=recaptcha
 *   2. Deterministic paths asserted without a live reCAPTCHA environment:
 *      - verify button renders
 *      - verify attempt surfaces a result payload (success, failure, or error)
 *   3. Live path (requires PING_SERVER_URL + a reCAPTCHA Enterprise-enabled
 *      tree): start() renders the captcha field, verify surfaces the outcome,
 *      Next advances the flow.
 *
 * Real Google verification requires an environment-configured site key; this
 * suite asserts bridge wiring, not Google's service.
 *
 * TODO-SDKS-5390: add a comprehensive full-journey e2e for Android and iOS —
 * drive the entire tree (start → NameCallback auto-fill from PING_TEST_USERNAME →
 * ChoiceCallback test-case select → ReCaptchaEnterpriseCallback verify →
 * SuccessNode/FailureNode assertion), mirroring the native Android suite in
 * ping-android-sdk journey/src/androidTest/.../recaptchaEnterprise/. Requires
 * the reCAPTCHA site key to allowlist the test app's package/bundle id and a
 * real device for Google attestation (emulators are rejected by DeviceSkipRule
 * upstream for the same reason).
 */

import { device, element, by, waitFor, expect as detoxExpect } from 'detox';
import { assertAppReady, hasJourneyEnv, E2E_ENV } from './setup';

const RECAPTCHA_TREE = 'TEST-e2e-recaptcha-enterprise';
const SKIP_REASON =
  'reCAPTCHA live-path tests require a live Journey env with a reCAPTCHA Enterprise-enabled tree. Set PING_SERVER_URL, PING_TEST_USERNAME, and PING_TEST_PASSWORD.';
const NET_TIMEOUT = 30000;

describe('reCAPTCHA — scenario wiring', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'recaptcha',
      },
    });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches', async () => {
    await assertAppReady();
  });

  it('verify button renders without a configured environment', async () => {
    await waitFor(element(by.id('recaptcha-verify-button')))
      .toBeVisible()
      .withTimeout(5000);
    // Re-asserted via detoxExpect: BrowserStack derives the test verdict from explicit expect calls, not waitFor polling.
    await detoxExpect(element(by.id('recaptcha-verify-button'))).toBeVisible();
  });

  it('verify attempt surfaces a deterministic degradation result', async () => {
    await element(by.id('recaptcha-verify-button')).tap();
    await waitFor(element(by.id('recaptcha-result')))
      .toBeVisible()
      .withTimeout(5000);
    // Re-asserted via detoxExpect: BrowserStack derives the test verdict from explicit expect calls, not waitFor polling.
    await detoxExpect(element(by.id('recaptcha-result'))).toBeVisible();
  });
});

describe('reCAPTCHA — live journey flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'recaptcha',
        PING_SERVER_URL: E2E_ENV.serverUrl,
        PING_REALM_PATH: E2E_ENV.realmPath,
        PING_JOURNEY_NAME: RECAPTCHA_TREE,
        PING_COOKIE_NAME: E2E_ENV.cookieName,
      },
    });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches', async () => {
    await assertAppReady();
  });

  it('start() renders the captcha field and verify button (live)', async () => {
    if (!hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('recaptcha-start-btn')).tap();
    await waitFor(element(by.id('recaptcha-verify-button')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await detoxExpect(element(by.id('recaptcha-verify-button'))).toBeVisible();
  });

  it('verify attempt surfaces success or failure payload (live)', async () => {
    if (!hasJourneyEnv()) {
      console.warn(SKIP_REASON);
      return;
    }
    await element(by.id('recaptcha-start-btn')).tap();
    await waitFor(element(by.id('recaptcha-verify-button')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await element(by.id('recaptcha-verify-button')).tap();
    await waitFor(element(by.id('recaptcha-result')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    // Re-asserted via detoxExpect: BrowserStack derives the test verdict from explicit expect calls, not waitFor polling.
    await detoxExpect(element(by.id('recaptcha-result'))).toBeVisible();
  });
});
