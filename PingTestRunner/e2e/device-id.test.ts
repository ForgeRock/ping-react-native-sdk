/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Device ID bridge verification (Tier 1 — no server required)
 *
 * Exercises the real native bridge on a simulator/emulator.
 *
 * Android SDK parity:
 *   testIdNotNull        → getDeviceId() returns non-empty string
 *   testIdConsistency    → same value on second call
 *   testIdFormat         → 64-char hex string (SHA-256)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { device, element, by, expect as detoxExpect } from 'detox';
import { expect as jestExpect } from '@jest/globals';
import { assertAppReady } from './setup';

describe('Device ID — bridge verification', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { PING_TEST_SCENARIO: 'device-id' },
    });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches in device-id scenario', async () => {
    await assertAppReady();
  });

  it('getDeviceId() returns a non-empty string', async () => {
    await element(by.id('device-id-get-btn')).tap();
    // result element only mounts when getDeviceId() returns a non-empty string
    await detoxExpect(element(by.id('device-id-result'))).toBeVisible();
  });

  it('getDeviceId() result is a 64-char hex string (SHA-256 format)', async () => {
    const attrs = await element(by.id('device-id-result')).getAttributes();
    const text = (attrs as any).text ?? (attrs as any).label ?? '';
    jestExpect(text).toMatch(/^[0-9a-f]{64}$/i);
  });

  it('getDeviceId() returns the same value on second call (consistency)', async () => {
    await element(by.id('device-id-get-again-btn')).tap();
    await detoxExpect(element(by.id('device-id-result-2'))).toBeVisible();
    const attrs1 = await element(by.id('device-id-result')).getAttributes();
    const attrs2 = await element(by.id('device-id-result-2')).getAttributes();
    const id1 = (attrs1 as any).text ?? (attrs1 as any).label ?? '';
    const id2 = (attrs2 as any).text ?? (attrs2 as any).label ?? '';
    jestExpect(id1).toBe(id2);
  });

  it('no error is shown', async () => {
    await detoxExpect(element(by.id('device-id-error'))).not.toBeVisible();
  });
});
