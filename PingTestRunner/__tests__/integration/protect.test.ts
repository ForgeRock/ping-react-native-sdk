/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-protect
 *
 * Validates that the protect bridge layer:
 * - Exports startProtect, pauseBehavioralData, resumeBehavioralData, and ProtectError
 * - Exports the Journey helpers startProtectForJourney, collectProtectForJourney and
 *   initializeProtectForJourney
 * - Forwards config (including loggerId) to the native module
 * - Resolves void on success
 * - Propagates native rejections as ProtectError
 *
 * Native iOS/Android SDK behaviour is not exercised here — the native module
 * is fully mocked so only the JS bridge layer is under test.
 */

export {};

type NativeProtectMock = {
  initialize: jest.Mock;
  collectForJourney: jest.Mock;
  initializeForJourney: jest.Mock;
  pauseBehavioralData: jest.Mock;
  resumeBehavioralData: jest.Mock;
  registerJourneyCallbacks: jest.Mock;
};

function makeMock(
  overrides: Partial<NativeProtectMock> = {},
): NativeProtectMock {
  return {
    initialize: jest.fn(async () => undefined),
    collectForJourney: jest.fn(async () => ({ type: 'success' })),
    initializeForJourney: jest.fn(async () => ({ type: 'success' })),
    pauseBehavioralData: jest.fn(async () => undefined),
    resumeBehavioralData: jest.fn(async () => undefined),
    registerJourneyCallbacks: jest.fn(async () => null),
    ...overrides,
  };
}

