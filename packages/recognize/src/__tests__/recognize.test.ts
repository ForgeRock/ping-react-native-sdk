/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { createRecognizeClient, RecognizeError } from '../index';
import { recognizeErrorCodes } from '../types';
import type { LoggerInstance } from '../types';

jest.mock('../NativeRNPingRecognize', () => ({
  __esModule: true,
  getNativeModule: jest.fn(),
  toNativeRunOptions: jest.fn((options) => options),
  toNativeClientConfig: jest.fn((config) => config),
  fromNativeRunResult: jest.fn((result) => result),
}));

import { getNativeModule } from '../NativeRNPingRecognize';

const createTestLogger = (): LoggerInstance => ({
  nativeHandle: { id: 'logger-1' },
  changeLevel: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('createRecognizeClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getNativeModule as jest.Mock).mockReturnValue({
      runForJourney: jest.fn(),
    });
  });

  it('returns a client exposing runForJourney', () => {
    expect(typeof createRecognizeClient().runForJourney).toBe('function');
  });

  it('throws at creation when the native module is unavailable', () => {
    (getNativeModule as jest.Mock).mockImplementation(() => {
      throw new Error(
        '[@ping-identity/rn-recognize] Native module RNPingRecognize not found.',
      );
    });

    expect(() => createRecognizeClient()).toThrow(
      '[@ping-identity/rn-recognize] Native module RNPingRecognize not found.',
    );
  });

  it('forwards journey id, options and logger id to the native module', async () => {
    const runNative = jest
      .fn()
      .mockResolvedValue({ type: 'success', recognizeId: 'rec-1' });
    (getNativeModule as jest.Mock).mockReturnValue({
      runForJourney: runNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-123') };
    const client = createRecognizeClient({ logger: createTestLogger() });

    const result = await client.runForJourney(journey, {
      index: 1,
      retrieveSelfie: true,
    });

    expect(result).toEqual({ type: 'success', recognizeId: 'rec-1' });
    expect(runNative).toHaveBeenCalledWith(
      'journey-123',
      { index: 1, retrieveSelfie: true },
      { loggerId: 'logger-1' },
    );
  });

  it('passes through a failure result without throwing', async () => {
    const failure = {
      type: 'failure',
      code: '2002',
      message: 'Camera permission denied',
    };
    (getNativeModule as jest.Mock).mockReturnValue({
      runForJourney: jest.fn().mockResolvedValue(failure),
    });
    const client = createRecognizeClient();

    await expect(
      client.runForJourney({ getId: () => Promise.resolve('j1') }),
    ).resolves.toEqual(failure);
  });

  it('rejects with an argument_error when the journey has no getId', async () => {
    const client = createRecognizeClient();

    await expect(
      client.runForJourney({} as unknown as { getId: () => Promise<string> }),
    ).rejects.toMatchObject({
      name: 'RecognizeError',
      code: recognizeErrorCodes.error,
      type: 'argument_error',
    });
  });

  it('rejects with an argument_error when the journey id is blank', async () => {
    const client = createRecognizeClient();

    await expect(
      client.runForJourney({ getId: () => Promise.resolve('  ') }),
    ).rejects.toBeInstanceOf(RecognizeError);
  });

  it('wraps native rejections in RecognizeError', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      runForJourney: jest.fn().mockRejectedValue({
        error: recognizeErrorCodes.callbackNotFound,
        message: 'No active PingOneRecognizeCallback',
        type: 'state_error',
      }),
    });
    const client = createRecognizeClient();

    await expect(
      client.runForJourney({ getId: () => Promise.resolve('j1') }),
    ).rejects.toBeInstanceOf(RecognizeError);
  });
});
