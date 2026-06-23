/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { NativeModules, TurboModuleRegistry } from 'react-native';
import {
  _resetNativeModuleForTesting,
  getNativeModule,
  default as NativeRNPingDavinci,
} from '../NativeRNPingDavinci';

jest.mock('react-native', () => ({
  NativeModules: {},
  TurboModuleRegistry: { get: jest.fn() },
  Platform: { OS: 'ios' },
}));

const mockGet = TurboModuleRegistry.get as jest.Mock;

beforeEach(() => {
  _resetNativeModuleForTesting();
  mockGet.mockReset();
  (NativeModules as Record<string, unknown>).RNPingDavinciClassic = undefined;
});

describe('getNativeModule', () => {
  it('returns TurboModule when available', () => {
    const stub = {};
    mockGet.mockReturnValue(stub);
    expect(getNativeModule()).toBe(stub);
  });

  it('falls back to classic bridge module', () => {
    mockGet.mockReturnValue(null);
    const stub = {};
    (NativeModules as Record<string, unknown>).RNPingDavinciClassic = stub;
    expect(getNativeModule()).toBe(stub);
  });

  it('throws when no module is registered', () => {
    mockGet.mockReturnValue(null);
    expect(() => getNativeModule()).toThrow(
      'Native module RNPingDavinci not found',
    );
  });

  it('caches the resolved module', () => {
    const stub = {};
    mockGet.mockReturnValue(stub);
    getNativeModule();
    getNativeModule();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});

describe('NativeRNPingDavinci lazy wrapper', () => {
  const makeStub = () => ({
    configureDaVinci: jest.fn(async () => 'id'),
    start: jest.fn(async () => ({})),
    next: jest.fn(async () => ({})),
    getSession: jest.fn(async () => null),
    refresh: jest.fn(async () => null),
    revoke: jest.fn(async () => true),
    userinfo: jest.fn(async () => null),
    logout: jest.fn(async () => undefined),
    dispose: jest.fn(async () => undefined),
  });

  it('each wrapper method delegates to the resolved native module', async () => {
    const stub = makeStub();
    mockGet.mockReturnValue(stub);

    await NativeRNPingDavinci.configureDaVinci({
      discoveryEndpoint: 'https://example.com/.well-known/openid-configuration',
      clientId: 'client',
      redirectUri: 'app://cb',
    });
    await NativeRNPingDavinci.start('id');
    await NativeRNPingDavinci.next('id', {});
    await NativeRNPingDavinci.getSession('id');
    await NativeRNPingDavinci.refresh('id');
    await NativeRNPingDavinci.revoke('id');
    await NativeRNPingDavinci.userinfo('id');
    await NativeRNPingDavinci.logout('id');
    await NativeRNPingDavinci.dispose('id');

    expect(stub.configureDaVinci).toHaveBeenCalledWith({
      discoveryEndpoint: 'https://example.com/.well-known/openid-configuration',
      clientId: 'client',
      redirectUri: 'app://cb',
    });
    expect(stub.start).toHaveBeenCalledWith('id');
    expect(stub.next).toHaveBeenCalledWith('id', {});
    expect(stub.getSession).toHaveBeenCalledWith('id');
    expect(stub.refresh).toHaveBeenCalledWith('id');
    expect(stub.revoke).toHaveBeenCalledWith('id');
    expect(stub.userinfo).toHaveBeenCalledWith('id');
    expect(stub.logout).toHaveBeenCalledWith('id');
    expect(stub.dispose).toHaveBeenCalledWith('id');
  });
});
