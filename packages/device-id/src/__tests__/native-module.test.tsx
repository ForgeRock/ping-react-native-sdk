/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

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

  return require('../index');
};

describe('device-id native module wiring', () => {
  it('uses TurboModule when New Architecture is enabled', async () => {
    const getDefaultDeviceId = jest.fn(() => Promise.resolve('device-id'));
    const { getDeviceId } = await loadModule({
      turboModule: { getDefaultDeviceId },
    });

    await expect(getDeviceId()).resolves.toBe('device-id');
    expect(getDefaultDeviceId).toHaveBeenCalledTimes(1);
  });

  it('falls back to classic module when TurboModule is missing', async () => {
    const getDefaultDeviceId = jest.fn(() => Promise.resolve('classic-id'));
    const { getDeviceId } = await loadModule({
      nativeModule: { RNPingDeviceIdClassic: { getDefaultDeviceId } },
    });

    await expect(getDeviceId()).resolves.toBe('classic-id');
    expect(getDefaultDeviceId).toHaveBeenCalledTimes(1);
  });

  it('throws a helpful error when the classic module is missing', async () => {
    const { getDeviceId } = await loadModule({});

    await expect(getDeviceId()).rejects.toThrow(
      '[@ping-identity/rn-device-id] Native module RNPingDeviceId not found.'
    );
  });

  it('includes available module names in the missing-module error', async () => {
    const { getDeviceId } = await loadModule({
      nativeModule: { SomeOtherModule: {} },
    });

    await expect(getDeviceId()).rejects.toThrow(
      'Available NativeModules: [\"SomeOtherModule\"]'
    );
  });
});
