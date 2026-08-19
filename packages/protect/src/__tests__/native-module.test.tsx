/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { NativeModules, TurboModuleRegistry } from 'react-native';

jest.mock('react-native', () => ({
  NativeModules: {},
  TurboModuleRegistry: { get: jest.fn() },
}));

import {
  _resetNativeModuleForTesting,
  getNativeModule,
  toNativeConfig,
} from '../NativeRNPingProtect';

describe('getNativeModule', () => {
  beforeEach(() => {
    jest.resetModules();
    _resetNativeModuleForTesting();
    (TurboModuleRegistry.get as jest.Mock).mockReset();
    Object.keys(NativeModules).forEach((key) => {
      delete (NativeModules as Record<string, unknown>)[key];
    });
  });

  it('returns the TurboModule when available', () => {
    const turboMock = { collectForDaVinci: jest.fn() };
    (TurboModuleRegistry.get as jest.Mock).mockReturnValue(turboMock);

    expect(getNativeModule()).toBe(turboMock);
    expect(TurboModuleRegistry.get).toHaveBeenCalledWith('RNPingProtect');
  });

  it('falls back to classic bridge when TurboModule is absent', () => {
    (TurboModuleRegistry.get as jest.Mock).mockReturnValue(null);
    const classicMock = { collectForDaVinci: jest.fn() };
    (NativeModules as Record<string, unknown>).RNPingProtectClassic =
      classicMock;

    expect(getNativeModule()).toBe(classicMock);
  });

  it('caches the resolved module on repeated calls', () => {
    const turboMock = { collectForDaVinci: jest.fn() };
    (TurboModuleRegistry.get as jest.Mock).mockReturnValue(turboMock);

    const first = getNativeModule();
    const second = getNativeModule();

    expect(first).toBe(second);
    expect(TurboModuleRegistry.get).toHaveBeenCalledTimes(1);
  });

  it('throws a diagnostic error when neither module is registered', () => {
    (TurboModuleRegistry.get as jest.Mock).mockReturnValue(null);

    expect(() => getNativeModule()).toThrow(
      'Native module RNPingProtect not found',
    );
  });

  it('throws an error that lists available NativeModules for diagnosis', () => {
    (TurboModuleRegistry.get as jest.Mock).mockReturnValue(null);
    (NativeModules as Record<string, unknown>).SomeOtherModule = {};

    expect(() => getNativeModule()).toThrow('SomeOtherModule');
  });
});

describe('native cast helpers', () => {
  it('toNativeConfig passes through the config object', () => {
    const config = { loggerId: 'logger-1' };
    expect(toNativeConfig(config)).toBe(config);
  });

  it('toNativeConfig handles config without loggerId', () => {
    const config = { loggerId: undefined };
    expect(toNativeConfig(config)).toBe(config);
  });
});
