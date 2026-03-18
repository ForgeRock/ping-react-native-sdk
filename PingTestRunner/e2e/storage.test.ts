/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * E2E — Storage bridge verification (Tier 1 — no server required)
 *
 * Android SDK parity:
 *   createsStorageWithValidConfig          → session + OIDC handle creation
 *   invalid config path                     → throws OR falls back to native defaults
 */

import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import { expect as jestExpect } from '@jest/globals';
import { assertAppReady } from './setup';

describe('Storage — bridge verification', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: { PING_TEST_SCENARIO: 'storage' },
    });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('app launches in storage scenario', async () => {
    await assertAppReady();
  });

  it('configureSessionStorage returns a handle with kind=session', async () => {
    await element(by.id('storage-session-btn')).tap();
    await detoxExpect(element(by.id('storage-session-result'))).toBeVisible();
    const attrs = await element(by.id('storage-session-result')).getAttributes();
    const text = (attrs as any).text ?? (attrs as any).label ?? '';
    jestExpect(text).toMatch(/^session:.+$/);
  });

  it('configureOidcStorage returns a handle with kind=oidc', async () => {
    await element(by.id('storage-oidc-btn')).tap();
    await detoxExpect(element(by.id('storage-oidc-result'))).toBeVisible();
    const attrs = await element(by.id('storage-oidc-result')).getAttributes();
    const text = (attrs as any).text ?? (attrs as any).label ?? '';
    jestExpect(text).toMatch(/^oidc:.+$/);
  });

  it('configureSessionStorage with empty config throws or falls back to defaults', async () => {
    await waitFor(element(by.id('storage-invalid-btn'))).toBeVisible().withTimeout(3000);
    await element(by.id('storage-invalid-btn')).tap();
    await waitFor(element(by.id('storage-invalid-status'))).toBeVisible().withTimeout(3000);
    const statusAttrs = await element(by.id('storage-invalid-status')).getAttributes();
    const statusText = (statusAttrs as any).text ?? (statusAttrs as any).label ?? '';

    if (statusText === 'error') {
      await detoxExpect(element(by.id('storage-error'))).toBeVisible();
      return;
    }

    await waitFor(element(by.id('storage-invalid-result'))).toBeVisible().withTimeout(3000);
    const attrs = await element(by.id('storage-invalid-result')).getAttributes();
    const text = (attrs as any).text ?? (attrs as any).label ?? '';
    jestExpect(text).toMatch(/^session:.+$/);
  });
});
