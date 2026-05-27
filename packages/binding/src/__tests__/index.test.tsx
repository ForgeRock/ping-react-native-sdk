/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import {
  createBindingClient,
  getAllKeys,
  deleteKey,
  deleteAllKeys,
  BindingError,
} from '../index';
import { PingError } from '@ping-identity/rn-types';

jest.mock('react-native', () => ({
  DeviceEventEmitter: {
    addListener: jest.fn(),
  },
  NativeModules: {},
  TurboModuleRegistry: {
    get: jest.fn(),
  },
}));

jest.mock('../NativeRNPingBinding', () => ({
  __esModule: true,
  getNativeModule: jest.fn(),
  toNativeConfigOptions: jest.fn((options) => options),
  toNativeBindOptions: jest.fn((options) => options),
  toNativeSignOptions: jest.fn((options) => options),
  fromNativeJourneyResult: jest.fn((result) => result),
  fromNativeUserKeys: jest.fn((result) => result),
}));

import { getNativeModule } from '../NativeRNPingBinding';

describe('Binding API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createBindingClient returns operations that forward to native', async () => {
    const bindNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      bindForJourney: bindNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-123') };
    const client = createBindingClient();

    await expect(client.bindForJourney(journey)).resolves.toEqual({
      type: 'success',
    });
    expect(journey.getId).toHaveBeenCalledTimes(1);
    expect(bindNative).toHaveBeenCalledWith(
      'journey-123',
      {
        index: undefined,
        deviceName: undefined,
        signingAlgorithm: undefined,
        appPin: undefined,
        biometric: undefined,
        jwt: undefined,
      },
      {
        loggerId: undefined,
        hasPinCollector: false,
        hasUserKeySelector: false,
        userKeyStorageId: undefined,
      },
    );
  });

  it('createBindingClient resolves per-client config once', async () => {
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const bindNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      bindForJourney: bindNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-123') };
    const client = createBindingClient({ logger });

    await client.bindForJourney(journey);
    expect(bindNative).toHaveBeenCalledWith(
      'journey-123',
      {
        index: undefined,
        deviceName: undefined,
        signingAlgorithm: undefined,
        appPin: undefined,
        biometric: undefined,
        jwt: undefined,
      },
      {
        loggerId: 'logger-1',
        hasPinCollector: false,
        hasUserKeySelector: false,
        userKeyStorageId: undefined,
      },
    );
  });

  it('bindForJourney forwards all per-call options to native', async () => {
    const bindNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      bindForJourney: bindNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-123') };
    const client = createBindingClient();

    await client.bindForJourney(journey, {
      index: 2,
      deviceName: 'Pixel',
      signingAlgorithm: 'RS256',
      appPin: { maxAttempts: 3, keystoreType: 'PKCS12' },
      biometric: {
        android: { strongBoxPreferred: true },
        ios: { keyTag: 'bio-key' },
      },
      jwt: { issueTimeEpochSeconds: 1000 },
    });

    expect(bindNative).toHaveBeenCalledWith(
      'journey-123',
      {
        index: 2,
        deviceName: 'Pixel',
        signingAlgorithm: 'RS256',
        appPin: { maxAttempts: 3, keystoreType: 'PKCS12' },
        biometric: {
          android: { strongBoxPreferred: true },
          ios: { keyTag: 'bio-key' },
        },
        jwt: { issueTimeEpochSeconds: 1000 },
      },
      {
        loggerId: undefined,
        hasPinCollector: false,
        hasUserKeySelector: false,
        userKeyStorageId: undefined,
      },
    );
  });

  it('bindForJourney rejects when native rejects', async () => {
    const nativeError = {
      error: 'BINDING_UI_UNAVAILABLE',
      type: 'binding_error',
      message: 'UI unavailable',
    };
    const bindNative = jest.fn().mockRejectedValue(nativeError);
    (getNativeModule as jest.Mock).mockReturnValue({
      bindForJourney: bindNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-123') };
    const client = createBindingClient();

    const err = await client.bindForJourney(journey).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PingError);
    expect(err).toBeInstanceOf(BindingError);
    expect(err.code).toBe('BINDING_UI_UNAVAILABLE');
  });

  it('signForJourney forwards all per-call options to native', async () => {
    const signNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      signForJourney: signNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-xyz') };
    const client = createBindingClient({
      logger: {
        nativeHandle: { id: 'logger-2' },
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });

    await client.signForJourney(journey, {
      index: 1,
      claims: { app_version: '1.0' },
      signingAlgorithm: 'RS384',
      appPin: { maxAttempts: 5, keystoreType: 'PKCS12' },
      biometric: {
        android: { strongBoxPreferred: false },
        ios: { keyTag: 'bio-key' },
      },
      jwt: { issueTimeEpochSeconds: 1000 },
    });

    expect(signNative).toHaveBeenCalledWith(
      'journey-xyz',
      {
        index: 1,
        claims: { app_version: '1.0' },
        signingAlgorithm: 'RS384',
        appPin: { maxAttempts: 5, keystoreType: 'PKCS12' },
        biometric: {
          android: { strongBoxPreferred: false },
          ios: { keyTag: 'bio-key' },
        },
        jwt: { issueTimeEpochSeconds: 1000 },
      },
      {
        loggerId: 'logger-2',
        hasPinCollector: false,
        hasUserKeySelector: false,
        userKeyStorageId: undefined,
      },
    );
  });

  it('signForJourney rejects when native rejects', async () => {
    const nativeError = {
      error: 'BINDING_NOT_REGISTERED',
      type: 'binding_error',
      message: 'not registered',
    };
    const signNative = jest.fn().mockRejectedValue(nativeError);
    (getNativeModule as jest.Mock).mockReturnValue({
      signForJourney: signNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-123') };
    const client = createBindingClient();

    const err = await client.signForJourney(journey).catch((e) => e);
    expect(err).toBeInstanceOf(BindingError);
    expect(err.code).toBe('BINDING_NOT_REGISTERED');
  });

  it('normalizes blank logger id to undefined', async () => {
    const bindNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      bindForJourney: bindNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-123') };
    const client = createBindingClient({
      logger: {
        nativeHandle: { id: '   ' },
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });

    await client.bindForJourney(journey);
    expect(bindNative).toHaveBeenCalledWith('journey-123', expect.any(Object), {
      loggerId: undefined,
      hasPinCollector: false,
      hasUserKeySelector: false,
      userKeyStorageId: undefined,
    });
  });

  it('logs operation lifecycle on success', async () => {
    const bindNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      bindForJourney: bindNative,
    });
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const journey = { getId: jest.fn().mockResolvedValue('journey-123') };
    const client = createBindingClient({ logger });
    await client.bindForJourney(journey);

    expect(logger.info).toHaveBeenCalledWith('Binding createClient success');
    expect(logger.info).toHaveBeenCalledWith(
      'Binding bindForJourney requested',
    );
    expect(logger.debug).toHaveBeenCalledWith('Binding bindForJourney success');
  });

  it('logs operation failure before rethrowing', async () => {
    const nativeError = {
      error: 'BINDING_BIND_ERROR',
      type: 'binding_error',
      message: 'bind failed',
    };
    const bindNative = jest.fn().mockRejectedValue(nativeError);
    (getNativeModule as jest.Mock).mockReturnValue({
      bindForJourney: bindNative,
    });
    const logger = {
      nativeHandle: { id: 'logger-1' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const journey = { getId: jest.fn().mockResolvedValue('journey-123') };
    const client = createBindingClient({ logger });
    const err = await client.bindForJourney(journey).catch((e) => e);
    expect(err).toBeInstanceOf(BindingError);
    expect(err.code).toBe('BINDING_BIND_ERROR');
    expect(logger.error).toHaveBeenCalledWith('Binding bindForJourney failed');
  });

  it('forwards userKeyStorage id from client config', async () => {
    const bindNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      bindForJourney: bindNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-123') };
    const client = createBindingClient({
      userKeyStorage: {
        id: 'binding-storage-1',
        kind: 'binding_user_key_storage',
      } as never,
    });

    await client.bindForJourney(journey);

    expect(bindNative).toHaveBeenCalledWith(
      'journey-123',
      expect.any(Object),
      expect.objectContaining({ userKeyStorageId: 'binding-storage-1' }),
    );
  });

  it('does not forward unsupported top-level UI aliases', async () => {
    const bindNative = jest.fn().mockResolvedValue({ type: 'success' });
    (getNativeModule as jest.Mock).mockReturnValue({
      bindForJourney: bindNative,
    });
    const journey = { getId: jest.fn().mockResolvedValue('journey-invalid') };
    const configWithLegacyAliases = {
      pinCollector: async () => '1234',
      userKeySelector: async (keys: unknown[]) => keys[0],
    } as unknown as Parameters<typeof createBindingClient>[0];
    const client = createBindingClient(configWithLegacyAliases);

    await client.bindForJourney(journey);

    expect(bindNative).toHaveBeenCalledWith(
      'journey-invalid',
      {
        index: undefined,
        deviceName: undefined,
        signingAlgorithm: undefined,
        appPin: undefined,
        biometric: undefined,
        jwt: undefined,
      },
      {
        loggerId: undefined,
        hasPinCollector: false,
        hasUserKeySelector: false,
        userKeyStorageId: undefined,
      },
    );
  });

  describe('getAllKeys', () => {
    it('resolves with mapped user key array from native', async () => {
      const nativeKeys = [
        {
          id: 'kid-1',
          userId: 'user-1',
          username: 'alice',
          authenticationType: 'BIOMETRIC_ONLY',
        },
        {
          id: 'kid-2',
          userId: 'user-2',
          username: 'bob',
          authenticationType: 'APPLICATION_PIN',
        },
      ];
      const getAllKeysNative = jest.fn().mockResolvedValue(nativeKeys);
      (getNativeModule as jest.Mock).mockReturnValue({
        getAllKeys: getAllKeysNative,
      });

      const result = await getAllKeys();

      expect(getAllKeysNative).toHaveBeenCalledTimes(1);
      expect(result).toEqual(nativeKeys);
    });

    it('rejects when native rejects', async () => {
      const nativeError = {
        error: 'BINDING_ERROR',
        type: 'binding_error',
        message: 'error',
      };
      (getNativeModule as jest.Mock).mockReturnValue({
        getAllKeys: jest.fn().mockRejectedValue(nativeError),
      });

      const err = await getAllKeys().catch((e) => e);
      expect(err).toBeInstanceOf(BindingError);
      expect(err.code).toBe('BINDING_ERROR');
    });
  });

  describe('deleteKey', () => {
    it('passes userId and id to native deleteKey', async () => {
      const deleteKeyNative = jest.fn().mockResolvedValue(null);
      (getNativeModule as jest.Mock).mockReturnValue({
        deleteKey: deleteKeyNative,
      });

      await deleteKey({
        id: 'kid-1',
        userId: 'user-1',
        username: 'alice',
        authenticationType: 'BIOMETRIC_ONLY',
      });

      expect(deleteKeyNative).toHaveBeenCalledWith('user-1', 'kid-1');
    });

    it('rejects when native rejects', async () => {
      const nativeError = {
        error: 'BINDING_KEY_DELETE_ERROR',
        type: 'binding_error',
        message: 'delete error',
      };
      (getNativeModule as jest.Mock).mockReturnValue({
        deleteKey: jest.fn().mockRejectedValue(nativeError),
      });

      const err = await deleteKey({
        id: 'kid-1',
        userId: 'user-1',
        username: 'alice',
        authenticationType: 'BIOMETRIC_ONLY',
      }).catch((e) => e);
      expect(err).toBeInstanceOf(BindingError);
      expect(err.code).toBe('BINDING_KEY_DELETE_ERROR');
    });
  });

  describe('deleteAllKeys', () => {
    it('calls native deleteAllKeys', async () => {
      const deleteAllKeysNative = jest.fn().mockResolvedValue(null);
      (getNativeModule as jest.Mock).mockReturnValue({
        deleteAllKeys: deleteAllKeysNative,
      });

      await deleteAllKeys();

      expect(deleteAllKeysNative).toHaveBeenCalledTimes(1);
    });

    it('rejects when native rejects', async () => {
      const nativeError = {
        error: 'BINDING_KEY_DELETE_ERROR',
        type: 'binding_error',
        message: 'delete all error',
      };
      (getNativeModule as jest.Mock).mockReturnValue({
        deleteAllKeys: jest.fn().mockRejectedValue(nativeError),
      });

      const err = await deleteAllKeys().catch((e) => e);
      expect(err).toBeInstanceOf(BindingError);
      expect(err.code).toBe('BINDING_KEY_DELETE_ERROR');
    });
  });
});
