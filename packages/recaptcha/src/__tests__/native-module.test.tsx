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
  const get = jest.fn(() =>
    turboModule ? { verifyForJourney: jest.fn(), ...turboModule } : undefined,
  );

  jest.doMock('react-native', () =>
    createReactNativeMock({
      NativeModules: nativeModule ?? {},
      TurboModuleRegistry: { get },
    }),
  );

  return import('../index');
};

describe('recaptcha native module wiring', () => {
  it('uses TurboModule when New Architecture is enabled', async () => {
    const verifyNative = jest.fn(() =>
      Promise.resolve({ type: 'success', token: 'tok' }),
    );
    const { createRecaptchaClient } = await loadModule({
      turboModule: { verifyForJourney: verifyNative },
    });
    const client = createRecaptchaClient();

    await expect(
      client.verifyForJourney({ getId: () => Promise.resolve('j1') }),
    ).resolves.toEqual({ type: 'success', token: 'tok' });
    expect(verifyNative).toHaveBeenCalledTimes(1);
    expect(verifyNative).toHaveBeenCalledWith('j1', {}, {});
  });

  it('falls back to the classic module when TurboModule is missing', async () => {
    const classicVerify = jest.fn(() =>
      Promise.resolve({ type: 'success', token: 'tok-classic' }),
    );
    const { createRecaptchaClient } = await loadModule({
      nativeModule: {
        RNPingRecaptchaClassic: { verifyForJourney: classicVerify },
      },
    });
    const client = createRecaptchaClient();

    await expect(
      client.verifyForJourney({ getId: () => Promise.resolve('j1') }),
    ).resolves.toEqual({ type: 'success', token: 'tok-classic' });
    expect(classicVerify).toHaveBeenCalledTimes(1);
    expect(classicVerify).toHaveBeenCalledWith('j1', {}, {});
  });

  it('throws a helpful error when the native module is missing', async () => {
    const { createRecaptchaClient } = await loadModule({});

    expect(() => createRecaptchaClient()).toThrow(
      '[@ping-identity/rn-recaptcha] Native module RNPingRecaptcha not found.',
    );
  });

  it('includes available module names in the missing-module error', async () => {
    const { createRecaptchaClient } = await loadModule({
      nativeModule: { SomeOtherModule: {} },
    });

    expect(() => createRecaptchaClient()).toThrow(
      'Available NativeModules: ["SomeOtherModule"]',
    );
  });

  it('resolve is cached across calls', async () => {
    const verifyNative = jest.fn(() =>
      Promise.resolve({ type: 'success', token: 'tok' }),
    );
    const { createRecaptchaClient } = await loadModule({
      turboModule: { verifyForJourney: verifyNative },
    });
    const client = createRecaptchaClient();

    await client.verifyForJourney({ getId: () => Promise.resolve('a') });
    await client.verifyForJourney({ getId: () => Promise.resolve('b') });

    expect(verifyNative).toHaveBeenCalledTimes(2);
  });
});
