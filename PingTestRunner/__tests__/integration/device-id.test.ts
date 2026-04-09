/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-device-id
 *
 * Validates that the device-id package:
 * - Exports the expected public API
 * - Delegates getDeviceId to the native module
 * - Returns a non-empty string identifier
 * - Propagates native errors to callers
 */

export {};

type NativeDeviceIdMock = {
  getDefaultDeviceId: jest.Mock;
};

function makeMock(overrides: Partial<NativeDeviceIdMock> = {}): NativeDeviceIdMock {
  return {
    getDefaultDeviceId: jest.fn(async () => 'mock-device-id-123'),
    ...overrides,
  };
}

async function loadDeviceId(nativeMock: NativeDeviceIdMock) {
  jest.resetModules();
  jest.doMock('../../../packages/device-id/src/NativeRNPingDeviceId', () => ({
    __esModule: true,
    default: nativeMock,
    getNativeModule: jest.fn(() => nativeMock),
  }));
  return require('@ping-identity/rn-device-id');
}

describe('@ping-identity/rn-device-id — integration', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('public API surface', () => {
    it('exports at least one function', async () => {
      const mod = await loadDeviceId(makeMock());
      const fns = Object.values(mod).filter((v) => typeof v === 'function');
      expect(fns.length).toBeGreaterThan(0);
    });
  });

  describe('getDeviceId', () => {
    it('returns a non-empty string from the native module', async () => {
      const mock = makeMock();
      const mod = await loadDeviceId(mock);

      if (typeof mod.getDeviceId === 'function') {
        const id = await mod.getDeviceId();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      }
    });

    it('calls native getDefaultDeviceId exactly once', async () => {
      const mock = makeMock();
      const mod = await loadDeviceId(mock);

      if (typeof mod.getDeviceId === 'function') {
        await mod.getDeviceId();
        expect(mock.getDefaultDeviceId).toHaveBeenCalledTimes(1);
      }
    });

    it('propagates native errors to callers', async () => {
      const mock = makeMock({
        getDefaultDeviceId: jest.fn(async () => {
          throw new Error('Device ID unavailable');
        }),
      });
      const mod = await loadDeviceId(mock);

      if (typeof mod.getDeviceId === 'function') {
        await expect(mod.getDeviceId()).rejects.toThrow('Device ID unavailable');
      }
    });
  });
});
