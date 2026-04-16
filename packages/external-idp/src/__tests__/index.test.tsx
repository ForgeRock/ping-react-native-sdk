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
    TurboModuleRegistry: { get: jest.fn(() => undefined) },
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
    }),
  );

  return import('../index');
};

describe('external-idp package scaffold', () => {
  it('returns the classic native module when TurboModule is unavailable', async () => {
    const classic = { bootstrap: jest.fn() };
    const { getExternalIdpNativeModule } = await loadModule({
      nativeModule: { RNPingExternalIdpClassic: classic },
    });

    expect(getExternalIdpNativeModule()).toBe(classic);
  });

  it('returns the TurboModule when available', async () => {
    const turbo = { bootstrap: jest.fn() };
    const { getExternalIdpNativeModule } = await loadModule({
      turboModule: turbo,
    });

    expect(getExternalIdpNativeModule()).toBe(turbo);
  });

  it('throws when the native module is not linked', async () => {
    const { getExternalIdpNativeModule } = await loadModule({});

    expect(() => getExternalIdpNativeModule()).toThrow(
      '[@ping-identity/rn-external-idp] Native module RNPingExternalIdp not found.',
    );
  });
});
