/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { createFidoClient, FidoError } from '../index';
import {
  PingError,
  registerIntegrationCollectorType,
} from '@ping-identity/rn-types';
import { fidoCollectorType } from '../types';
import type {
  FidoAuthenticationCollector,
  FidoCollector,
  FidoRegistrationCollector,
} from '../types';

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
  toNativeDaVinciRegistrationOptions: jest.fn((options) => options),
  toNativeDaVinciAuthenticationOptions: jest.fn((options) => options),
  fromNativeDaVinciResult: jest.fn((result) => result),
}));

jest.mock('@ping-identity/rn-types', () => ({
  ...jest.requireActual('@ping-identity/rn-types'),
  registerIntegrationCollectorType: jest.fn(),
}));

import { getNativeModule } from '../NativeRNPingFido';

describe('FIDO API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
    });
  });

  it('createFidoClient registers FIDO2 as an integration collector type', () => {
    createFidoClient();

    expect(registerIntegrationCollectorType).toHaveBeenCalledWith('FIDO2');
  });

  it('createFidoClient registers the collector type before resolving config', () => {
    const registrationCalls: number[] = [];
    (registerIntegrationCollectorType as jest.Mock).mockImplementation(() => {
      registrationCalls.push(1);
    });

    createFidoClient();

    expect(registrationCalls).toHaveLength(1);
  });

  it('createFidoClient registers the native DaVinci serializer on creation', () => {
    const registerDaVinciSerializer = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer,
    });

    createFidoClient();

    expect(registerDaVinciSerializer).toHaveBeenCalledTimes(1);
    expect(registerDaVinciSerializer).toHaveBeenCalledWith();
  });

  it('createFidoClient throws when the native FIDO module is unavailable', () => {
    (getNativeModule as jest.Mock).mockImplementation(() => {
      throw new Error(
        '[@ping-identity/rn-fido] Native module RNPingFido not found.',
      );
    });

    expect(() => createFidoClient()).toThrow(
      '[@ping-identity/rn-fido] Native module RNPingFido not found.',
    );
    expect(registerIntegrationCollectorType).toHaveBeenCalledWith('FIDO2');
  });

  it('client operations surface the missing-module error from the lazy resolution path', async () => {
    (getNativeModule as jest.Mock)
      .mockReturnValueOnce({
        registerDaVinciSerializer: jest.fn(),
        registerCredential: jest.fn(),
      })
      .mockImplementation(() => {
        throw new Error(
          '[@ping-identity/rn-fido] Native module RNPingFido not found.',
        );
      });

    const client = createFidoClient();

    await expect(client.register({ challenge: 'abc' })).rejects.toThrow(
      '[@ping-identity/rn-fido] Native module RNPingFido not found.',
    );
  });

  it('createFidoClient returns operations that forward to native', async () => {
    const registerNative = jest.fn().mockResolvedValue({ ok: true });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
      registerCredential: registerNative,
    });
    const client = createFidoClient();

    await expect(client.register({ challenge: 'abc' })).resolves.toEqual({
      ok: true,
    });
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
      registerDaVinciSerializer: jest.fn(),
      registerCredential: registerNative,
    });
    const client = createFidoClient({
      logger,
      android: { useFido2Client: true },
    });

    await client.register({ challenge: 'abc' });
    expect(registerNative).toHaveBeenCalledWith(
      { challenge: 'abc' },
      { loggerId: 'logger-1', useFido2Client: true },
    );
  });

  it('register passes options through to native unchanged', async () => {
    const registerNative = jest.fn().mockResolvedValue({});
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
      registerCredential: registerNative,
    });
    const client = createFidoClient();

    const options = {
      challenge: 'xyz',
      rp: { id: 'example.com', name: 'Example' },
    };
    await client.register(options);

    expect(registerNative).toHaveBeenCalledWith(options, {});
  });

  it('register rejects when native rejects', async () => {
    const nativeError = {
      error: 'FIDO_WINDOW_UNAVAILABLE',
      type: 'fido_error',
      message: 'window unavailable',
    };
    const registerNative = jest.fn().mockRejectedValue(nativeError);
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
      registerCredential: registerNative,
    });
    const client = createFidoClient();

    const err = await client.register({ challenge: 'abc' }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PingError);
    expect(err).toBeInstanceOf(FidoError);
    expect(err.code).toBe('FIDO_WINDOW_UNAVAILABLE');
    expect(err.message).toBe('window unavailable');
  });

  it('authenticate forwards to native', async () => {
    const authenticateNative = jest.fn().mockResolvedValue({ ok: true });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
      authenticateCredential: authenticateNative,
    });
    const client = createFidoClient();

    await expect(client.authenticate({ challenge: 'abc' })).resolves.toEqual({
      ok: true,
    });
    expect(authenticateNative).toHaveBeenCalledWith({ challenge: 'abc' }, {});
  });

  it('authenticate passes options through to native unchanged', async () => {
    const authenticateNative = jest.fn().mockResolvedValue({});
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
      authenticateCredential: authenticateNative,
    });
    const client = createFidoClient();

    const options = {
      challenge: 'xyz',
      rpId: 'example.com',
      allowCredentials: [],
    };
    await client.authenticate(options);

    expect(authenticateNative).toHaveBeenCalledWith(options, {});
  });

  it('authenticate rejects when native rejects', async () => {
    const nativeError = {
      error: 'FIDO_ACTIVITY_UNAVAILABLE',
      type: 'fido_error',
      message: 'activity unavailable',
    };
    const authenticateNative = jest.fn().mockRejectedValue(nativeError);
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
      authenticateCredential: authenticateNative,
    });
    const client = createFidoClient();

    const err = await client.authenticate({ challenge: 'abc' }).catch((e) => e);
    expect(err).toBeInstanceOf(FidoError);
    expect(err.code).toBe('FIDO_ACTIVITY_UNAVAILABLE');
  });

  it('registerForJourney resolves journey id and forwards to native', async () => {
    const registerJourneyNative = jest
      .fn()
      .mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
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
      client.registerForJourney(journey, { index: 2, deviceName: 'Pixel' }),
    ).resolves.toEqual({ type: 'success' });
    expect(journey.getId).toHaveBeenCalledTimes(1);
    expect(registerJourneyNative).toHaveBeenCalledWith(
      'journey-123',
      {
        index: 2,
        deviceName: 'Pixel',
      },
      {
        loggerId: 'logger-1',
        useFido2Client: true,
      },
    );
  });

  it('authenticateForJourney resolves journey id and forwards to native', async () => {
    const authenticateJourneyNative = jest
      .fn()
      .mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
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
      client.authenticateForJourney(journey, { index: 1 }),
    ).resolves.toEqual({ type: 'success' });
    expect(journey.getId).toHaveBeenCalledTimes(1);
    expect(authenticateJourneyNative).toHaveBeenCalledWith(
      'journey-xyz',
      { index: 1 },
      { loggerId: 'logger-2' },
    );
  });

  it('normalizes blank logger id to undefined', async () => {
    const registerNative = jest.fn().mockResolvedValue({ ok: true });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
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
    expect(registerNative).toHaveBeenCalledWith(
      { challenge: 'abc' },
      {
        loggerId: undefined,
        useFido2Client: undefined,
      },
    );
  });

  it('keeps client configs isolated per instance', async () => {
    const registerNative = jest.fn().mockResolvedValue({ ok: true });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
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

    expect(registerNative).toHaveBeenNthCalledWith(
      1,
      { challenge: 'a' },
      {
        loggerId: undefined,
        useFido2Client: true,
      },
    );
    expect(registerNative).toHaveBeenNthCalledWith(
      2,
      { challenge: 'b' },
      {
        loggerId: undefined,
        useFido2Client: false,
      },
    );
  });

  it('logs operation lifecycle on success', async () => {
    const registerNative = jest.fn().mockResolvedValue({ ok: true });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
      registerCredential: registerNative,
    });
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const client = createFidoClient({ logger });
    await client.register({ challenge: 'abc' });

    expect(logger.info).toHaveBeenCalledWith('FIDO createClient success');
    expect(logger.info).toHaveBeenCalledWith('FIDO register requested');
    expect(logger.debug).toHaveBeenCalledWith('FIDO register success');
  });

  it('logs operation failure before rethrowing', async () => {
    const nativeError = {
      error: 'FIDO_REGISTER_ERROR',
      type: 'fido_error',
      message: 'register failed',
    };
    const registerNative = jest.fn().mockRejectedValue(nativeError);
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
      registerCredential: registerNative,
    });
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const client = createFidoClient({ logger });
    const err = await client.register({ challenge: 'abc' }).catch((e) => e);
    expect(err).toBeInstanceOf(FidoError);
    expect(err.code).toBe('FIDO_REGISTER_ERROR');
    expect(logger.error).toHaveBeenCalledWith('FIDO register failed');
  });

  it('registerForDaVinci resolves davinci id and forwards to native', async () => {
    const registerDaVinciNative = jest.fn().mockResolvedValue({
      attestationValue: { attestationObject: 'o2NmbXQ' },
    });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
      registerCredentialForDaVinci: registerDaVinciNative,
    });
    const daVinci = { getId: jest.fn().mockResolvedValue('davinci-123') };
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const client = createFidoClient({
      logger,
      android: { useFido2Client: true },
    });

    await expect(
      client.registerForDaVinci(daVinci, { index: 1 }),
    ).resolves.toEqual({
      attestationValue: { attestationObject: 'o2NmbXQ' },
    });
    expect(daVinci.getId).toHaveBeenCalledTimes(1);
    expect(registerDaVinciNative).toHaveBeenCalledWith(
      'davinci-123',
      { index: 1 },
      {
        loggerId: 'logger-1',
        useFido2Client: true,
      },
    );
    expect(logger.info).toHaveBeenCalledWith(
      'FIDO registerForDaVinci requested',
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'FIDO registerForDaVinci success',
    );
  });

  it('authenticateForDaVinci resolves davinci id and forwards to native', async () => {
    const authenticateDaVinciNative = jest.fn().mockResolvedValue({
      assertionValue: { authenticatorData: 'AAECAw' },
    });
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
      authenticateCredentialForDaVinci: authenticateDaVinciNative,
    });
    const daVinci = { getId: jest.fn().mockResolvedValue('davinci-xyz') };
    const logger = {
      nativeHandle: { id: 'logger-2' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const client = createFidoClient({ logger });

    await expect(
      client.authenticateForDaVinci(daVinci, { index: 2 }),
    ).resolves.toEqual({
      assertionValue: { authenticatorData: 'AAECAw' },
    });
    expect(daVinci.getId).toHaveBeenCalledTimes(1);
    expect(authenticateDaVinciNative).toHaveBeenCalledWith(
      'davinci-xyz',
      { index: 2 },
      {
        loggerId: 'logger-2',
        useFido2Client: undefined,
      },
    );
    expect(logger.info).toHaveBeenCalledWith(
      'FIDO authenticateForDaVinci requested',
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'FIDO authenticateForDaVinci success',
    );
  });

  it('registerForDaVinci throws FidoError preserving the native code', async () => {
    const nativeError = {
      error: 'FIDO_COLLECTOR_NOT_FOUND',
      type: 'state_error',
      message: 'No active FIDO registration collector found',
    };
    const registerDaVinciNative = jest.fn().mockRejectedValue(nativeError);
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
      registerCredentialForDaVinci: registerDaVinciNative,
    });
    const daVinci = { getId: jest.fn().mockResolvedValue('davinci-123') };
    const client = createFidoClient();

    const err = await client
      .registerForDaVinci(daVinci, { index: 0 })
      .catch((e) => e);

    expect(err).toBeInstanceOf(FidoError);
    expect(err.code).toBe('FIDO_COLLECTOR_NOT_FOUND');
    expect(err.type).toBe('state_error');
  });

  it('authenticateForDaVinci forwards a default empty options object', async () => {
    const authenticateDaVinciNative = jest.fn().mockResolvedValue({});
    (getNativeModule as jest.Mock).mockReturnValue({
      registerDaVinciSerializer: jest.fn(),
      authenticateCredentialForDaVinci: authenticateDaVinciNative,
    });
    const daVinci = { getId: jest.fn().mockResolvedValue('davinci-xyz') };
    const client = createFidoClient();

    await client.authenticateForDaVinci(daVinci);

    expect(authenticateDaVinciNative).toHaveBeenCalledWith(
      'davinci-xyz',
      {},
      {
        loggerId: undefined,
        useFido2Client: undefined,
      },
    );
  });
});

