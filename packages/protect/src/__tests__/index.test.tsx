/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import {
  collectProtect,
  startProtect,
  pauseBehavioralData,
  resumeBehavioralData,
} from '../index';

jest.mock('../NativeRNPingProtect', () => ({
  __esModule: true,
  getNativeModule: jest.fn(),
  toNativeConfig: jest.fn((options) => options),
  toNativeProtectConfig: jest.fn((config) => config),
}));

import { getNativeModule } from '../NativeRNPingProtect';

describe('Protect API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── startProtect() ───────────────────────────────────────────────────────

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
});
