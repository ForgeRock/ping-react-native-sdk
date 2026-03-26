/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-device-profile
 *
 * Validates that the device-profile package:
 * - Exports the expected public API
 * - Delegates collectDeviceProfile calls to the native module
 * - Returns a valid profile object
 * - Propagates native errors to callers
 */

type NativeDeviceProfileMock = {
  collectDeviceProfile: jest.Mock;
  collectDeviceProfileForJourney: jest.Mock;
};

function makeMock(overrides: Partial<NativeDeviceProfileMock> = {}): NativeDeviceProfileMock {
  return {
    collectDeviceProfile: jest.fn(async () => ({ platform: 'android', version: '13' })),
    collectDeviceProfileForJourney: jest.fn(async () => ({ nodeId: 'node-1', profile: {} })),
    ...overrides,
  };
}

async function loadDeviceProfile(nativeMock: NativeDeviceProfileMock) {
  jest.resetModules();
  jest.doMock('../../../packages/device-profile/src/NativeRNPingDeviceProfile', () => ({
    __esModule: true,
    getNativeModule: jest.fn(() => nativeMock),
  }));
  return require('@ping-identity/rn-device-profile');
}

describe('@ping-identity/rn-device-profile — integration', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('public API surface', () => {
    it('exports collectDeviceProfile function', async () => {
      const mod = await loadDeviceProfile(makeMock());
      expect(typeof mod.collectDeviceProfile).toBe('function');
    });

    it('exports collectDeviceProfileForJourney function', async () => {
      const mod = await loadDeviceProfile(makeMock());
      expect(typeof mod.collectDeviceProfileForJourney).toBe('function');
    });
  });

  describe('collectDeviceProfile()', () => {
    it('returns an object from the native module', async () => {
      const mock = makeMock();
      const mod = await loadDeviceProfile(mock);

      const profile = await mod.collectDeviceProfile([]);
      expect(typeof profile).toBe('object');
      expect(profile).not.toBeNull();
    });

    it('delegates to native collectDeviceProfile exactly once', async () => {
      const mock = makeMock();
      const mod = await loadDeviceProfile(mock);

      await mod.collectDeviceProfile([]);
      expect(mock.collectDeviceProfile).toHaveBeenCalledTimes(1);
    });

    it('propagates native errors to callers', async () => {
      const mock = makeMock({
        collectDeviceProfile: jest.fn(async () => {
          throw new Error('Profile collection failed');
        }),
      });
      const mod = await loadDeviceProfile(mock);

      await expect(mod.collectDeviceProfile([])).rejects.toThrow('Profile collection failed');
    });
  });
});
