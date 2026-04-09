/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import {
  createFidoClient,
} from '../index';

jest.mock('../NativeRNPingFido', () => ({
  __esModule: true,
  getNativeModule: jest.fn(),
  toNativeConfigOptions: jest.fn((options) => options),
  toNativeRegistrationOptions: jest.fn((options) => options),
  toNativeAuthenticationOptions: jest.fn((options) => options),
  fromNativeRegistrationResult: jest.fn((result) => result),
  fromNativeAuthenticationResult: jest.fn((result) => result),
  toNativeJourneyRegistrationOptions: jest.fn((options) => options),
  toNativeJourneyAuthenticationOptions: jest.fn((options) => options),
  fromNativeJourneyResult: jest.fn((result) => result),
}));

import { getNativeModule } from '../NativeRNPingFido';

describe('FIDO API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createFidoClient returns operations that forward to native', async () => {
    const registerNative = jest.fn().mockResolvedValue({ ok: true });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerCredential: registerNative,
    });
    const client = createFidoClient();

    await expect(client.register({ challenge: 'abc' })).resolves.toEqual({ ok: true });
    expect(registerNative).toHaveBeenCalledWith({ challenge: 'abc' }, {});
  });

  it('createFidoClient resolves per-client config once', async () => {
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const registerNative = jest.fn().mockResolvedValue({ ok: true });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerCredential: registerNative,
    });
    const client = createFidoClient({
      logger,
      android: { useFido2Client: true },
    });

    await client.register({ challenge: 'abc' });
    expect(registerNative).toHaveBeenCalledWith(
      { challenge: 'abc' },
      { loggerId: 'logger-1', useFido2Client: true }
    );
  });

  it('register passes options through to native unchanged', async () => {
    const registerNative = jest.fn().mockResolvedValue({});
    (getNativeModule as jest.Mock).mockReturnValue({ registerCredential: registerNative });
    const client = createFidoClient();

    const options = { challenge: 'xyz', rp: { id: 'example.com', name: 'Example' } };
    await client.register(options);

    expect(registerNative).toHaveBeenCalledWith(options, {});
  });

  it('register rejects when native rejects', async () => {
    const nativeError = new Error('FIDO_WINDOW_UNAVAILABLE');
    const registerNative = jest.fn().mockRejectedValue(nativeError);
    (getNativeModule as jest.Mock).mockReturnValue({ registerCredential: registerNative });
    const client = createFidoClient();

    await expect(client.register({ challenge: 'abc' })).rejects.toThrow('FIDO_WINDOW_UNAVAILABLE');
  });

  it('authenticate forwards to native', async () => {
    const authenticateNative = jest.fn().mockResolvedValue({ ok: true });
    (getNativeModule as jest.Mock).mockReturnValue({
      authenticateCredential: authenticateNative,
    });
    const client = createFidoClient();

    await expect(client.authenticate({ challenge: 'abc' })).resolves.toEqual({ ok: true });
    expect(authenticateNative).toHaveBeenCalledWith({ challenge: 'abc' }, {});
  });

  it('authenticate passes options through to native unchanged', async () => {
    const authenticateNative = jest.fn().mockResolvedValue({});
    (getNativeModule as jest.Mock).mockReturnValue({ authenticateCredential: authenticateNative });
    const client = createFidoClient();

    const options = { challenge: 'xyz', rpId: 'example.com', allowCredentials: [] };
    await client.authenticate(options);

    expect(authenticateNative).toHaveBeenCalledWith(options, {});
  });

  it('authenticate rejects when native rejects', async () => {
    const nativeError = new Error('FIDO_ACTIVITY_UNAVAILABLE');
    const authenticateNative = jest.fn().mockRejectedValue(nativeError);
    (getNativeModule as jest.Mock).mockReturnValue({ authenticateCredential: authenticateNative });
    const client = createFidoClient();

    await expect(client.authenticate({ challenge: 'abc' })).rejects.toThrow('FIDO_ACTIVITY_UNAVAILABLE');
  });

  it('registerForJourney resolves journey id and forwards to native', async () => {
    const registerJourneyNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerCredentialForJourney: registerJourneyNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-123') };
    const client = createFidoClient({
      logger: {
        nativeHandle: { id: 'logger-1' },
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      android: { useFido2Client: true },
    });

    await expect(
      client.registerForJourney(
        journey,
        { index: 2, deviceName: 'Pixel' }
      )
    ).resolves.toEqual({ type: 'success' });
    expect(journey.getId).toHaveBeenCalledTimes(1);
    expect(registerJourneyNative).toHaveBeenCalledWith('journey-123', {
      index: 2,
      deviceName: 'Pixel',
    }, {
      loggerId: 'logger-1',
      useFido2Client: true,
    });
  });

  it('authenticateForJourney resolves journey id and forwards to native', async () => {
    const authenticateJourneyNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      authenticateCredentialForJourney: authenticateJourneyNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-xyz') };
    const client = createFidoClient({
      logger: {
        nativeHandle: { id: 'logger-2' },
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });

    await expect(
      client.authenticateForJourney(journey, { index: 1 })
    ).resolves.toEqual({ type: 'success' });
    expect(journey.getId).toHaveBeenCalledTimes(1);
    expect(authenticateJourneyNative).toHaveBeenCalledWith(
      'journey-xyz',
      { index: 1 },
      { loggerId: 'logger-2' }
    );
  });

  it('normalizes blank logger id to undefined', async () => {
    const registerNative = jest.fn().mockResolvedValue({ ok: true });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerCredential: registerNative,
    });
    const client = createFidoClient({
      logger: {
        nativeHandle: { id: '   ' },
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });

    await client.register({ challenge: 'abc' });
    expect(registerNative).toHaveBeenCalledWith({ challenge: 'abc' }, {
      loggerId: undefined,
      useFido2Client: undefined,
    });
  });

  it('keeps client configs isolated per instance', async () => {
    const registerNative = jest.fn().mockResolvedValue({ ok: true });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerCredential: registerNative,
    });

    const clientA = createFidoClient({
      android: { useFido2Client: true },
    });
    const clientB = createFidoClient({
      android: { useFido2Client: false },
    });

    await clientA.register({ challenge: 'a' });
    await clientB.register({ challenge: 'b' });

    expect(registerNative).toHaveBeenNthCalledWith(1, { challenge: 'a' }, {
      loggerId: undefined,
      useFido2Client: true,
    });
    expect(registerNative).toHaveBeenNthCalledWith(2, { challenge: 'b' }, {
      loggerId: undefined,
      useFido2Client: false,
    });
  });
});