async function loadProtect(nativeMock: NativeProtectMock) {
  jest.resetModules();
  jest.doMock('../../../packages/protect/src/NativeRNPingProtect', () => ({
    __esModule: true,
    getNativeModule: jest.fn(() => nativeMock),
    toNativeConfig: jest.fn((config: unknown) => config),
    toNativeProtectConfig: jest.fn((config: unknown) => config),
    fromNativeJourneyResult: jest.fn((result: unknown) => result),
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@ping-identity/rn-protect');
}

describe('@ping-identity/rn-protect — integration', () => {
  afterEach(() => jest.restoreAllMocks());

  // ─── exports ──────────────────────────────────────────────────────────────

  describe('exports', () => {
    it('exports startProtect', async () => {
      const mod = await loadProtect(makeMock());
      expect(typeof mod.startProtect).toBe('function');
    });

    it('exports pauseBehavioralData', async () => {
      const mod = await loadProtect(makeMock());
      expect(typeof mod.pauseBehavioralData).toBe('function');
    });

    it('exports resumeBehavioralData', async () => {
      const mod = await loadProtect(makeMock());
      expect(typeof mod.resumeBehavioralData).toBe('function');
    });

    it('exports startProtectForJourney', async () => {
      const mod = await loadProtect(makeMock());
      expect(typeof mod.startProtectForJourney).toBe('function');
    });

    it('exports collectProtectForJourney', async () => {
      const mod = await loadProtect(makeMock());
      expect(typeof mod.collectProtectForJourney).toBe('function');
    });

    it('exports initializeProtectForJourney', async () => {
      const mod = await loadProtect(makeMock());
      expect(typeof mod.initializeProtectForJourney).toBe('function');
    });

    it('exports ProtectError', async () => {
      const mod = await loadProtect(makeMock());
      expect(typeof mod.ProtectError).toBe('function');
    });
  });

  // ─── startProtect() ───────────────────────────────────────────────────────

  describe('startProtect()', () => {
    it('accepts an empty config object', async () => {
      const mod = await loadProtect(makeMock());
      await expect(mod.startProtect({})).resolves.toBeUndefined();
    });

    it('calls initialize with the protect config', async () => {
      const mock = makeMock();
      const mod = await loadProtect(mock);

      await mod.startProtect({ envId: 'test-env' });

      expect(mock.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ envId: 'test-env' }),
        expect.any(Object),
      );
    });

    it('forwards loggerId from config to initialize', async () => {
      const mock = makeMock();
      const mod = await loadProtect(mock);
      const logger = {
        nativeHandle: { id: 'logger-start-1' },
        changeLevel: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };

      await mod.startProtect({ logger });

      expect(mock.initialize).toHaveBeenCalledWith(expect.any(Object), {
        loggerId: 'logger-start-1',
      });
    });

    it('also calls resumeBehavioralData when resumeBehavioralDataOnStart is true', async () => {
      const mock = makeMock();
      const mod = await loadProtect(mock);

      await mod.startProtect({ resumeBehavioralDataOnStart: true });

      expect(mock.initialize).toHaveBeenCalledTimes(1);
      expect(mock.resumeBehavioralData).toHaveBeenCalledTimes(1);
    });

    it('does not call resumeBehavioralData by default', async () => {
      const mock = makeMock();
      const mod = await loadProtect(mock);

      await mod.startProtect({});

      expect(mock.resumeBehavioralData).not.toHaveBeenCalled();
    });

    it('propagates an initialize error as ProtectError', async () => {
      const mock = makeMock({
        initialize: jest.fn(async () => {
          throw {
            error: 'PROTECT_INITIALIZE_ERROR',
            message: 'Init failed.',
            type: 'initialize_error',
          };
        }),
      });
      const mod = await loadProtect(mock);

      await expect(mod.startProtect({})).rejects.toMatchObject({
        code: 'PROTECT_INITIALIZE_ERROR',
        message: 'Init failed.',
      });
    });
  });

  // ─── pauseBehavioralData() ────────────────────────────────────────────────

  describe('pauseBehavioralData()', () => {
    it('resolves void on success', async () => {
      const mod = await loadProtect(makeMock());
      await expect(mod.pauseBehavioralData()).resolves.toBeUndefined();
    });

    it('forwards loggerId when logger is provided', async () => {
      const mock = makeMock();
      const mod = await loadProtect(mock);
      const logger = {
        nativeHandle: { id: 'logger-pause-1' },
        changeLevel: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };

      await mod.pauseBehavioralData({ logger });

      expect(mock.pauseBehavioralData).toHaveBeenCalledWith({
        loggerId: 'logger-pause-1',
      });
    });

    it('passes loggerId as undefined when no logger is provided', async () => {
      const mock = makeMock();
      const mod = await loadProtect(mock);

      await mod.pauseBehavioralData();

      expect(mock.pauseBehavioralData).toHaveBeenCalledWith({
        loggerId: undefined,
      });
    });

    it('propagates a native error as ProtectError', async () => {
      const mock = makeMock({
        pauseBehavioralData: jest.fn(async () => {
          throw {
            error: 'PROTECT_INITIALIZE_ERROR',
            message: 'SDK not initialized.',
            type: 'initialize_error',
          };
        }),
      });
      const mod = await loadProtect(mock);

      await expect(mod.pauseBehavioralData()).rejects.toMatchObject({
        code: 'PROTECT_INITIALIZE_ERROR',
      });
    });
  });

  // ─── resumeBehavioralData() ───────────────────────────────────────────────

  describe('resumeBehavioralData()', () => {
    it('resolves void on success', async () => {
      const mod = await loadProtect(makeMock());
      await expect(mod.resumeBehavioralData()).resolves.toBeUndefined();
    });

    it('forwards loggerId when logger is provided', async () => {
      const mock = makeMock();
      const mod = await loadProtect(mock);
      const logger = {
        nativeHandle: { id: 'logger-resume-1' },
        changeLevel: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };

      await mod.resumeBehavioralData({ logger });

      expect(mock.resumeBehavioralData).toHaveBeenCalledWith({
        loggerId: 'logger-resume-1',
      });
    });

    it('propagates a native error as ProtectError', async () => {
      const mock = makeMock({
        resumeBehavioralData: jest.fn(async () => {
          throw {
            error: 'PROTECT_INITIALIZE_ERROR',
            message: 'SDK not initialized.',
            type: 'initialize_error',
          };
        }),
      });
      const mod = await loadProtect(mock);

      await expect(mod.resumeBehavioralData()).rejects.toMatchObject({
        code: 'PROTECT_INITIALIZE_ERROR',
      });
    });
  });

  // ─── startProtectForJourney() ──────────────────────────────────────────────

  describe('startProtectForJourney()', () => {
    it('registers the Journey callbacks without initializing Protect', async () => {
      const mock = makeMock();
      const mod = await loadProtect(mock);

      await expect(mod.startProtectForJourney()).resolves.toBeUndefined();

      expect(mock.registerJourneyCallbacks).toHaveBeenCalledTimes(1);
      expect(mock.initialize).not.toHaveBeenCalled();
    });

    it('propagates a native registration failure as ProtectError', async () => {
      const mock = makeMock({
        registerJourneyCallbacks: jest.fn(async () => {
          throw {
            error: 'PROTECT_INITIALIZE_ERROR',
            message: 'Registration failed.',
            type: 'initialize_error',
          };
        }),
      });
      const mod = await loadProtect(mock);
      const promise = mod.startProtectForJourney();

      await expect(promise).rejects.toBeInstanceOf(mod.ProtectError);
      await expect(promise).rejects.toMatchObject({
        code: 'PROTECT_INITIALIZE_ERROR',
        message: 'Registration failed.',
      });
    });
  });

  // ─── collectProtectForJourney() ────────────────────────────────────────────

  describe('collectProtectForJourney()', () => {
    const journey = { getId: async () => 'journey-1' };

    it('forwards journey id, default index, and loggerId to the native module', async () => {
      const mock = makeMock();
      const mod = await loadProtect(mock);

      await expect(mod.collectProtectForJourney(journey)).resolves.toEqual({
        type: 'success',
      });

      expect(mock.collectForJourney).toHaveBeenCalledWith(
        'journey-1',
        { index: 0 },
        { loggerId: undefined },
      );
    });

    it('forwards a custom index and loggerId from options', async () => {
      const mock = makeMock();
      const mod = await loadProtect(mock);
      const logger = {
        nativeHandle: { id: 'logger-collect-1' },
        changeLevel: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };

      await mod.collectProtectForJourney(journey, { index: 2, logger });

      expect(mock.collectForJourney).toHaveBeenCalledWith(
        'journey-1',
        { index: 2 },
        { loggerId: 'logger-collect-1' },
      );
    });

    it('rejects a negative index with argument_error before calling native', async () => {
      const mock = makeMock();
      const mod = await loadProtect(mock);

      await expect(
        mod.collectProtectForJourney(journey, { index: -1 }),
      ).rejects.toMatchObject({
        code: 'PROTECT_ARGUMENT_ERROR',
        type: 'argument_error',
      });
      expect(mock.collectForJourney).not.toHaveBeenCalled();
    });

    it('propagates a native not-initialized rejection as ProtectError', async () => {
      const mock = makeMock({
        collectForJourney: jest.fn(async () => {
          throw {
            code: 'PROTECT_NOT_INITIALIZED',
            message: 'Protect is not initialized.',
          };
        }),
      });
      const mod = await loadProtect(mock);
      const promise = mod.collectProtectForJourney(journey);

      await expect(promise).rejects.toBeInstanceOf(mod.ProtectError);
      await expect(promise).rejects.toMatchObject({
        code: 'PROTECT_NOT_INITIALIZED',
        message: 'Protect is not initialized.',
      });
    });
  });

  // ─── initializeProtectForJourney() ─────────────────────────────────────────

  describe('initializeProtectForJourney()', () => {
    const journey = { getId: async () => 'journey-1' };

    it('forwards journey id and loggerId to the native module', async () => {
      const mock = makeMock();
      const mod = await loadProtect(mock);

      await expect(mod.initializeProtectForJourney(journey)).resolves.toEqual({
        type: 'success',
      });

      expect(mock.initializeForJourney).toHaveBeenCalledWith('journey-1', {
        loggerId: undefined,
      });
    });

    it('forwards loggerId when logger is provided', async () => {
      const mock = makeMock();
      const mod = await loadProtect(mock);
      const logger = {
        nativeHandle: { id: 'logger-init-1' },
        changeLevel: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };

      await mod.initializeProtectForJourney(journey, { logger });

      expect(mock.initializeForJourney).toHaveBeenCalledWith('journey-1', {
        loggerId: 'logger-init-1',
      });
    });

    it('propagates a native callback-not-found rejection as ProtectError', async () => {
      const mock = makeMock({
        initializeForJourney: jest.fn(async () => {
          throw {
            code: 'PROTECT_CALLBACK_NOT_FOUND',
            message: 'No Protect initialize callback found.',
          };
        }),
      });
      const mod = await loadProtect(mock);
      const promise = mod.initializeProtectForJourney(journey);

      await expect(promise).rejects.toBeInstanceOf(mod.ProtectError);
      await expect(promise).rejects.toMatchObject({
        code: 'PROTECT_CALLBACK_NOT_FOUND',
        message: 'No Protect initialize callback found.',
      });
    });
  });

  // ─── ProtectError ─────────────────────────────────────────────────────────

  describe('ProtectError', () => {
    it('ProtectError.from() wraps a raw native error into a ProtectError', async () => {
      const mod = await loadProtect(makeMock());
      const raw = {
        error: 'PROTECT_COLLECT_ERROR',
        message: 'Collect failed.',
        type: 'collect_error',
      };
      const err = mod.ProtectError.from(raw);
      expect(err).toBeInstanceOf(mod.ProtectError);
      expect(err.code).toBe('PROTECT_COLLECT_ERROR');
      expect(err.message).toBe('Collect failed.');
    });

    it('ProtectError.from() round-trips a ProtectError instance unchanged', async () => {
      const mod = await loadProtect(makeMock());
      const original = new mod.ProtectError(
        'original message',
        'PROTECT_COLLECT_ERROR',
        'collect_error',
      );
      const roundTripped = mod.ProtectError.from(original);
      expect(roundTripped).toBeInstanceOf(mod.ProtectError);
      expect(roundTripped.message).toBe('original message');
      expect(roundTripped.code).toBe('PROTECT_COLLECT_ERROR');
    });
  });
});
