/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { JourneyInstance } from '@ping-identity/rn-types';
import type { DeviceProfileCollector } from '../types';

const createJsLogger = (nativeHandleId = 'custom-logger-id') => ({
  nativeHandle: { id: nativeHandleId },
  changeLevel: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
});

type ReactNativeMock = {
  NativeModules: Record<string, unknown>;
  TurboModuleRegistry: { get: jest.Mock };
};

const createReactNativeMock = (overrides: Partial<ReactNativeMock>) => {
  const base: ReactNativeMock = {
    NativeModules: {},
    TurboModuleRegistry: { get: jest.fn(() => ({})) },
  };

  return { ...base, ...overrides };
};

const loadModule = async ({
  nativeModule,
  turboModule,
}: {
  nativeModule?: Record<string, unknown>;
  turboModule?: Record<string, unknown>;
}) => {
  jest.resetModules();
  const get = jest.fn(() => turboModule);

  jest.doMock('react-native', () =>
    createReactNativeMock({
      NativeModules: nativeModule ?? {},
      TurboModuleRegistry: { get },
    })
  );

  return import('../index');
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
      collectors,
      undefined
    );
    expect(result).toEqual({ type: 'success' });
  });

  it('uses the provided JS logger handle for Journey collection options', async () => {
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
      getId: jest.fn(() => Promise.resolve('journey-logger-test')),
    };

    await collectForJourney(journey, ['hardware'], {
      logger: createJsLogger('logger-from-options'),
    });

    expect(collectDeviceProfileForJourney).toHaveBeenCalledWith(
      'journey-logger-test',
      ['hardware'],
      'logger-from-options'
    );
  });

  it('prefers nativeLogger over logger.nativeHandle for Journey collection', async () => {
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
      getId: jest.fn(() => Promise.resolve('journey-native-logger-test')),
    };

    await collectForJourney(journey, ['network'], {
      logger: createJsLogger('logger-from-options'),
      nativeLogger: { id: 'explicit-native-logger' },
    });

    expect(collectDeviceProfileForJourney).toHaveBeenCalledWith(
      'journey-native-logger-test',
      ['network'],
      'explicit-native-logger'
    );
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
    });

    await collect(['network']);

    expect(collectDeviceProfile).toHaveBeenCalledTimes(1);
  });

  it('falls back to classic module when TurboModule is missing', async () => {
    const collectDeviceProfile = jest.fn(() =>
      Promise.resolve({ platform: { os: 'ios' } })
    );
    const { collectDeviceProfile: collect } = await loadModule({
      nativeModule: { RNPingDeviceProfileClassic: { collectDeviceProfile } },
    });

    await collect(['platform']);

    expect(collectDeviceProfile).toHaveBeenCalledTimes(1);
  });

  it('throws when called without a native module', async () => {
    await expect(loadModule({})).rejects.toThrow(
      '[@ping-identity/rn-device-profile] Native module RNPingDeviceProfile not found.'
    );
  });

  it('includes available module names in the missing-module error', async () => {
    await expect(
      loadModule({
        nativeModule: { SomeOtherModule: {} },
      })
    ).rejects.toThrow(
      'Available NativeModules: ["SomeOtherModule"]'
    );
  });
});
