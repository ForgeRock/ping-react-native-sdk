/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — App launch smoke test
 *
 * Verifies that PingTestRunner launches successfully, the root view renders,
 * and the header with the app title is visible.  This is the baseline test
 * that must pass before any other E2E suite is meaningful.
 */

import { device, element, by, expect as detoxExpect } from 'detox';
import { assertAppReady } from './setup';

describe('PingTestRunner — app launch', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('renders the root container', async () => {
    await assertAppReady();
  });

  it('displays the PingTestRunner title', async () => {
    await detoxExpect(element(by.id('ping-test-runner-title'))).toBeVisible();
    await detoxExpect(element(by.text('PingTestRunner'))).toBeVisible();
  });

  it('displays the header section', async () => {
    await detoxExpect(element(by.id('ping-test-runner-header'))).toBeVisible();
  });

  it('displays the body section', async () => {
    await detoxExpect(element(by.id('ping-test-runner-body'))).toBeVisible();
  });
});
