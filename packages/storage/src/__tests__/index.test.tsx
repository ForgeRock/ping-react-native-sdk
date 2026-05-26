/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { LoggerInstance } from '@ping-identity/rn-types';
import {
  CacheStrategy,
  configureBindingUserKeyStorage,
  configureOathStorage,
  configureSessionStorage,
  configureOidcStorage,
} from '../index';
import type { StorageConfig } from '../index';

// Mock the Native Module
const mockNativeRNPingStorage = {
  registerSessionStorage: jest.fn(),
  registerOidcStorage: jest.fn(),
  registerBindingUserKeyStorage: jest.fn(),
  registerOathStorage: jest.fn(),
  configureSessionStorage: jest.fn(),
  configureOidcStorage: jest.fn(),
  configureBindingUserKeyStorage: jest.fn(),
  configureOathStorage: jest.fn(),
};

jest.mock('../NativeRNPingStorage', () => ({
  getNativeModule: () => mockNativeRNPingStorage,
  CacheStrategy: {
    CACHE_ON_FAILURE: 'cache_on_failure',
    NO_CACHE: 'no_cache',
    CACHE: 'cache',
  },
}));

describe('Storage API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Factory functions', () => {
    it('configureSessionStorage returns the config', () => {
      mockNativeRNPingStorage.registerSessionStorage.mockReturnValue(
        'session-id',
      );
      mockNativeRNPingStorage.configureSessionStorage.mockReturnValue({});

      const instance = configureSessionStorage({
        android: {
          keyAlias: 'session-key',
        },
      });

      expect(
        mockNativeRNPingStorage.registerSessionStorage,
      ).toHaveBeenCalledWith({
        keyAlias: 'session-key',
      });
      expect(
        mockNativeRNPingStorage.configureSessionStorage,
      ).toHaveBeenCalledWith('session-id');
      expect(instance).toEqual({ id: 'session-id', kind: 'session' });
    });

    it('configureSessionStorage can be created with all config options', () => {
      const config = {
        android: {
          keyAlias: 'session-key',
          fileName: 'session.dat',
          strongBoxPreferred: true,
          cacheStrategy: CacheStrategy.CACHE_ON_FAILURE,
        },
        ios: {
          account: 'com.example.session',
          encryptor: true,
          cacheable: true,
        },
      };

      mockNativeRNPingStorage.registerSessionStorage.mockReturnValue(
        'session-id',
      );
      mockNativeRNPingStorage.configureSessionStorage.mockReturnValue({
        keyAlias: 'session-key',
        fileName: 'session.dat',
        strongBoxPreferred: true,
        cacheStrategy: 'cache_on_failure',
        account: 'com.example.session',
        encryptor: true,
        cacheable: true,
      });

      expect(configureSessionStorage(config)).toEqual({
        id: 'session-id',
        kind: 'session',
        ...config,
      });
    });

    it('configureSessionStorage validates config', () => {
      expect(() =>
        configureSessionStorage(null as unknown as StorageConfig),
      ).toThrow(/Missing configuration/);
    });

    it('configureOidcStorage returns the config', () => {
      mockNativeRNPingStorage.registerOidcStorage.mockReturnValue('oidc-id');
      mockNativeRNPingStorage.configureOidcStorage.mockReturnValue({});

      const instance = configureOidcStorage({
        android: {
          keyAlias: 'oidc-key',
        },
      });

      expect(mockNativeRNPingStorage.registerOidcStorage).toHaveBeenCalledWith({
        keyAlias: 'oidc-key',
      });
      expect(mockNativeRNPingStorage.configureOidcStorage).toHaveBeenCalledWith(
        'oidc-id',
      );
      expect(instance).toEqual({ id: 'oidc-id', kind: 'oidc' });
    });

    it('configureOidcStorage can be created with all config options', () => {
      const config = {
        android: {
          keyAlias: 'oidc-key',
          fileName: 'oidc.dat',
          strongBoxPreferred: false,
          cacheStrategy: CacheStrategy.NO_CACHE,
        },
        ios: {
          account: 'com.example.oidc',
          encryptor: false,
          cacheable: false,
        },
      };

      mockNativeRNPingStorage.registerOidcStorage.mockReturnValue('oidc-id');
      mockNativeRNPingStorage.configureOidcStorage.mockReturnValue({
        keyAlias: 'oidc-key',
        fileName: 'oidc.dat',
        strongBoxPreferred: false,
        cacheStrategy: 'no_cache',
        account: 'com.example.oidc',
        encryptor: false,
        cacheable: false,
      });

      expect(configureOidcStorage(config)).toEqual({
        id: 'oidc-id',
        kind: 'oidc',
        ...config,
      });
    });

    it('configureOidcStorage validates config', () => {
      expect(() =>
        configureOidcStorage(null as unknown as StorageConfig),
      ).toThrow(/Missing configuration/);
    });

    it('configureBindingUserKeyStorage returns the config', () => {
      mockNativeRNPingStorage.registerBindingUserKeyStorage.mockReturnValue(
        'binding-user-key-id',
      );
      mockNativeRNPingStorage.configureBindingUserKeyStorage.mockReturnValue(
        {},
      );

      const instance = configureBindingUserKeyStorage({
        android: {
          keyAlias: 'binding-user-key',
        },
      });

      expect(
        mockNativeRNPingStorage.registerBindingUserKeyStorage,
      ).toHaveBeenCalledWith({
        keyAlias: 'binding-user-key',
      });
      expect(
        mockNativeRNPingStorage.configureBindingUserKeyStorage,
      ).toHaveBeenCalledWith('binding-user-key-id');
      expect(instance).toEqual({
        id: 'binding-user-key-id',
        kind: 'binding_user_key_storage',
      });
    });

    it('configureBindingUserKeyStorage can be created with all config options', () => {
      const config = {
        android: {
          keyAlias: 'binding-user-key',
          fileName: 'binding-user-key.dat',
          strongBoxPreferred: true,
          cacheStrategy: CacheStrategy.CACHE,
        },
        ios: {
          account: 'com.example.binding.user.keys',
          encryptor: true,
          cacheable: false,
        },
      };

      mockNativeRNPingStorage.registerBindingUserKeyStorage.mockReturnValue(
        'binding-user-key-id',
      );
      mockNativeRNPingStorage.configureBindingUserKeyStorage.mockReturnValue({
        keyAlias: 'binding-user-key',
        fileName: 'binding-user-key.dat',
        strongBoxPreferred: true,
        cacheStrategy: 'cache',
        account: 'com.example.binding.user.keys',
        encryptor: true,
        cacheable: false,
      });

      expect(configureBindingUserKeyStorage(config)).toEqual({
        id: 'binding-user-key-id',
        kind: 'binding_user_key_storage',
        ...config,
      });
    });

    it('configureBindingUserKeyStorage validates config', () => {
      expect(() =>
        configureBindingUserKeyStorage(null as unknown as StorageConfig),
      ).toThrow(/Missing configuration/);
    });

    it('configureOathStorage returns an OathStorageHandle with kind oath_storage', () => {
      mockNativeRNPingStorage.registerOathStorage.mockReturnValue('oath-id');
      mockNativeRNPingStorage.configureOathStorage.mockReturnValue({});

      const handle = configureOathStorage({
        android: { fileName: 'oath.db' },
      });

      expect(mockNativeRNPingStorage.registerOathStorage).toHaveBeenCalledWith({
        fileName: 'oath.db',
      });
      expect(mockNativeRNPingStorage.configureOathStorage).toHaveBeenCalledWith(
        'oath-id',
      );
      expect(handle).toMatchObject({ id: 'oath-id', kind: 'oath_storage' });
    });

    it('configureOathStorage round-trips: registers then resolves the same id', () => {
      mockNativeRNPingStorage.registerOathStorage.mockReturnValue(
        'oath-round-trip-id',
      );
      mockNativeRNPingStorage.configureOathStorage.mockReturnValue({
        fileName: 'oath_tokens.db',
      });

      const handle = configureOathStorage({
        android: { fileName: 'oath_tokens.db' },
      });

      expect(mockNativeRNPingStorage.registerOathStorage).toHaveBeenCalledTimes(
        1,
      );
      expect(mockNativeRNPingStorage.configureOathStorage).toHaveBeenCalledWith(
        'oath-round-trip-id',
      );
      expect(handle.id).toBe('oath-round-trip-id');
      expect(handle.kind).toBe('oath_storage');
    });

    it('configureOathStorage validates config — throws argument_error on null', () => {
      expect(() =>
        configureOathStorage(null as unknown as StorageConfig),
      ).toThrow(/Missing configuration/);
    });

    it('configureOathStorage forwards loggerId from logger options', () => {
      const logger: LoggerInstance = {
        nativeHandle: { id: 'oath-logger-id' },
        changeLevel: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };
      mockNativeRNPingStorage.registerOathStorage.mockReturnValue('oath-id');
      mockNativeRNPingStorage.configureOathStorage.mockReturnValue({});

      configureOathStorage({ android: { fileName: 'oath.db' } }, { logger });

      expect(mockNativeRNPingStorage.registerOathStorage).toHaveBeenCalledWith({
        loggerId: 'oath-logger-id',
        fileName: 'oath.db',
      });
    });

    it('configureOathStorage forwards iosOath fields as oath-prefixed native keys', () => {
      mockNativeRNPingStorage.registerOathStorage.mockReturnValue('oath-id');
      mockNativeRNPingStorage.configureOathStorage.mockReturnValue({});

      configureOathStorage({
        android: { fileName: 'oath.db' },
        iosOath: {
          service: 'com.example.oath',
          requireBiometrics: true,
          requireDevicePasscode: false,
          biometricPrompt: 'Authenticate',
          accessGroup: 'com.example.shared',
        },
      });

      expect(mockNativeRNPingStorage.registerOathStorage).toHaveBeenCalledWith({
        fileName: 'oath.db',
        oathService: 'com.example.oath',
        oathRequireBiometrics: true,
        oathRequireDevicePasscode: false,
        oathBiometricPrompt: 'Authenticate',
        oathAccessGroup: 'com.example.shared',
      });
    });

    it('configureOathStorage does not interfere with configureBindingUserKeyStorage', () => {
      mockNativeRNPingStorage.registerOathStorage.mockReturnValue('oath-id');
      mockNativeRNPingStorage.configureOathStorage.mockReturnValue({});
      mockNativeRNPingStorage.registerBindingUserKeyStorage.mockReturnValue(
        'binding-id',
      );
      mockNativeRNPingStorage.configureBindingUserKeyStorage.mockReturnValue(
        {},
      );

      const oathHandle = configureOathStorage({ android: { fileName: 'db' } });
      const bindingHandle = configureBindingUserKeyStorage({
        android: { keyAlias: 'key' },
      });

      expect(oathHandle.kind).toBe('oath_storage');
      expect(bindingHandle.kind).toBe('binding_user_key_storage');
      expect(oathHandle.id).toBe('oath-id');
      expect(bindingHandle.id).toBe('binding-id');
    });

    it('configureBindingUserKeyStorage forwards loggerId from logger options', () => {
      const logger = {
        nativeHandle: { id: 'native-logger-id' },
        changeLevel: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };
      mockNativeRNPingStorage.registerBindingUserKeyStorage.mockReturnValue(
        'binding-user-key-id',
      );
      mockNativeRNPingStorage.configureBindingUserKeyStorage.mockReturnValue(
        {},
      );

      configureBindingUserKeyStorage(
        {
          android: { keyAlias: 'binding-user-key' },
        },
        { logger },
      );

      expect(
        mockNativeRNPingStorage.registerBindingUserKeyStorage,
      ).toHaveBeenCalledWith({
        loggerId: 'native-logger-id',
        keyAlias: 'binding-user-key',
      });
    });

    it('passes loggerId from logger options', () => {
      const logger = {
        nativeHandle: { id: 'native-logger-id' },
        changeLevel: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };
      mockNativeRNPingStorage.registerSessionStorage.mockReturnValue(
        'session-id',
      );
      mockNativeRNPingStorage.configureSessionStorage.mockReturnValue({});

      configureSessionStorage(
        {
          android: { keyAlias: 'session-key' },
        },
        { logger },
      );

      expect(
        mockNativeRNPingStorage.registerSessionStorage,
      ).toHaveBeenCalledWith({
        loggerId: 'native-logger-id',
        keyAlias: 'session-key',
      });
    });

    it('omits loggerId when options.logger has no native handle id', () => {
      const logger = {
        nativeHandle: {},
        changeLevel: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };
      mockNativeRNPingStorage.registerSessionStorage.mockReturnValue(
        'session-id',
      );
      mockNativeRNPingStorage.configureSessionStorage.mockReturnValue({});

      configureSessionStorage(
        {
          android: { keyAlias: 'session-key' },
        },
        { logger: logger as unknown as LoggerInstance },
      );

      expect(
        mockNativeRNPingStorage.registerSessionStorage,
      ).toHaveBeenCalledWith({
        keyAlias: 'session-key',
      });
    });

    it('logs debug and info during session storage configuration', () => {
      const logger = {
        nativeHandle: { id: 'native-logger-id' },
        changeLevel: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };
      mockNativeRNPingStorage.registerSessionStorage.mockReturnValue(
        'session-id',
      );
      mockNativeRNPingStorage.configureSessionStorage.mockReturnValue({});

      configureSessionStorage(
        {
          android: { keyAlias: 'session-key' },
        },
        { logger },
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Storage configureSessionStorage requested'),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Storage configureSessionStorage success',
      );
    });
  });
});