describe('FIDO collector contract', () => {
  const registrationCollector: FidoRegistrationCollector = {
    key: 'fido-register',
    type: fidoCollectorType,
    action: 'REGISTER',
    label: 'Register passkey',
    required: true,
    trigger: 'submit',
    publicKeyCredentialCreationOptions: { rp: { name: 'Example' } },
  };

  const authenticationCollector: FidoAuthenticationCollector = {
    key: 'fido-authenticate',
    type: fidoCollectorType,
    action: 'AUTHENTICATE',
    label: 'Sign in with passkey',
    required: false,
    publicKeyCredentialRequestOptions: { challenge: 'abc' },
  };

  it('FidoRegistrationCollector and FidoAuthenticationCollector satisfy the FidoCollector union', () => {
    const collectors: FidoCollector[] = [
      registrationCollector,
      authenticationCollector,
    ];

    expect(collectors).toHaveLength(2);
  });

  it('discriminates on action while sharing the FIDO2 type', () => {
    for (const collector of [
      registrationCollector,
      authenticationCollector,
    ] as FidoCollector[]) {
      expect(collector.type).toBe('FIDO2');
      if (collector.action === 'REGISTER') {
        expect(collector.publicKeyCredentialCreationOptions).toBeDefined();
      } else {
        expect(collector.publicKeyCredentialRequestOptions).toBeDefined();
      }
    }
  });
});
