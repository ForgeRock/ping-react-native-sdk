/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { DeviceProfileCollector, JourneyInstance } from '../types';

type ReactNativeMock = {
  NativeModules: Record<string, unknown>;
  TurboModuleRegistry: { getEnforcing: jest.Mock };
};

const createReactNativeMock = (overrides: Partial<ReactNativeMock>) => {
  const base: ReactNativeMock = {
    NativeModules: {},
    TurboModuleRegistry: { getEnforcing: jest.fn(() => ({})) },
  };

  return { ...base, ...overrides };
};

const loadModule = async ({
  nativeModule,
  turboModule,
  enableTurbo,
}: {
  nativeModule?: Record<string, unknown>;
  turboModule?: Record<string, unknown>;
  enableTurbo?: boolean;
}) => {
  jest.resetModules();
  (global as { __turboModuleProxy?: unknown }).__turboModuleProxy =
    enableTurbo ? {} : undefined;

  const getEnforcing = jest.fn(() => {
    if (!turboModule) {
      throw new Error('missing');
    }
    return turboModule;
  });

  jest.doMock('react-native', () =>
    createReactNativeMock({
      NativeModules: nativeModule ?? {},
      TurboModuleRegistry: { getEnforcing },
    })
  );

  jest.doMock('@react-native-pingidentity/logger', () => ({
    logger: jest.fn(() => ({
      changeLevel: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    })),
  }));

  return require('../index');
};

describe('device-profile package', () => {
  it('collects a device profile via the classic native module', async () => {
    const collectDeviceProfile = jest.fn(() =>
      Promise.resolve({ hardware: { model: 'mock' } })
    );
    const { collectDeviceProfile: collect } = await loadModule({
      nativeModule: { RNPingDeviceProfileClassic: { collectDeviceProfile } },
    });

    const collectors: DeviceProfileCollector[] = ['hardware', 'network'];
    const result = await collect(collectors);

    expect(collectDeviceProfile).toHaveBeenCalledWith(collectors);
    expect(result).toEqual({ hardware: { model: 'mock' } });
  });

  it('collects a device profile for a Journey instance', async () => {
    const collectDeviceProfileForJourney = jest.fn(() =>
      Promise.resolve({ type: 'success' })
    );
    const { collectDeviceProfileForJourney: collectForJourney } =
      await loadModule({
        nativeModule: {
          RNPingDeviceProfileClassic: { collectDeviceProfileForJourney },
        },
      });

    const journey: JourneyInstance = {
      getId: jest.fn(() => Promise.resolve('journey-123')),
    };
    const collectors: DeviceProfileCollector[] = ['browser'];
    const result = await collectForJourney(journey, collectors);

    expect(journey.getId).toHaveBeenCalledTimes(1);
    expect(collectDeviceProfileForJourney).toHaveBeenCalledWith(
      'journey-123',
      collectors
    );
    expect(result).toEqual({ type: 'success' });
  });

  it('propagates native errors when collecting a device profile', async () => {
    const error = new Error('native failure');
    const collectDeviceProfile = jest.fn(() => Promise.reject(error));
    const { collectDeviceProfile: collect } = await loadModule({
      nativeModule: { RNPingDeviceProfileClassic: { collectDeviceProfile } },
    });

    await expect(collect(['platform'])).rejects.toThrow(error);
  });

  it('propagates journey errors before invoking native collection', async () => {
    const collectDeviceProfileForJourney = jest.fn();
    const { collectDeviceProfileForJourney: collectForJourney } =
      await loadModule({
        nativeModule: {
          RNPingDeviceProfileClassic: { collectDeviceProfileForJourney },
        },
      });

    const journey: JourneyInstance = {
      getId: jest.fn(() => Promise.reject(new Error('journey failure'))),
    };

    await expect(collectForJourney(journey, ['platform'])).rejects.toThrow(
      'journey failure'
    );
    expect(collectDeviceProfileForJourney).not.toHaveBeenCalled();
  });

  it('uses TurboModule when New Architecture is enabled', async () => {
    const collectDeviceProfile = jest.fn(() =>
      Promise.resolve({ network: { ip: '127.0.0.1' } })
    );
    const { collectDeviceProfile: collect } = await loadModule({
      turboModule: { collectDeviceProfile },
      enableTurbo: true,
    });

    await collect(['network']);

    expect(collectDeviceProfile).toHaveBeenCalledTimes(1);
  });

  it('falls back to the classic module when TurboModule is missing', async () => {
    const collectDeviceProfile = jest.fn(() =>
      Promise.resolve({ platform: { os: 'ios' } })
    );
    const { collectDeviceProfile: collect } = await loadModule({
      nativeModule: { RNPingDeviceProfileClassic: { collectDeviceProfile } },
      enableTurbo: true,
    });

    await collect(['platform']);

    expect(collectDeviceProfile).toHaveBeenCalledTimes(1);
  });

  it('throws when called without a native module', async () => {
    await expect(loadModule({})).rejects.toThrow(
      'Native RNPingDeviceProfile module not found.'
    );
  });

  it('includes available module names in the missing-module error', async () => {
    await expect(
      loadModule({
        nativeModule: { SomeOtherModule: {} },
      })
    ).rejects.toThrow(
      'Available NativeModules: [\"SomeOtherModule\"]'
    );
  });
});
