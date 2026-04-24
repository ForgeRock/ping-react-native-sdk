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
  fromNativeAuthorizeResult,
  getNativeModule,
} from '../NativeRNPingExternalIdp';

describe('getNativeModule', () => {
  beforeEach(() => {
    jest.resetModules();
    (TurboModuleRegistry.get as jest.Mock).mockReset();
    // Reset NativeModules to empty by default
    Object.keys(NativeModules).forEach((key) => {
      delete (NativeModules as Record<string, unknown>)[key];
    });
  });

  it('returns the TurboModule when available', () => {
    const turboMock = {
      authorizeForJourney: jest.fn(),
      selectProviderForJourney: jest.fn(),
    };
    (TurboModuleRegistry.get as jest.Mock).mockReturnValue(turboMock);

    expect(getNativeModule()).toBe(turboMock);
    expect(TurboModuleRegistry.get).toHaveBeenCalledWith('RNPingExternalIdp');
  });

  it('falls back to classic bridge when TurboModule is absent', () => {
    (TurboModuleRegistry.get as jest.Mock).mockReturnValue(null);
    const classicMock = {
      authorizeForJourney: jest.fn(),
      selectProviderForJourney: jest.fn(),
    };
    (NativeModules as Record<string, unknown>).RNPingExternalIdpClassic =
      classicMock;

    expect(getNativeModule()).toBe(classicMock);
  });

  it('throws a diagnostic error when neither module is registered', () => {
    (TurboModuleRegistry.get as jest.Mock).mockReturnValue(null);

    expect(() => getNativeModule()).toThrow(
      'Native module RNPingExternalIdp not found',
    );
  });
});

describe('external idp native module mapping', () => {
  it('maps a valid authorize result', () => {
    expect(
      fromNativeAuthorizeResult({
        token: 'tok',
        additionalParameters: { foo: 'bar' },
      }),
    ).toEqual({
      token: 'tok',
      additionalParameters: { foo: 'bar' },
    });
  });

  it('maps an authorize result without additional parameters', () => {
    expect(fromNativeAuthorizeResult({ token: 'tok' })).toEqual({
      token: 'tok',
    });
  });

  it('throws a diagnostic error when the result is not an object', () => {
    expect(() => fromNativeAuthorizeResult(null)).toThrow(
      'Invalid native authorize result: result must be an object',
    );
  });

  it('throws a diagnostic error when token is missing', () => {
    expect(() => fromNativeAuthorizeResult({})).toThrow(
      'Invalid native authorize result: token must be a string',
    );
  });

  it('throws a diagnostic error when additional parameters are invalid', () => {
    expect(() =>
      fromNativeAuthorizeResult({
        token: 'tok',
        additionalParameters: { foo: 1 },
      }),
    ).toThrow(
      'Invalid native authorize result: additionalParameters.foo must be a string',
    );
  });

  it('throws when additional parameters are null', () => {
    expect(() =>
      fromNativeAuthorizeResult({
        token: 'tok',
        additionalParameters: null,
      }),
    ).toThrow(
      'Invalid native authorize result: additionalParameters must be an object',
    );
  });
});
