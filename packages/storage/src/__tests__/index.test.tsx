/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import type { LoggerInstance } from '@ping-identity/rn-types';
import {
  CacheStrategy,
  configureSessionStorage,
  configureOidcStorage,
} from '../index';
import type { StorageConfig } from '../index';

const mockLogger = {
  nativeHandle: { id: 'native-none-id' },
  changeLevel: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

jest.mock('@ping-identity/rn-logger', () => ({
  logger: jest.fn(() => mockLogger),
}));

// Mock the Native Module
const mockNativeRNPingStorage = {
  registerSessionStorage: jest.fn(),
  registerOidcStorage: jest.fn(),
  configureSessionStorage: jest.fn(),
  configureOidcStorage: jest.fn(),
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
    mockLogger.nativeHandle.id = 'native-none-id';
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
        loggerId: 'native-none-id',
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
        loggerId: 'native-none-id',
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

    it('falls back to default logger id when options.logger has no native handle id', () => {
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
        loggerId: 'native-none-id',
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
