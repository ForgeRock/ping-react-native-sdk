/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { createRecaptchaClient, RecaptchaError } from '../index';
import { PingError } from '@ping-identity/rn-types';
import { recaptchaErrorCodes } from '../types';
import type { LoggerInstance } from '../types';

jest.mock('../NativeRNPingRecaptcha', () => ({
  __esModule: true,
  getNativeModule: jest.fn(),
  toNativeVerifyOptions: jest.fn((options) => options),
  toNativeClientConfig: jest.fn((config) => config),
  fromNativeVerifyResult: jest.fn((result) => result),
}));

import { getNativeModule } from '../NativeRNPingRecaptcha';

const createTestLogger = (): LoggerInstance => ({
  nativeHandle: { id: 'logger-1' },
  changeLevel: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('createRecaptchaClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: jest.fn(),
    });
  });

  it('returns a client exposing verifyForJourney', () => {
    const client = createRecaptchaClient();

    expect(typeof client.verifyForJourney).toBe('function');
  });

  it('createRecaptchaClient throws when the native reCAPTCHA module is unavailable', () => {
    (getNativeModule as jest.Mock).mockImplementation(() => {
      throw new Error(
        '[@ping-identity/rn-recaptcha] Native module RNPingRecaptcha not found.',
      );
    });

    expect(() => createRecaptchaClient()).toThrow(
      '[@ping-identity/rn-recaptcha] Native module RNPingRecaptcha not found.',
    );
  });

  it('createRecaptchaClient resolves config from the provided logger', async () => {
    const verifyNative = jest
      .fn()
      .mockResolvedValue({ type: 'success', token: 'tok' });
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const logger = createTestLogger();
    const journey = { getId: jest.fn().mockResolvedValue('journey-123') };
    const client = createRecaptchaClient({ logger });

    await client.verifyForJourney(journey, { index: 1 });

    expect(verifyNative).toHaveBeenCalledWith(
      'journey-123',
      { index: 1 },
      { loggerId: 'logger-1' },
    );
  });

  it('normalizes blank logger id to undefined', async () => {
    const verifyNative = jest
      .fn()
      .mockResolvedValue({ type: 'success', token: 'tok' });
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const client = createRecaptchaClient({
      logger: { ...createTestLogger(), nativeHandle: { id: '   ' } },
    });

    await client.verifyForJourney({ getId: jest.fn().mockResolvedValue('j1') });

    expect(verifyNative).toHaveBeenCalledWith(
      'j1',
      {},
      { loggerId: undefined },
    );
  });

  it('defaults to a noop logger when none is provided', async () => {
    const verifyNative = jest
      .fn()
      .mockResolvedValue({ type: 'success', token: 'tok' });
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const client = createRecaptchaClient();

    await expect(
      client.verifyForJourney({ getId: jest.fn().mockResolvedValue('j1') }),
    ).resolves.toEqual({ type: 'success', token: 'tok' });
  });

  it('keeps client configs isolated per instance', async () => {
    const verifyNative = jest
      .fn()
      .mockResolvedValue({ type: 'success', token: 'tok' });
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });

    const clientA = createRecaptchaClient({ logger: createTestLogger() });
    const clientB = createRecaptchaClient();

    await clientA.verifyForJourney({ getId: () => Promise.resolve('a') });
    await clientB.verifyForJourney({ getId: () => Promise.resolve('b') });

    expect(verifyNative).toHaveBeenNthCalledWith(
      1,
      'a',
      {},
      { loggerId: 'logger-1' },
    );
    expect(verifyNative).toHaveBeenNthCalledWith(
      2,
      'b',
      {},
      { loggerId: undefined },
    );
  });

  it('logs lifecycle with a custom logger', async () => {
    const verifyNative = jest
      .fn()
      .mockResolvedValue({ type: 'success', token: 'tok' });
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const logger = createTestLogger();
    const client = createRecaptchaClient({ logger });

    await client.verifyForJourney({ getId: jest.fn().mockResolvedValue('j1') });

    expect(logger.debug).toHaveBeenCalledWith(
      'reCAPTCHA verifyForJourney success',
    );
    expect(logger.info).toHaveBeenCalledWith(
      'reCAPTCHA verifyForJourney requested',
    );
  });

  it('logs failures before rethrowing', async () => {
    const verifyNative = jest.fn().mockRejectedValue({
      error: recaptchaErrorCodes.verifyError,
      type: 'internal_error',
      message: 'verify failed',
    });
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const logger = createTestLogger();
    const client = createRecaptchaClient({ logger });

    const err = await client
      .verifyForJourney({ getId: jest.fn().mockResolvedValue('j1') })
      .catch((e) => e);

    expect(err).toBeInstanceOf(RecaptchaError);
    expect(logger.error).toHaveBeenCalledWith(
      'reCAPTCHA verifyForJourney failed',
    );
  });
});

