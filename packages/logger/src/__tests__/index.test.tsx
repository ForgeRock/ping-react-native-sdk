/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import packageJson from '@ping-identity/rn-logger/package.json';

export {};

type NativeLoggerMock = {
  registerLogger: jest.Mock;
  syncLogger: jest.Mock;
};

type SdkLoggerMock = {
  changeLevel: jest.Mock;
  error: jest.Mock;
  warn: jest.Mock;
  info: jest.Mock;
  debug: jest.Mock;
};

type CustomLoggerMock = {
  error: (...args: unknown[]) => unknown;
  warn: (...args: unknown[]) => unknown;
  info: (...args: unknown[]) => unknown;
  debug: (...args: unknown[]) => unknown;
};

const createNativeLoggerMock = (): NativeLoggerMock => ({
  registerLogger: jest.fn(() => 'logger-id'),
  syncLogger: jest.fn(),
});

const createSdkLoggerMock = () => {
  const instance: SdkLoggerMock = {
    changeLevel: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const factory = jest.fn(
    (options: { level: string; custom?: CustomLoggerMock }) => {
      const custom = options.custom;
      if (custom) {
        instance.error.mockImplementation((...args) => custom.error(...args));
        instance.warn.mockImplementation((...args) => custom.warn(...args));
        instance.info.mockImplementation((...args) => custom.info(...args));
        instance.debug.mockImplementation((...args) => custom.debug(...args));
      }
      return instance;
    },
  );

  return { factory, instance };
};

const loadModule = async () => {
  jest.resetModules();
  const nativeLogger = createNativeLoggerMock();
  const sdkLogger = createSdkLoggerMock();

  jest.doMock('../NativeRNPingLogger', () => ({
    __esModule: true,
    default: nativeLogger,
  }));

  jest.doMock('@forgerock/sdk-logger', () => ({
    __esModule: true,
    logger: sdkLogger.factory,
  }));

  const module = await import('../logger');
  return { module, nativeLogger, sdkLogger };
};

describe('logger package', () => {
  it('logger creates a native handle and syncs level changes', async () => {
    const { module, nativeLogger, sdkLogger } = await loadModule();

    const instance = module.logger({ level: 'debug' });
    instance.changeLevel('warn');

    expect(nativeLogger.registerLogger).toHaveBeenCalledWith({
      level: 'STANDARD',
    });
    expect(sdkLogger.instance.changeLevel).toHaveBeenCalledWith('warn');
    expect(nativeLogger.syncLogger).toHaveBeenCalledWith({
      id: 'logger-id',
      level: 'WARN',
    });
  });

  it('logger tags messages with the SDK prefix', async () => {
    const { module, sdkLogger } = await loadModule();

    const custom = {
      error: jest.fn(() => true),
      warn: jest.fn(() => true),
      info: jest.fn(() => true),
      debug: jest.fn(() => true),
    };

    const instance = module.logger({ level: 'info', custom });
    instance.info('hello');

    const expectedPrefix = `[RNPingSDK v${packageJson.version}]`;
    expect(custom.info).toHaveBeenCalledWith(`${expectedPrefix} hello`);
    expect(sdkLogger.instance.info).toHaveBeenCalledWith('hello');
  });
});
