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
 * This file is an intentionally thin env-gated scaffold: driving a METADATA
 * field requires a tenant flow whose connector actually pauses with
 * `METADATA` (no such demo flow is configured — the plan's AC7 allowance).
 * The deterministic scenario UI (payload display, Set result / Set error /
 * Clear controls, unset-state indicator) is covered by the integration suite
 * in `__tests__/integration/davinci.test.ts` without a live flow.
 *
 * When a metadata-enabled tenant flow becomes available:
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

const SKIP_REASON =
  'No metadata-enabled DaVinci tenant flow is configured — skipping METADATA E2E tests (SDKS-5384 AC7 allowance). ' +
  'Set DAVINCI_METADATA_FLOW=true plus the DaVinci env vars routed to a connector flow that pauses with METADATA to enable. ' +
  'The deterministic scenario UI is covered by __tests__/integration/davinci.test.ts.';

function hasMetadataFlow(): boolean {
  return process.env['DAVINCI_METADATA_FLOW'] === 'true';
}

describe('DaVinci — METADATA pause/resume', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        PING_TEST_SCENARIO: 'davinci',
        ...(DAVINCI_ENV.discoveryEndpoint
          ? { PINGONE_DISCOVERY_ENDPOINT: DAVINCI_ENV.discoveryEndpoint }
          : {}),
        ...(DAVINCI_ENV.clientId
          ? { PINGONE_CLIENT_ID: DAVINCI_ENV.clientId }
          : {}),
        ...(DAVINCI_ENV.redirectUri
          ? { PINGONE_REDIRECT_URI: DAVINCI_ENV.redirectUri }
          : {}),
        ...(DAVINCI_ENV.acrValues
          ? { PINGONE_ACR_VALUES: DAVINCI_ENV.acrValues }
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

  it('METADATA field surfaces payload, blocks while unset, then resumes with a result (live)', async () => {
    if (!hasMetadataFlow()) {
      console.warn(SKIP_REASON);
      return;
    }

    await element(by.id('davinci-start-btn')).tap();
    await waitFor(element(by.id(`davinci-field-${DAVINCI_METADATA_KEY}`)))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    // Re-asserted via detoxExpect: BrowserStack derives the test verdict from
    // explicit expect calls, not waitFor polling.
    await detoxExpect(
      element(by.id(`davinci-field-${DAVINCI_METADATA_KEY}-metadata-payload`)),
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
    await element(by.id('davinci-submit-btn')).tap();
    await waitFor(element(by.id('davinci-success')))
      .toBeVisible()
      .withTimeout(NET_TIMEOUT);
    await detoxExpect(element(by.id('davinci-success'))).toBeVisible();
  });
});
