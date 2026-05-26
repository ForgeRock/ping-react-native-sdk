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

import { getNativeModule } from '../NativeRNPingOath';

describe('getNativeModule', () => {
  beforeEach(() => {
    (TurboModuleRegistry.get as jest.Mock).mockReset();
    Object.keys(NativeModules).forEach((key) => {
      delete (NativeModules as Record<string, unknown>)[key];
    });
  });

  it('returns the TurboModule when available', () => {
    const turboMock = {};
    (TurboModuleRegistry.get as jest.Mock).mockReturnValue(turboMock);

    expect(getNativeModule()).toBe(turboMock);
    expect(TurboModuleRegistry.get).toHaveBeenCalledWith('RNPingOath');
  });

  it('falls back to classic bridge when TurboModule is absent', () => {
    (TurboModuleRegistry.get as jest.Mock).mockReturnValue(null);
    const classicMock = {};
    (NativeModules as Record<string, unknown>).RNPingOathClassic = classicMock;

    expect(getNativeModule()).toBe(classicMock);
  });

  it('throws a diagnostic error when neither module is registered', () => {
    (TurboModuleRegistry.get as jest.Mock).mockReturnValue(null);

    expect(() => getNativeModule()).toThrow(
      'Native module RNPingOath not found',
    );
  });
});
