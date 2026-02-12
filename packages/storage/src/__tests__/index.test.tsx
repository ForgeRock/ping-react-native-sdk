/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import {
  CacheStrategy,
  configureSessionStorage,
  configureOidcStorage,
} from "../index";
// Mock the Native Module
const mockNativeRNPingStorage = {
  registerSessionStorage: jest.fn(),
  registerOidcStorage: jest.fn(),
  configureSessionStorage: jest.fn(),
  configureOidcStorage: jest.fn(),
};

jest.mock("../NativeRNPingStorage", () => ({
  CacheStrategy: {
    CACHE_ON_FAILURE: "cache_on_failure",
    NO_CACHE: "no_cache",
    CACHE: "cache",
  },
  getNativeModule: () => mockNativeRNPingStorage,
}));

describe("Storage API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Factory functions", () => {
    it("configureSessionStorage returns the config", () => {
      mockNativeRNPingStorage.registerSessionStorage.mockReturnValue("session-id");
      mockNativeRNPingStorage.configureSessionStorage.mockReturnValue({});

      const instance = configureSessionStorage({
        android: {
          keyAlias: "session-key",
        },
      });

      expect(mockNativeRNPingStorage.registerSessionStorage).toHaveBeenCalledWith({
        keyAlias: "session-key",
      });
      expect(mockNativeRNPingStorage.configureSessionStorage).toHaveBeenCalledWith("session-id");
      expect(instance).toEqual({ id: "session-id" });
    });

    it("configureSessionStorage can be created with all config options", () => {
      const config = {
        android: {
          keyAlias: "session-key",
          fileName: "session.dat",
          strongBoxPreferred: true,
          cacheStrategy: CacheStrategy.CACHE_ON_FAILURE,
        },
        ios: {
          account: "com.example.session",
          encryptor: true,
          cacheable: true,
        },
      };

      mockNativeRNPingStorage.registerSessionStorage.mockReturnValue("session-id");
      mockNativeRNPingStorage.configureSessionStorage.mockReturnValue({
        keyAlias: "session-key",
        fileName: "session.dat",
        strongBoxPreferred: true,
        cacheStrategy: "cache_on_failure",
        account: "com.example.session",
        encryptor: true,
        cacheable: true,
      });

      expect(configureSessionStorage(config)).toEqual({
        id: "session-id",
        ...config,
      });
    });

    it("configureSessionStorage validates config", () => {
      expect(() => configureSessionStorage(null as any)).toThrow(/Missing configuration/);
    });

    it("configureOidcStorage returns the config", () => {
      mockNativeRNPingStorage.registerOidcStorage.mockReturnValue("oidc-id");
      mockNativeRNPingStorage.configureOidcStorage.mockReturnValue({});

      const instance = configureOidcStorage({
        android: {
          keyAlias: "oidc-key",
        },
      });

      expect(mockNativeRNPingStorage.registerOidcStorage).toHaveBeenCalledWith({
        keyAlias: "oidc-key",
      });
      expect(mockNativeRNPingStorage.configureOidcStorage).toHaveBeenCalledWith("oidc-id");
      expect(instance).toEqual({ id: "oidc-id" });
    });

    it("configureOidcStorage can be created with all config options", () => {
      const config = {
        android: {
          keyAlias: "oidc-key",
          fileName: "oidc.dat",
          strongBoxPreferred: false,
          cacheStrategy: CacheStrategy.NO_CACHE,
        },
        ios: {
          account: "com.example.oidc",
          encryptor: false,
          cacheable: false,
        },
      };

      mockNativeRNPingStorage.registerOidcStorage.mockReturnValue("oidc-id");
      mockNativeRNPingStorage.configureOidcStorage.mockReturnValue({
        keyAlias: "oidc-key",
        fileName: "oidc.dat",
        strongBoxPreferred: false,
        cacheStrategy: "no_cache",
        account: "com.example.oidc",
        encryptor: false,
        cacheable: false,
      });

      expect(configureOidcStorage(config)).toEqual({
        id: "oidc-id",
        ...config,
      });
    });

    it("configureOidcStorage validates config", () => {
      expect(() => configureOidcStorage(null as any)).toThrow(/Missing configuration/);
    });
  });
});
