/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

type ReactNativeMock = {
  NativeModules: Record<string, unknown>;
  Platform: { OS: 'android' | 'ios' };
  TurboModuleRegistry: { getEnforcing: jest.Mock };
};

const createReactNativeMock = (overrides: Partial<ReactNativeMock>) => {
  const base: ReactNativeMock = {
    NativeModules: {},
    Platform: { OS: 'android' },
    TurboModuleRegistry: { getEnforcing: jest.fn(() => ({ })) },
  };

  return { ...base, ...overrides };
};

const loadModule = async ({
  platform,
  nativeModule,
  turboModule,
  enableTurbo,
}: {
  platform: 'android' | 'ios';
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
      Platform: { OS: platform },
      NativeModules: nativeModule ?? {},
      TurboModuleRegistry: { getEnforcing },
    })
  );

  return require('../index');
};

describe('browser package', () => {
  it('configures the native module on Android', async () => {
    const configure = jest.fn();
    const { configureBrowser } = await loadModule({
      platform: 'android',
      nativeModule: { RNPingBrowserClassic: { configure } },
    });

    const config = { android: { customTabs: { showTitle: false } } };
    configureBrowser(config);

    expect(configure).toHaveBeenCalledWith(config.android);
  });

  it('passes an empty config when only iOS config is provided', async () => {
    const configure = jest.fn();
    const { configureBrowser } = await loadModule({
      platform: 'android',
      nativeModule: { RNPingBrowserClassic: { configure } },
    });

    configureBrowser({ ios: {} });

    expect(configure).toHaveBeenCalledWith({});
  });

  it('passes an empty config when no platform config is provided', async () => {
    const configure = jest.fn();
    const { configureBrowser } = await loadModule({
      platform: 'android',
      nativeModule: { RNPingBrowserClassic: { configure } },
    });

    configureBrowser({});

    expect(configure).toHaveBeenCalledWith({});
  });

  it('skips Android configuration on iOS', async () => {
    const configure = jest.fn();
    const { configureBrowser } = await loadModule({
      platform: 'ios',
      nativeModule: { RNPingBrowserClassic: { configure } },
    });

    configureBrowser({ android: { customTabs: { showTitle: true } } });

    expect(configure).not.toHaveBeenCalled();
  });

  it('resets the native module on iOS', async () => {
    const reset = jest.fn();
    const { resetBrowser } = await loadModule({
      platform: 'ios',
      nativeModule: { RNPingBrowserClassic: { reset } },
    });

    resetBrowser();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('skips reset on Android', async () => {
    const reset = jest.fn();
    const { resetBrowser } = await loadModule({
      platform: 'android',
      nativeModule: { RNPingBrowserClassic: { reset } },
    });

    resetBrowser();
    expect(reset).not.toHaveBeenCalled();
  });

  it('throws when reset is called without a native module', async () => {
    const { resetBrowser } = await loadModule({
      platform: 'ios',
    });

    expect(() => resetBrowser()).toThrow(
      '[@ping-identity/rn-browser] Native RNPingBrowserClassic module not found.'
    );
  });

  it('forwards open options to the native module', async () => {
    const open = jest.fn(() => Promise.resolve({ type: 'cancel' }));
    const { open: openBrowser } = await loadModule({
      platform: 'android',
      nativeModule: { RNPingBrowserClassic: { open } },
    });

    const options = { callbackUrlScheme: 'com.example.app' };
    const result = await openBrowser('https://example.com', options);

    expect(open).toHaveBeenCalledWith('https://example.com', options);
    expect(result).toEqual({ type: 'cancel' });
  });

  it('opens on iOS using the same native path', async () => {
    const open = jest.fn(() => Promise.resolve({ type: 'success', url: 'ok' }));
    const { open: openBrowser } = await loadModule({
      platform: 'ios',
      nativeModule: { RNPingBrowserClassic: { open } },
    });

    const options = {
      callbackUrlScheme: 'com.example.app',
      ios: { browserType: 'authSession' },
    };

    await openBrowser('https://example.com', options);

    expect(open).toHaveBeenCalledWith('https://example.com', options);
  });

  it('preserves nested option objects', async () => {
    const open = jest.fn(() => Promise.resolve({ type: 'cancel' }));
    const { open: openBrowser } = await loadModule({
      platform: 'android',
      nativeModule: { RNPingBrowserClassic: { open } },
    });

    const options = {
      callbackUrlScheme: 'com.example.app',
      ios: { browserType: 'ephemeralAuthSession', browserMode: 'login' },
    };

    await openBrowser('https://example.com', options);

    expect(open).toHaveBeenCalledWith('https://example.com', options);
  });

  it('uses TurboModule when New Architecture is enabled', async () => {
    const open = jest.fn(() => Promise.resolve({ type: 'cancel' }));
    const turboModule = { open };
    const { open: openBrowser } = await loadModule({
      platform: 'android',
      turboModule,
      enableTurbo: true,
    });

    await openBrowser('https://example.com', { callbackUrlScheme: 'com.app' });

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('throws a helpful error when the classic module is missing', async () => {
    const { open: openBrowser } = await loadModule({
      platform: 'android',
    });

    expect(() =>
      openBrowser('https://example.com', { callbackUrlScheme: 'com.app' })
    ).toThrow(
      '[@ping-identity/rn-browser] Native RNPingBrowserClassic module not found.'
    );
  });

  it('includes available module names in the missing-module error', async () => {
    const { open: openBrowser } = await loadModule({
      platform: 'android',
      nativeModule: { SomeOtherModule: {} },
    });

    expect(() =>
      openBrowser('https://example.com', { callbackUrlScheme: 'com.app' })
    ).toThrow('Available NativeModules: [\"SomeOtherModule\"]');
  });
});
