/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Logger bridge verification (Tier 1 — no server required)
 *
 * Android SDK parity:
 *   testConsoleLogger → create debug logger, call all 4 levels
 *   testWarnLogger    → changeLevel('warn') does not throw
 *   testNoneLogger    → level 'none' logger creates without throwing
 */

import { device, element, by, expect as detoxExpect } from 'detox';
import { assertAppReady } from './setup';

describe('Logger — bridge verification', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { PING_TEST_SCENARIO: 'logger' },
    });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches in logger scenario', async () => {
    await assertAppReady();
  });

  it('logger({ level: debug }) creates without throwing', async () => {
    await element(by.id('logger-create-btn')).tap();
    await detoxExpect(element(by.id('logger-ready'))).toBeVisible();
  });

  it('debug(), info(), warn(), error() all callable without throwing', async () => {
    await element(by.id('logger-log-btn')).tap();
    await detoxExpect(element(by.id('logger-logged'))).toBeVisible();
  });

  it('changeLevel(warn) completes without throwing', async () => {
    await element(by.id('logger-change-level-btn')).tap();
    await detoxExpect(element(by.id('logger-level-changed'))).toBeVisible();
  });

  it('logger({ level: none }) creates without throwing', async () => {
    await element(by.id('logger-none-btn')).tap();
    await detoxExpect(element(by.id('logger-none-ready'))).toBeVisible();
  });

  it('no error is shown', async () => {
    await detoxExpect(element(by.id('logger-error'))).not.toBeVisible();
  });
});
