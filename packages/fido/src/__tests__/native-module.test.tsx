/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

export {};

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

describe('fido native module wiring', () => {
  it('uses TurboModule when New Architecture is enabled', async () => {
    const registerNative = jest.fn(() => Promise.resolve({ type: 'register' }));
    const { register } = await loadModule({
      turboModule: { registerCredential: registerNative },
    });

    await expect(register({ challenge: 'abc' })).resolves.toEqual({
      type: 'register',
    });
    expect(registerNative).toHaveBeenCalledTimes(1);
  });

  it('falls back to classic module when TurboModule is missing', async () => {
    const authenticateNative = jest.fn(() => Promise.resolve({ type: 'auth' }));
    const { authenticate } = await loadModule({
      nativeModule: {
        RNPingFidoClassic: { authenticateCredential: authenticateNative },
      },
    });

    await expect(authenticate({ challenge: 'abc' })).resolves.toEqual({
      type: 'auth',
    });
    expect(authenticateNative).toHaveBeenCalledTimes(1);
  });

  it('registerForJourney forwards journey id and options to native module', async () => {
    const registerJourneyNative = jest.fn(() => Promise.resolve({ type: 'success' }));
    const { registerForJourney } = await loadModule({
      turboModule: { registerCredentialForJourney: registerJourneyNative },
    });
    const journey = { getId: jest.fn(() => Promise.resolve('journey-123')) };

    await expect(
      registerForJourney(journey, { index: 0, deviceName: 'Device' })
    ).resolves.toEqual({ type: 'success' });
    expect(registerJourneyNative).toHaveBeenCalledWith('journey-123', {
      index: 0,
      deviceName: 'Device',
    });
  });

  it('authenticateForJourney forwards journey id and options to native module', async () => {
    const authenticateJourneyNative = jest.fn(() => Promise.resolve({ type: 'success' }));
    const { authenticateForJourney } = await loadModule({
      turboModule: { authenticateCredentialForJourney: authenticateJourneyNative },
    });
    const journey = { getId: jest.fn(() => Promise.resolve('journey-456')) };

    await expect(authenticateForJourney(journey, { index: 1 })).resolves.toEqual({
      type: 'success',
    });
    expect(authenticateJourneyNative).toHaveBeenCalledWith('journey-456', { index: 1 });
  });

  it('throws a helpful error when the classic module is missing', async () => {
    const { register } = await loadModule({});

    await expect(register({ challenge: 'abc' })).rejects.toThrow(
      '[@ping-identity/rn-fido] Native module RNPingFido not found.'
    );
  });

  it('includes available module names in the missing-module error', async () => {
    const { register } = await loadModule({
      nativeModule: { SomeOtherModule: {} },
    });

    await expect(register({ challenge: 'abc' })).rejects.toThrow(
      'Available NativeModules: ["SomeOtherModule"]'
    );
  });
});
