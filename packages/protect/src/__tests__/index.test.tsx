/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import {
  collectProtect,
  collectProtectForJourney,
  initializeProtectForJourney,
  startProtect,
  startProtectForJourney,
  pauseBehavioralData,
  resumeBehavioralData,
} from '../index';
import { ProtectError } from '../types';

jest.mock('../NativeRNPingProtect', () => ({
  __esModule: true,
  getNativeModule: jest.fn(),
  toNativeConfig: jest.fn((options) => options),
  toNativeProtectConfig: jest.fn((config) => config),
  fromNativeJourneyResult: jest.fn((result) => result),
}));

import { getNativeModule } from '../NativeRNPingProtect';

describe('Protect API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── startProtect() ───────────────────────────────────────────────────────

  it('startProtect() eagerly registers the native DaVinci serializer', async () => {
    const registerSerializerNative = jest.fn().mockResolvedValue(null);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(undefined),
      registerDaVinciSerializer: registerSerializerNative,
    });

    await startProtect({});

    expect(registerSerializerNative).toHaveBeenCalledTimes(1);
  });

  it('startProtect() does not fail when the serializer method is missing', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(undefined),
    });

    await expect(startProtect({})).resolves.toBeUndefined();
  });

  it('startProtect() calls native initialize with the protect config', async () => {
    const initializeNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeNative,
    });

    await startProtect({ envId: 'env-123', isLazyMetadata: true });

    expect(initializeNative).toHaveBeenCalledWith(
      {
        envId: 'env-123',
        isLazyMetadata: true,
        pauseBehavioralDataOnSuccess: undefined,
        resumeBehavioralDataOnStart: undefined,
      },
      { loggerId: undefined },
    );
  });

  it('startProtect() forwards lifecycle flags to native initialize', async () => {
    const initializeNative = jest.fn().mockResolvedValue(undefined);
    const resumeNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeNative,
      resumeBehavioralData: resumeNative,
    });

    await startProtect({
      pauseBehavioralDataOnSuccess: true,
      resumeBehavioralDataOnStart: true,
    });

    expect(initializeNative).toHaveBeenCalledWith(
      expect.objectContaining({
        pauseBehavioralDataOnSuccess: true,
        resumeBehavioralDataOnStart: true,
      }),
      { loggerId: undefined },
    );
  });

  it('startProtect() forwards loggerId from config', async () => {
    const initializeNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeNative,
    });
    const logger = {
      nativeHandle: { id: 'logger-42' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    await startProtect({ logger });

    expect(initializeNative).toHaveBeenCalledWith(expect.any(Object), {
      loggerId: 'logger-42',
    });
  });

  it('startProtect() normalizes blank loggerId to undefined', async () => {
    const initializeNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeNative,
    });

    await startProtect({
      logger: {
        nativeHandle: { id: '   ' },
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });

    expect(initializeNative.mock.calls[0]?.[1]).toStrictEqual({
      loggerId: undefined,
    });
  });

  it('startProtect() calls resumeBehavioralData when resumeBehavioralDataOnStart is true', async () => {
    const initializeNative = jest.fn().mockResolvedValue(undefined);
    const resumeNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeNative,
      resumeBehavioralData: resumeNative,
    });

    await startProtect({ resumeBehavioralDataOnStart: true });

    expect(resumeNative).toHaveBeenCalledTimes(1);
  });

  it('startProtect() does not call resumeBehavioralData when flag is absent', async () => {
    const initializeNative = jest.fn().mockResolvedValue(undefined);
    const resumeNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeNative,
      resumeBehavioralData: resumeNative,
    });

    await startProtect({});

    expect(resumeNative).not.toHaveBeenCalled();
  });

  it('startProtect() wraps native error as ProtectError', async () => {
    const nativeError = new Error('PROTECT_INITIALIZE_ERROR');
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockRejectedValue(nativeError),
    });

    await expect(startProtect({})).rejects.toThrow('PROTECT_INITIALIZE_ERROR');
  });

  it('startProtect() does not register PROTECT when initialization fails', async () => {
    const { integrationCollectorTypes } = jest.requireActual(
      '@ping-identity/rn-types',
    ) as typeof import('@ping-identity/rn-types');
    integrationCollectorTypes.delete('PROTECT');

    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockRejectedValue(new Error('init failed')),
    });

    await expect(startProtect({})).rejects.toThrow('init failed');

    expect(integrationCollectorTypes.has('PROTECT')).toBe(false);
    integrationCollectorTypes.delete('PROTECT');
  });

  it('startProtect() registers PROTECT after initialization succeeds', async () => {
    const { integrationCollectorTypes } = jest.requireActual(
      '@ping-identity/rn-types',
    ) as typeof import('@ping-identity/rn-types');
    integrationCollectorTypes.delete('PROTECT');

    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(undefined),
    });

    await startProtect({});

    expect(integrationCollectorTypes.has('PROTECT')).toBe(true);
    integrationCollectorTypes.delete('PROTECT');
  });

  it('startProtect() logs operation lifecycle on success', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(undefined),
    });
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    await startProtect({ logger });

    expect(logger.debug).toHaveBeenCalledWith('Protect startProtect requested');
    expect(logger.info).toHaveBeenCalledWith('Protect startProtect success');
  });

  it('startProtect() logs failure before rethrowing', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest
        .fn()
        .mockRejectedValue(new Error('PROTECT_INITIALIZE_ERROR')),
    });
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    await expect(startProtect({ logger })).rejects.toThrow(
      'PROTECT_INITIALIZE_ERROR',
    );
    expect(logger.error).toHaveBeenCalledWith('Protect startProtect failed');
  });

  // ─── startProtectForJourney() ─────────────────────────────────────────────

  it('startProtectForJourney() registers Journey callbacks once without initializing', async () => {
    const registerJourneyCallbacks = jest.fn().mockResolvedValue(null);
    const initializeNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      registerJourneyCallbacks,
      initialize: initializeNative,
    });

    await expect(startProtectForJourney()).resolves.toBeUndefined();

    expect(registerJourneyCallbacks).toHaveBeenCalledTimes(1);
    expect(initializeNative).not.toHaveBeenCalled();
  });

  it('startProtectForJourney() logs request and success', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      registerJourneyCallbacks: jest.fn().mockResolvedValue(null),
    });
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    await startProtectForJourney({ logger });

    expect(logger.debug).toHaveBeenCalledWith(
      'Protect startProtectForJourney requested',
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Protect startProtectForJourney success',
    );
  });

  it('startProtectForJourney() wraps native failure as ProtectError and logs it', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      registerJourneyCallbacks: jest
        .fn()
        .mockRejectedValue(new Error('register failed')),
    });
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const result = startProtectForJourney({ logger });

    await expect(result).rejects.toBeInstanceOf(ProtectError);
    expect(logger.error).toHaveBeenCalledWith(
      'Protect startProtectForJourney failed',
    );
  });

  // ─── pauseBehavioralData() ────────────────────────────────────────────────

  it('pauseBehavioralData() delegates to native module', async () => {
    const pauseNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      pauseBehavioralData: pauseNative,
    });

    await pauseBehavioralData();

    expect(pauseNative).toHaveBeenCalledWith({ loggerId: undefined });
  });

  it('pauseBehavioralData() forwards loggerId when logger is provided', async () => {
    const pauseNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      pauseBehavioralData: pauseNative,
    });
    const logger = {
      nativeHandle: { id: 'logger-pause' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    await pauseBehavioralData({ logger });

    expect(pauseNative).toHaveBeenCalledWith({ loggerId: 'logger-pause' });
  });

  it('pauseBehavioralData() wraps native error as ProtectError', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      pauseBehavioralData: jest
        .fn()
        .mockRejectedValue(new Error('PROTECT_INITIALIZE_ERROR')),
    });

    await expect(pauseBehavioralData()).rejects.toThrow(
      'PROTECT_INITIALIZE_ERROR',
    );
  });

  // ─── resumeBehavioralData() ───────────────────────────────────────────────

  it('resumeBehavioralData() delegates to native module', async () => {
    const resumeNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      resumeBehavioralData: resumeNative,
    });

    await resumeBehavioralData();

    expect(resumeNative).toHaveBeenCalledWith({ loggerId: undefined });
  });

  it('resumeBehavioralData() forwards loggerId when logger is provided', async () => {
    const resumeNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      resumeBehavioralData: resumeNative,
    });
    const logger = {
      nativeHandle: { id: 'logger-resume' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    await resumeBehavioralData({ logger });

    expect(resumeNative).toHaveBeenCalledWith({ loggerId: 'logger-resume' });
  });

  it('resumeBehavioralData() wraps native error as ProtectError', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      resumeBehavioralData: jest
        .fn()
        .mockRejectedValue(new Error('PROTECT_INITIALIZE_ERROR')),
    });

    await expect(resumeBehavioralData()).rejects.toThrow(
      'PROTECT_INITIALIZE_ERROR',
    );
  });

  // ─── collectProtect() ─────────────────────────────────────────────────────

  it('collectProtect() calls getId() on the DaVinci instance and passes id to native', async () => {
    const collectNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      collectForDaVinci: collectNative,
    });
    const daVinci = { getId: jest.fn().mockResolvedValue('davinci-id-1') };

    await collectProtect(daVinci);

    expect(daVinci.getId).toHaveBeenCalledTimes(1);
    expect(collectNative).toHaveBeenCalledWith(
      'davinci-id-1',
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('collectProtect() passes empty options to native', async () => {
    const collectNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      collectForDaVinci: collectNative,
    });
    const daVinci = { getId: jest.fn().mockResolvedValue('davinci-abc') };

    await collectProtect(daVinci);

    expect(collectNative).toHaveBeenCalledWith('davinci-abc', {}, {});
  });

  it('collectProtect() resolves on native success', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      collectForDaVinci: jest.fn().mockResolvedValue(undefined),
    });
    const daVinci = { getId: jest.fn().mockResolvedValue('davinci-xyz') };

    await expect(collectProtect(daVinci)).resolves.toBeUndefined();
  });

  it('collectProtect() wraps native error as ProtectError', async () => {
    const nativeError = new Error('PROTECT_COLLECT_ERROR');
    (getNativeModule as jest.Mock).mockReturnValue({
      collectForDaVinci: jest.fn().mockRejectedValue(nativeError),
    });
    const daVinci = { getId: jest.fn().mockResolvedValue('davinci-xyz') };

    await expect(collectProtect(daVinci)).rejects.toThrow(
      'PROTECT_COLLECT_ERROR',
    );
  });

  // ─── collectProtectForJourney() ───────────────────────────────────────────

  it('collectProtectForJourney() calls getId() and passes default index to native', async () => {
    const collectNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      collectForJourney: collectNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-1') };

    await expect(collectProtectForJourney(journey)).resolves.toStrictEqual({
      type: 'success',
    });

    expect(journey.getId).toHaveBeenCalledTimes(1);
    expect(collectNative).toHaveBeenCalledWith(
      'journey-1',
      { index: 0 },
      { loggerId: undefined },
    );
  });

  it('collectProtectForJourney() forwards index and loggerId to native', async () => {
    const collectNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      collectForJourney: collectNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-1') };
    const logger = {
      nativeHandle: { id: 'logger-journey' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    await collectProtectForJourney(journey, { index: 2, logger });

    expect(collectNative).toHaveBeenCalledWith(
      'journey-1',
      { index: 2 },
      {
        loggerId: 'logger-journey',
      },
    );
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'collectProtectForJourney() rejects invalid index %s without calling getId() or native',
    async (index) => {
      const collectNative = jest.fn();
      (getNativeModule as jest.Mock).mockReturnValue({
        collectForJourney: collectNative,
      });
      const journey = { getId: jest.fn().mockResolvedValue('journey-1') };

      const error = await collectProtectForJourney(journey, { index }).catch(
        (caught) => caught,
      );

      expect(error).toBeInstanceOf(ProtectError);
      expect(error.code).toBe('PROTECT_ARGUMENT_ERROR');
      expect(error.type).toBe('argument_error');
      expect(journey.getId).not.toHaveBeenCalled();
      expect(collectNative).not.toHaveBeenCalled();
    },
  );

  it.each([
    'PROTECT_NOT_INITIALIZED',
    'PROTECT_COLLECT_ERROR',
    'PROTECT_CALLBACK_NOT_FOUND',
  ])(
    'collectProtectForJourney() wraps native %s as ProtectError',
    async (code) => {
      (getNativeModule as jest.Mock).mockReturnValue({
        collectForJourney: jest
          .fn()
          .mockRejectedValue({ error: code, type: 'state_error' }),
      });
      const journey = { getId: jest.fn().mockResolvedValue('journey-1') };

      const error = await collectProtectForJourney(journey).catch(
        (caught) => caught,
      );

      expect(error).toBeInstanceOf(ProtectError);
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(code);
    },
  );

  it('collectProtectForJourney() wraps getId() failure as ProtectError without calling native', async () => {
    const collectNative = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      collectForJourney: collectNative,
    });
    const journey = {
      getId: jest.fn().mockRejectedValue(new Error('id failure')),
    };

    const error = await collectProtectForJourney(journey).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(ProtectError);
    expect(error).toBeInstanceOf(Error);
    expect(journey.getId).toHaveBeenCalledTimes(1);
    expect(collectNative).not.toHaveBeenCalled();
  });

  it('collectProtectForJourney() logs lifecycle without leaking the collected signal', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      collectForJourney: jest
        .fn()
        .mockResolvedValue({ type: 'success', signal: 'jws-secret' }),
    });
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const journey = { getId: jest.fn().mockResolvedValue('journey-1') };

    await collectProtectForJourney(journey, { logger });

    expect(logger.debug).toHaveBeenCalledWith(
      'Protect collectProtectForJourney requested',
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Protect collectProtectForJourney success',
    );
    expect(logger.debug.mock.invocationCallOrder[0]).toBeLessThan(
      logger.info.mock.invocationCallOrder[0],
    );
    expect(logger.error).not.toHaveBeenCalled();
    for (const log of [logger.debug, logger.info, logger.warn, logger.error]) {
      expect(log).not.toHaveBeenCalledWith(expect.stringContaining('jws'));
    }
  });

  it('collectProtectForJourney() logs failure before rethrowing', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      collectForJourney: jest
        .fn()
        .mockRejectedValue({ error: 'PROTECT_COLLECT_ERROR' }),
    });
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const journey = { getId: jest.fn().mockResolvedValue('journey-1') };

    await expect(
      collectProtectForJourney(journey, { logger }),
    ).rejects.toBeInstanceOf(ProtectError);

    expect(logger.debug.mock.invocationCallOrder[0]).toBeLessThan(
      logger.error.mock.invocationCallOrder[0],
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Protect collectProtectForJourney failed',
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  // ─── initializeProtectForJourney() ────────────────────────────────────────

  it('initializeProtectForJourney() calls getId() and resolves success', async () => {
    const initializeNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      initializeForJourney: initializeNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-1') };

    await expect(initializeProtectForJourney(journey)).resolves.toStrictEqual({
      type: 'success',
    });

    expect(journey.getId).toHaveBeenCalledTimes(1);
    expect(initializeNative).toHaveBeenCalledWith('journey-1', {
      loggerId: undefined,
    });
  });

  it('initializeProtectForJourney() forwards loggerId to native', async () => {
    const initializeNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      initializeForJourney: initializeNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-1') };
    const logger = {
      nativeHandle: { id: 'logger-init' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    await initializeProtectForJourney(journey, { logger });

    expect(initializeNative).toHaveBeenCalledWith('journey-1', {
      loggerId: 'logger-init',
    });
  });

  it('initializeProtectForJourney() wraps native error as ProtectError and logs failure', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initializeForJourney: jest
        .fn()
        .mockRejectedValue({ error: 'PROTECT_INITIALIZE_ERROR' }),
    });
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const journey = { getId: jest.fn().mockResolvedValue('journey-1') };

    const error = await initializeProtectForJourney(journey, {
      logger,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ProtectError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('PROTECT_INITIALIZE_ERROR');
    expect(logger.debug).toHaveBeenCalledWith(
      'Protect initializeProtectForJourney requested',
    );
    expect(logger.debug.mock.invocationCallOrder[0]).toBeLessThan(
      logger.error.mock.invocationCallOrder[0],
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Protect initializeProtectForJourney failed',
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('initializeProtectForJourney() wraps getId() failure as ProtectError without calling native', async () => {
    const initializeNative = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      initializeForJourney: initializeNative,
    });
    const journey = {
      getId: jest.fn().mockRejectedValue(new Error('id failure')),
    };

    const error = await initializeProtectForJourney(journey).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(ProtectError);
    expect(error).toBeInstanceOf(Error);
    expect(journey.getId).toHaveBeenCalledTimes(1);
    expect(initializeNative).not.toHaveBeenCalled();
  });
});
