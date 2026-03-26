/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — App open/close smoke test
 *
 * Minimal baseline check:
 * - launch app
 * - verify root is visible
 * - terminate app
 */

import { device } from 'detox';
import { assertAppReady } from './setup';

describe('PingTestRunner — app open/close', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('opens and renders the root view', async () => {
    await assertAppReady();
  });
});