describe('verifyForJourney', () => {
  const journey = { getId: jest.fn().mockResolvedValue('journey-123') };

  beforeEach(() => {
    jest.clearAllMocks();
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: jest.fn(),
    });
  });

  it('happy path resolves { type: success, token }', async () => {
    const verifyNative = jest
      .fn()
      .mockResolvedValue({ type: 'success', token: 'recaptcha-token' });
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const client = createRecaptchaClient();

    await expect(client.verifyForJourney(journey)).resolves.toEqual({
      type: 'success',
      token: 'recaptcha-token',
    });
  });

  it('native failure payload maps to { type: failure, code, message } without throwing', async () => {
    const verifyNative = jest.fn().mockResolvedValue({
      type: 'failure',
      code: 'NETWORK_ERROR',
      message: 'Network unreachable',
    });
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const client = createRecaptchaClient();

    await expect(client.verifyForJourney(journey)).resolves.toEqual({
      type: 'failure',
      code: 'NETWORK_ERROR',
      message: 'Network unreachable',
    });
  });

  it('callback-not-found rejection maps to RecaptchaError with RECAPTCHA_CALLBACK_NOT_FOUND', async () => {
    const verifyNative = jest.fn().mockRejectedValue({
      error: recaptchaErrorCodes.callbackNotFound,
      type: 'state_error',
      message: 'No active ReCaptchaEnterpriseCallback found at index 0',
    });
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const client = createRecaptchaClient();

    const err = await client.verifyForJourney(journey).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PingError);
    expect(err).toBeInstanceOf(RecaptchaError);
    expect(err.code).toBe('RECAPTCHA_CALLBACK_NOT_FOUND');
    expect(err.type).toBe('state_error');
    expect(err.message).toBe(
      'No active ReCaptchaEnterpriseCallback found at index 0',
    );
  });

  it('argument validation throws before calling native when journey is not an object', async () => {
    const verifyNative = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const client = createRecaptchaClient();

    const err = await client
      .verifyForJourney(
        undefined as unknown as { getId: () => Promise<string> },
      )
      .catch((e) => e);

    expect(err).toBeInstanceOf(RecaptchaError);
    expect(err.type).toBe('argument_error');
    expect(err.code).toBe('RECAPTCHA_ERROR');
    expect(err.message).toBe(
      'verifyForJourney requires a Journey instance exposing getId().',
    );
    expect(verifyNative).not.toHaveBeenCalled();
  });

  it('argument validation throws before calling native when getId is not a function', async () => {
    const verifyNative = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const client = createRecaptchaClient();

    const err = await client
      .verifyForJourney({ getId: 'nope' } as unknown as {
        getId: () => Promise<string>;
      })
      .catch((e) => e);

    expect(err).toBeInstanceOf(RecaptchaError);
    expect(err.type).toBe('argument_error');
    expect(verifyNative).not.toHaveBeenCalled();
  });

  it('rejects with argument_error when the journey id resolves empty', async () => {
    const verifyNative = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const client = createRecaptchaClient();

    const err = await client
      .verifyForJourney({ getId: jest.fn().mockResolvedValue('   ') })
      .catch((e) => e);

    expect(err).toBeInstanceOf(RecaptchaError);
    expect(err.type).toBe('argument_error');
    expect(err.message).toBe(
      'verifyForJourney requires a non-empty Journey instance id.',
    );
    expect(verifyNative).not.toHaveBeenCalled();
  });

  it('argument validation rejects before any native call', () => {
    const verifyNative = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const client = createRecaptchaClient();

    const promise = client.verifyForJourney(
      null as unknown as { getId: () => Promise<string> },
    );

    return expect(promise).rejects.toMatchObject({ type: 'argument_error' });
  });

  it('forwards options through to native and omits absent index', async () => {
    const verifyNative = jest
      .fn()
      .mockResolvedValue({ type: 'success', token: 'tok' });
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const client = createRecaptchaClient();

    await client.verifyForJourney(journey, {
      action: 'signup',
      timeoutMs: 5000,
      payload: { risk: 0.2 },
    });

    expect(verifyNative).toHaveBeenCalledWith(
      'journey-123',
      {
        action: 'signup',
        timeoutMs: 5000,
        payload: { risk: 0.2 },
      },
      { loggerId: undefined },
    );
    // index absent from the forwarded options — native resolves index 0.
    expect(verifyNative.mock.calls[0]?.[1]).not.toHaveProperty('index');
  });

  it('forwards index explicitly when provided', async () => {
    const verifyNative = jest
      .fn()
      .mockResolvedValue({ type: 'success', token: 'tok' });
    (getNativeModule as jest.Mock).mockReturnValue({
      verifyForJourney: verifyNative,
    });
    const client = createRecaptchaClient();

    await client.verifyForJourney(journey, { index: 2 });

    expect(verifyNative).toHaveBeenCalledWith(
      'journey-123',
      { index: 2 },
      { loggerId: undefined },
    );
  });
});

describe('recaptchaErrorCodes', () => {
  it('exposes the stable native-synced codes', () => {
    expect(recaptchaErrorCodes).toEqual({
      error: 'RECAPTCHA_ERROR',
      verifyError: 'RECAPTCHA_VERIFY_ERROR',
      callbackNotFound: 'RECAPTCHA_CALLBACK_NOT_FOUND',
    });
  });
});

describe('RecaptchaError', () => {
  it('normalizes classic Android-shaped rejections nested in userInfo', () => {
    const err = RecaptchaError.from({
      code: 1,
      userInfo: {
        error: 'RECAPTCHA_CALLBACK_NOT_FOUND',
        type: 'state_error',
        message: 'no callback',
      },
    });

    expect(err).toBeInstanceOf(RecaptchaError);
    expect(err.code).toBe('RECAPTCHA_CALLBACK_NOT_FOUND');
    expect(err.type).toBe('state_error');
    expect(err.message).toBe('no callback');
  });

  it('normalizes iOS-shaped rejections with a top-level code string', () => {
    const err = RecaptchaError.from({
      code: 'RECAPTCHA_VERIFY_ERROR',
      message: 'verify failed',
    });

    expect(err).toBeInstanceOf(RecaptchaError);
    expect(err.code).toBe('RECAPTCHA_VERIFY_ERROR');
  });

  it('is named RecaptchaError', () => {
    const err = RecaptchaError.from(
      new RecaptchaError('x', 'C', 'argument_error'),
    );

    expect(err.name).toBe('RecaptchaError');
  });
});
