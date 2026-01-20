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
  registerSessionStorage,
  registerOidcStorage,
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
      mockNativeRNPingStorage.configureSessionStorage.mockReturnValue({});

      const instance = configureSessionStorage("session-id");

      expect(mockNativeRNPingStorage.configureSessionStorage).toHaveBeenCalledWith("session-id");
      expect(instance).toEqual({});
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

      mockNativeRNPingStorage.configureSessionStorage.mockReturnValue({
        keyAlias: "session-key",
        fileName: "session.dat",
        strongBoxPreferred: true,
        cacheStrategy: "cache_on_failure",
        account: "com.example.session",
        encryptor: true,
        cacheable: true,
      });

      expect(configureSessionStorage("session-id")).toEqual(config);
    });

    it("configureSessionStorage validates config", () => {
      expect(() => configureSessionStorage("" as any)).toThrow(/Missing storage id/);
    });

    it("configureOidcStorage returns the config", () => {
      mockNativeRNPingStorage.configureOidcStorage.mockReturnValue({});

      const instance = configureOidcStorage("oidc-id");

      expect(mockNativeRNPingStorage.configureOidcStorage).toHaveBeenCalledWith("oidc-id");
      expect(instance).toEqual({});
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

      mockNativeRNPingStorage.configureOidcStorage.mockReturnValue({
        keyAlias: "oidc-key",
        fileName: "oidc.dat",
        strongBoxPreferred: false,
        cacheStrategy: "no_cache",
        account: "com.example.oidc",
        encryptor: false,
        cacheable: false,
      });

      expect(configureOidcStorage("oidc-id")).toEqual(config);
    });

    it("configureOidcStorage validates config", () => {
      expect(() => configureOidcStorage("" as any)).toThrow(/Missing storage id/);
    });

    it("registerSessionStorage returns the id", () => {
      mockNativeRNPingStorage.registerSessionStorage.mockReturnValue("session-id");

      const id = registerSessionStorage({});

      expect(mockNativeRNPingStorage.registerSessionStorage).toHaveBeenCalledWith({
      });
      expect(id).toBe("session-id");
    });

    it("registerOidcStorage returns the id", () => {
      mockNativeRNPingStorage.registerOidcStorage.mockReturnValue("oidc-id");

      const id = registerOidcStorage({});

      expect(mockNativeRNPingStorage.registerOidcStorage).toHaveBeenCalledWith({
      });
      expect(id).toBe("oidc-id");
    });
  });
});
