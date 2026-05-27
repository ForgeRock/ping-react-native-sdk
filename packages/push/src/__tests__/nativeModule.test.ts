/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Tests for getNativeModule() resolution logic in NativeRNPingPush.ts.
 *
 * Uses Pattern B (resetModules + doMock + require) to avoid fighting the
 * top-level jest.mock() hoisting used in push.edge.test.ts.
 */

type NativeModule = { initialize: jest.Mock };

function loadNativeRNPingPush(rn: {
  NativeModules: Record<string, unknown>;
  turboResult: unknown;
}): { getNativeModule: () => NativeModule } {
  jest.resetModules();
  jest.doMock('react-native', () => ({
    NativeModules: rn.NativeModules,
    TurboModuleRegistry: {
      get: jest.fn().mockReturnValue(rn.turboResult),
    },
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../NativeRNPingPush');
}

describe('getNativeModule — resolution priority', () => {
  afterEach(() => jest.resetModules());

  it('throws descriptive error when both TurboModule and classic bridge are unavailable', () => {
    const m = loadNativeRNPingPush({
      NativeModules: {},
      turboResult: null,
    });
    expect(() => m.getNativeModule()).toThrow(
      '[@ping-identity/rn-push] Native module RNPingPush not found',
    );
  });

  it('returns TurboModule when TurboModuleRegistry.get resolves a module', () => {
    const fakeModule = { initialize: jest.fn() };
    const m = loadNativeRNPingPush({
      NativeModules: {},
      turboResult: fakeModule,
    });
    expect(m.getNativeModule()).toBe(fakeModule);
  });

  it('falls back to NativeModules.RNPingPushClassic when TurboModuleRegistry returns null', () => {
    const classicModule = { initialize: jest.fn() };
    const m = loadNativeRNPingPush({
      NativeModules: { RNPingPushClassic: classicModule },
      turboResult: null,
    });
    expect(m.getNativeModule()).toBe(classicModule);
  });

  it('error message includes available NativeModule keys', () => {
    const m = loadNativeRNPingPush({
      NativeModules: { SomeOtherModule: {} },
      turboResult: null,
    });
    expect(() => m.getNativeModule()).toThrow('SomeOtherModule');
  });
});
