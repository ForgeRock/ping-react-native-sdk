/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — DaVinci METADATA collector pause/resume (SDKS-5384)
 *
 * A DaVinci SDK Integrator connector pauses the flow with a `METADATA`
 * collector carrying an opaque payload; the app performs the on-device work
 * and supplies a result before the flow resumes via `next()`.
 *
 * The live test is env-gated: driving a METADATA field requires a tenant flow
 * whose connector actually pauses with `METADATA`. Unless
 * DAVINCI_METADATA_FLOW is `true`, the live test is registered as skipped, so
 * reports show it as skipped rather than passed. The deterministic scenario UI
 * (payload display, Set result / Set error / Clear controls, unset-state
 * indicator) is covered by the integration suite in
 * `__tests__/integration/davinci.test.ts` without a live flow.
 *
 * To run the live test against a metadata-enabled tenant flow:
 *   1. Set DAVINCI_METADATA_FLOW=true plus the standard DaVinci env vars
 *      (PINGONE_DISCOVERY_ENDPOINT, PINGONE_CLIENT_ID, PINGONE_REDIRECT_URI,
 *      PINGONE_ACR_VALUES — the same set the launchArgs below forward; note
 *      these launch the app's DaVinci scenario unauthenticated, matching
 *      davinci.test.ts — drive any login step through the flow itself).
 *   2. Update DAVINCI_METADATA_KEY below to the connector's collector key.
 *
 * testIDs consumed (see scenarios/DaVinciScenario.tsx manifest):
 *   davinci-field-{key}-metadata-payload / -metadata-value / -metadata-unset
 *   davinci-field-{key}-metadata-set-result / -metadata-set-error / -metadata-clear
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import { expect as jestExpect } from '@jest/globals';
import { assertAppReady, DAVINCI_ENV } from './setup';

const NET_TIMEOUT = 30000;

// Collector key the metadata-enabled connector uses on the pause node.
const DAVINCI_METADATA_KEY =
  process.env['PING_DAVINCI_METADATA_KEY'] ?? 'sdkMetadata';

// Registered as skipped (not silently passed) unless a metadata-enabled tenant
// flow is configured; the file header lists the env vars required to enable it.
const itLive = process.env['DAVINCI_METADATA_FLOW'] === 'true' ? it : it.skip;

const LAUNCH_ARGS = {
  PING_TEST_SCENARIO: 'davinci',
  ...(DAVINCI_ENV.discoveryEndpoint
    ? { PINGONE_DISCOVERY_ENDPOINT: DAVINCI_ENV.discoveryEndpoint }
    : {}),
  ...(DAVINCI_ENV.clientId ? { PINGONE_CLIENT_ID: DAVINCI_ENV.clientId } : {}),
  ...(DAVINCI_ENV.redirectUri
    ? { PINGONE_REDIRECT_URI: DAVINCI_ENV.redirectUri }
    : {}),
  ...(DAVINCI_ENV.acrValues
    ? { PINGONE_ACR_VALUES: DAVINCI_ENV.acrValues }
    : {}),
};

describe('DaVinci — METADATA pause/resume', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: LAUNCH_ARGS });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches and root is visible', async () => {
    await assertAppReady();
  });

  itLive(
    'METADATA field surfaces payload, blocks while unset, then resumes with a result (live)',
    async () => {
      // The flow's first node is a "Select Test Form" whose SUBMIT_BUTTON
      // collector is the "Metadata" capability — the bridge surfaces exactly
      // one submit button here, so it carries the generic davinci-submit-btn
      // testID (verified by probe: its label is "METADATA"). Tapping it is the
      // same navigation the native MetadataCollectorE2ETest performs in
      // navigateToMetadataNode().
      await element(by.id('davinci-start-btn')).tap();
      await waitFor(element(by.id('davinci-submit-btn')))
        .toBeVisible()
        .withTimeout(NET_TIMEOUT);
      await element(by.id('davinci-submit-btn')).tap();

      await waitFor(element(by.id(`davinci-field-${DAVINCI_METADATA_KEY}`)))
        .toBeVisible()
        .withTimeout(NET_TIMEOUT);
      // Re-asserted via detoxExpect: BrowserStack derives the test verdict from
      // explicit expect calls, not waitFor polling.
      await detoxExpect(
        element(
          by.id(`davinci-field-${DAVINCI_METADATA_KEY}-metadata-payload`),
        ),
      ).toBeVisible();

      // Unset state: the blocking indicator is visible until a result is set.
      await detoxExpect(
        element(by.id(`davinci-field-${DAVINCI_METADATA_KEY}-metadata-unset`)),
      ).toBeVisible();

      // Store a demo success result and confirm the value indicator updated.
      await element(
        by.id(`davinci-field-${DAVINCI_METADATA_KEY}-metadata-set-result`),
      ).tap();
      await waitFor(
        element(by.id(`davinci-field-${DAVINCI_METADATA_KEY}-metadata-value`)),
      )
        .toBeVisible()
        .withTimeout(NET_TIMEOUT);
      const attrs = await element(
        by.id(`davinci-field-${DAVINCI_METADATA_KEY}-metadata-value`),
      ).getAttributes();
      const text = (attrs as any).text ?? (attrs as any).label ?? '';
      jestExpect(text).toContain('status');

      // Resume: with the result stored the flow must advance past the pause.
      // The SDK-team metadata flow echoes the submitted result on an
      // "Automation - Message" node and then loops back to the start form
      // (same traversal the native MetadataCollectorE2ETest asserts), so the
      // correct post-resume assertion is that a new form node arrived — not a
      // terminal success screen.
      await element(by.id('davinci-submit-btn')).tap();
      await waitFor(element(by.id('davinci-start-btn')))
        .toBeVisible()
        .withTimeout(NET_TIMEOUT);
      // The next node renders a fresh form: the field container is gone
      // (resumed past the pause) while the scenario stays interactive.
      await detoxExpect(
        element(by.id(`davinci-field-${DAVINCI_METADATA_KEY}-metadata-unset`)),
      ).not.toExist();
    },
  );
});
