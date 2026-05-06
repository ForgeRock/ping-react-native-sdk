/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { createExternalIdpClient } from '../index';

jest.mock('../NativeRNPingExternalIdp', () => ({
  __esModule: true,
  getNativeModule: jest.fn(),
  toNativeAuthorizeOptions: jest.fn((options) => options),
  toNativeSelectOptions: jest.fn((options) => options),
  toNativeConfig: jest.fn((options) => options),
  fromNativeAuthorizeResult: jest.fn((result) => result),
}));

import {
  fromNativeAuthorizeResult,
  getNativeModule,
} from '../NativeRNPingExternalIdp';

describe('ExternalIdp API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('authorizeForJourney success — returns ExternalIdpResult', async () => {
    const nativeResult = { token: 'tok', additionalParameters: { foo: 'bar' } };
    const authorizeNative = jest.fn().mockResolvedValue(nativeResult);
    (getNativeModule as jest.Mock).mockReturnValue({
      authorizeForJourney: authorizeNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-1') };
    const client = createExternalIdpClient({ redirectUri: 'com.app://cb' });

    const result = await client.authorizeForJourney(journey);

    expect(result).toEqual(nativeResult);
    expect(journey.getId).toHaveBeenCalledTimes(1);
    expect(fromNativeAuthorizeResult).toHaveBeenCalledWith(nativeResult);
    expect(authorizeNative).toHaveBeenCalledWith(
      'journey-1',
      {},
      { redirectUri: 'com.app://cb' },
    );
  });

  it('authorizeForJourney user cancel — propagates error', async () => {
    const nativeError = new Error('EXTERNAL_IDP_CANCELLED');
    const authorizeNative = jest.fn().mockRejectedValue(nativeError);
    (getNativeModule as jest.Mock).mockReturnValue({
      authorizeForJourney: authorizeNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-2') };
    const client = createExternalIdpClient({ redirectUri: 'com.app://cb' });

    await expect(client.authorizeForJourney(journey)).rejects.toThrow(
      'EXTERNAL_IDP_CANCELLED',
    );
  });

  it('authorizeForJourney with index — forwards option to native', async () => {
    const authorizeNative = jest
      .fn()
      .mockResolvedValue({ token: 't', additionalParameters: {} });
    (getNativeModule as jest.Mock).mockReturnValue({
      authorizeForJourney: authorizeNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-4') };
    const client = createExternalIdpClient({ redirectUri: 'com.app://cb' });

    await client.authorizeForJourney(journey, { index: 1 });

    expect(authorizeNative).toHaveBeenCalledWith(
      'journey-4',
      { index: 1 },
      { redirectUri: 'com.app://cb' },
    );
  });

  it('authorizeForJourney with no options — defaults forwarded', async () => {
    const authorizeNative = jest
      .fn()
      .mockResolvedValue({ token: 't', additionalParameters: {} });
    (getNativeModule as jest.Mock).mockReturnValue({
      authorizeForJourney: authorizeNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-5') };
    const client = createExternalIdpClient({ redirectUri: 'com.app://cb' });

    await client.authorizeForJourney(journey);

    expect(authorizeNative).toHaveBeenCalledWith(
      'journey-5',
      {},
      { redirectUri: 'com.app://cb' },
    );
  });

  it('authorizeForJourney — redirectUri from factory config, not from call site', async () => {
    const authorizeNative = jest
      .fn()
      .mockResolvedValue({ token: 't', additionalParameters: {} });
    (getNativeModule as jest.Mock).mockReturnValue({
      authorizeForJourney: authorizeNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-6') };
    const client = createExternalIdpClient({
      redirectUri: 'com.myapp://oauth',
    });

    await client.authorizeForJourney(journey, { index: 1 });

    expect(authorizeNative).toHaveBeenCalledWith(
      'journey-6',
      { index: 1 },
      { redirectUri: 'com.myapp://oauth' },
    );
  });

  it('selectProviderForJourney success — forwards provider to native', async () => {
    const selectNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      selectProviderForJourney: selectNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-7') };
    const client = createExternalIdpClient({});

    await client.selectProviderForJourney(journey, 'google');

    expect(selectNative).toHaveBeenCalledWith(
      'journey-7',
      'google',
      {},
      { redirectUri: '', loggerId: undefined },
    );
  });

  it('selectProviderForJourney callback not found — propagates error', async () => {
    const nativeError = new Error('EXTERNAL_IDP_CALLBACK_NOT_FOUND');
    const selectNative = jest.fn().mockRejectedValue(nativeError);
    (getNativeModule as jest.Mock).mockReturnValue({
      selectProviderForJourney: selectNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-8') };
    const client = createExternalIdpClient({});

    await expect(
      client.selectProviderForJourney(journey, 'google'),
    ).rejects.toThrow('EXTERNAL_IDP_CALLBACK_NOT_FOUND');
  });

  it('selectProviderForJourney with explicit index — forwards in options', async () => {
    const selectNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      selectProviderForJourney: selectNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-9') };
    const client = createExternalIdpClient({});

    await client.selectProviderForJourney(journey, 'facebook', { index: 2 });

    expect(selectNative).toHaveBeenCalledWith(
      'journey-9',
      'facebook',
      { index: 2 },
      { redirectUri: '', loggerId: undefined },
    );
  });

  it('uses native redirect defaults when redirectUri is missing', async () => {
    const authorizeNative = jest
      .fn()
      .mockResolvedValue({ token: 't', additionalParameters: {} });
    (getNativeModule as jest.Mock).mockReturnValue({
      authorizeForJourney: authorizeNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-default') };
    const client = createExternalIdpClient({});

    await client.authorizeForJourney(journey);

    expect(authorizeNative).toHaveBeenCalledWith(
      'journey-default',
      {},
      { redirectUri: '' },
    );
  });

  it('uses native redirect defaults when redirectUri is blank', async () => {
    const authorizeNative = jest
      .fn()
      .mockResolvedValue({ token: 't', additionalParameters: {} });
    (getNativeModule as jest.Mock).mockReturnValue({
      authorizeForJourney: authorizeNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-blank-uri') };
    const client = createExternalIdpClient({ redirectUri: '   ' });

    await client.authorizeForJourney(journey);

    expect(authorizeNative).toHaveBeenCalledWith(
      'journey-blank-uri',
      {},
      { redirectUri: '' },
    );
  });

  it('throws when redirectUri has no URI scheme', () => {
    expect(() => createExternalIdpClient({ redirectUri: 'callback' })).toThrow(
      '`redirectUri` must include a URI scheme',
    );
  });

  it('trims redirectUri before forwarding to native', async () => {
    const authorizeNative = jest
      .fn()
      .mockResolvedValue({ token: 't', additionalParameters: {} });
    (getNativeModule as jest.Mock).mockReturnValue({
      authorizeForJourney: authorizeNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-trim') };
    const client = createExternalIdpClient({ redirectUri: '  com.app://cb  ' });

    await client.authorizeForJourney(journey);

    expect(authorizeNative).toHaveBeenCalledWith(
      'journey-trim',
      {},
      { redirectUri: 'com.app://cb' },
    );
  });

  it('throws when provider is blank', async () => {
    const selectNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      selectProviderForJourney: selectNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-provider') };
    const client = createExternalIdpClient({});

    await expect(
      client.selectProviderForJourney(journey, '   '),
    ).rejects.toThrow('`provider` is required');
    expect(selectNative).not.toHaveBeenCalled();
  });

  it('trims provider before forwarding to native', async () => {
    const selectNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      selectProviderForJourney: selectNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-provider') };
    const client = createExternalIdpClient({});

    await client.selectProviderForJourney(journey, '  google  ');

    expect(selectNative).toHaveBeenCalledWith(
      'journey-provider',
      'google',
      {},
      { redirectUri: '', loggerId: undefined },
    );
  });

  it('logs operation lifecycle on success', async () => {
    const authorizeNative = jest
      .fn()
      .mockResolvedValue({ token: 't', additionalParameters: {} });
    (getNativeModule as jest.Mock).mockReturnValue({
      authorizeForJourney: authorizeNative,
    });
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const journey = { getId: jest.fn().mockResolvedValue('journey-log') };
    const client = createExternalIdpClient({
      redirectUri: 'com.app://cb',
      logger,
    });
    await client.authorizeForJourney(journey);

    expect(logger.info).toHaveBeenCalledWith(
      'ExternalIdp createClient success',
    );
    expect(logger.info).toHaveBeenCalledWith(
      'ExternalIdp authorizeForJourney requested',
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'ExternalIdp authorizeForJourney success',
    );
  });

  it('logs operation failure before rethrowing', async () => {
    const nativeError = new Error('EXTERNAL_IDP_AUTHORIZE_ERROR');
    const authorizeNative = jest.fn().mockRejectedValue(nativeError);
    (getNativeModule as jest.Mock).mockReturnValue({
      authorizeForJourney: authorizeNative,
    });
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const journey = { getId: jest.fn().mockResolvedValue('journey-err') };
    const client = createExternalIdpClient({
      redirectUri: 'com.app://cb',
      logger,
    });
    await expect(client.authorizeForJourney(journey)).rejects.toThrow(
      'EXTERNAL_IDP_AUTHORIZE_ERROR',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'ExternalIdp authorizeForJourney failed',
    );
  });

  it('selectProviderForJourney logs failure before rethrowing', async () => {
    const nativeError = new Error('EXTERNAL_IDP_CALLBACK_NOT_FOUND');
    const selectNative = jest.fn().mockRejectedValue(nativeError);
    (getNativeModule as jest.Mock).mockReturnValue({
      selectProviderForJourney: selectNative,
    });
    const logger = {
      nativeHandle: { id: 'logger-sel-err' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const journey = { getId: jest.fn().mockResolvedValue('journey-sel-err') };
    const client = createExternalIdpClient({ logger });

    await expect(
      client.selectProviderForJourney(journey, 'google'),
    ).rejects.toThrow('EXTERNAL_IDP_CALLBACK_NOT_FOUND');
    expect(logger.error).toHaveBeenCalledWith(
      'ExternalIdp selectProviderForJourney failed',
    );
  });

  it('normalizes blank logger id to undefined', async () => {
    const authorizeNative = jest
      .fn()
      .mockResolvedValue({ token: 't', additionalParameters: {} });
    (getNativeModule as jest.Mock).mockReturnValue({
      authorizeForJourney: authorizeNative,
    });
    const client = createExternalIdpClient({
      redirectUri: 'x://cb',
      logger: {
        nativeHandle: { id: '   ' },
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-blank') };

    await client.authorizeForJourney(journey);

    expect(authorizeNative).toHaveBeenCalledTimes(1);
    expect(authorizeNative.mock.calls[0]?.[0]).toBe('journey-blank');
    expect(authorizeNative.mock.calls[0]?.[1]).toStrictEqual({});
    expect(authorizeNative.mock.calls[0]?.[2]).toStrictEqual({
      redirectUri: 'x://cb',
      loggerId: undefined,
    });
  });

  it('keeps client configs isolated per instance', async () => {
    const authorizeNative = jest
      .fn()
      .mockResolvedValue({ token: 't', additionalParameters: {} });
    (getNativeModule as jest.Mock).mockReturnValue({
      authorizeForJourney: authorizeNative,
    });

    const clientA = createExternalIdpClient({ redirectUri: 'a://cb' });
    const clientB = createExternalIdpClient({ redirectUri: 'b://cb' });

    const journeyA = { getId: jest.fn().mockResolvedValue('j-a') };
    const journeyB = { getId: jest.fn().mockResolvedValue('j-b') };

    await clientA.authorizeForJourney(journeyA);
    await clientB.authorizeForJourney(journeyB);

    expect(authorizeNative).toHaveBeenNthCalledWith(
      1,
      'j-a',
      {},
      { redirectUri: 'a://cb' },
    );
    expect(authorizeNative).toHaveBeenNthCalledWith(
      2,
      'j-b',
      {},
      { redirectUri: 'b://cb' },
    );
  });

  it('resolves per-client config once and forwards loggerId', async () => {
    const logger = {
      nativeHandle: { id: 'logger-42' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const authorizeNative = jest
      .fn()
      .mockResolvedValue({ token: 't', additionalParameters: {} });
    (getNativeModule as jest.Mock).mockReturnValue({
      authorizeForJourney: authorizeNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-cfg') };
    const client = createExternalIdpClient({
      redirectUri: 'com.app://cb',
      logger,
    });

    await client.authorizeForJourney(journey);

    expect(authorizeNative).toHaveBeenCalledWith(
      'journey-cfg',
      {},
      { redirectUri: 'com.app://cb', loggerId: 'logger-42' },
    );
  });

  it('selectProviderForJourney forwards full config including loggerId via toNativeConfig', async () => {
    const logger = {
      nativeHandle: { id: 'logger-99' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const selectNative = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      selectProviderForJourney: selectNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-sel-cfg') };
    const client = createExternalIdpClient({ logger });

    await client.selectProviderForJourney(journey, 'google');

    expect(selectNative).toHaveBeenCalledWith(
      'journey-sel-cfg',
      'google',
      {},
      { redirectUri: '', loggerId: 'logger-99' },
    );
  });
});
