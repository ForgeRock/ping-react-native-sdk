/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-browser
 *
 * Validates that the browser package:
 * - Exports the expected public API surface
 * - Correctly delegates to the native module
 * - Handles native errors gracefully
 */

const TEST_URL = 'https://example.com/oauth2/authorize';

// ─── helpers ────────────────────────────────────────────────────────────────

type NativeBrowserMock = {
  configure: jest.Mock;
  reset: jest.Mock;
  open: jest.Mock;
};

function makeMock(overrides: Partial<NativeBrowserMock> = {}): NativeBrowserMock {
  return {
    configure: jest.fn(),
    reset: jest.fn(),
    open: jest.fn(async () => ({ type: 'success', url: 'com.example://callback' })),
    ...overrides,
  };
}

async function loadBrowser(nativeMock: NativeBrowserMock) {
  jest.resetModules();
  jest.doMock('../../../packages/browser/src/NativeRNPingBrowser', () => ({
    __esModule: true,
    getNativeModule: jest.fn(() => nativeMock),
  }));
  return require('@ping-identity/rn-browser');
}

// ─── suite ──────────────────────────────────────────────────────────────────

describe('@ping-identity/rn-browser — integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('public API surface', () => {
    it('exports open function', async () => {
      const browser = await loadBrowser(makeMock());
      expect(typeof browser.open).toBe('function');
    });

    it('exports configureBrowser function', async () => {
      const browser = await loadBrowser(makeMock());
      expect(typeof browser.configureBrowser).toBe('function');
    });

    it('exports resetBrowser function', async () => {
      const browser = await loadBrowser(makeMock());
      expect(typeof browser.resetBrowser).toBe('function');
    });
  });

  describe('open()', () => {
    it('delegates to native open with the correct URL', async () => {
      const mock = makeMock();
      const browser = await loadBrowser(mock);

      await browser.open(TEST_URL, { callbackUrlScheme: 'com.example' });
      expect(mock.open).toHaveBeenCalledTimes(1);
      expect(mock.open).toHaveBeenCalledWith(TEST_URL, expect.any(Object));
    });

    it('returns a result object with type field', async () => {
      const mock = makeMock();
      const browser = await loadBrowser(mock);

      const result = await browser.open(TEST_URL, { callbackUrlScheme: 'com.example' });
      expect(result).toBeDefined();
      expect(typeof result.type).toBe('string');
    });

    it('propagates native errors to the caller', async () => {
      const mock = makeMock({
        open: jest.fn(async () => {
          throw new Error('Browser unavailable');
        }),
      });
      const browser = await loadBrowser(mock);

      await expect(
        browser.open(TEST_URL, { callbackUrlScheme: 'com.example' })
      ).rejects.toThrow('Browser unavailable');
    });
  });

  describe('resetBrowser()', () => {
    it('delegates reset to the native module', async () => {
      const mock = makeMock();
      const browser = await loadBrowser(mock);

      browser.resetBrowser();
      expect(mock.reset).toHaveBeenCalledTimes(1);
    });
  });
});
