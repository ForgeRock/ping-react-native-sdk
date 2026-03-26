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

describe('fido native module wiring', () => {
  it('uses TurboModule when New Architecture is enabled', async () => {
    const getDefaultFido = jest.fn(() => Promise.resolve('fido'));
    const { getFido } = await loadModule({
      turboModule: { getDefaultFido },
    });

    await expect(getFido()).resolves.toBe('fido');
    expect(getDefaultFido).toHaveBeenCalledTimes(1);
  });

  it('falls back to classic module when TurboModule is missing', async () => {
    const getDefaultFido = jest.fn(() => Promise.resolve('classic-id'));
    const { getFido } = await loadModule({
      nativeModule: { RNPingFidoClassic: { getDefaultFido } },
    });

    await expect(getFido()).resolves.toBe('classic-id');
    expect(getDefaultFido).toHaveBeenCalledTimes(1);
  });

  it('throws a helpful error when the classic module is missing', async () => {
    const { getFido } = await loadModule({});

    await expect(getFido()).rejects.toThrow(
      '[@ping-identity/rn-fido] Native module RNPingFido not found.'
    );
  });

  it('includes available module names in the missing-module error', async () => {
    const { getFido } = await loadModule({
      nativeModule: { SomeOtherModule: {} },
    });

    await expect(getFido()).rejects.toThrow(
      'Available NativeModules: [\"SomeOtherModule\"]'
    );
  });
});
