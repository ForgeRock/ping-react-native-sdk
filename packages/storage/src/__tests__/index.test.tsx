import { CacheStrategy, configureSessionStorage, configureOidcStorage } from "../index";
// Mock the Native Module
const mockNativeRNPingStorage = {
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
    it("configureSessionStorage creates a storage instance", () => {
      const mockId = "session-id";
      mockNativeRNPingStorage.configureSessionStorage.mockReturnValue(mockId);

      const instance = configureSessionStorage({});

      expect(mockNativeRNPingStorage.configureSessionStorage).toHaveBeenCalledWith({
      });
      expect(instance.id).toBe(mockId);
    });

    it("configureSessionStorage can be created with all config options", () => {
      const mockId = "session-id";
      mockNativeRNPingStorage.configureSessionStorage.mockReturnValue(mockId);

      const config = {
        keyAlias: "session-key",
        fileName: "session.dat",
        strongBoxPreferred: true,
        cacheStrategy: CacheStrategy.CACHE_ON_FAILURE,
        ios: {
          account: "com.example.session",
          encryptor: true,
        },
      };

      configureSessionStorage(config);

      expect(mockNativeRNPingStorage.configureSessionStorage).toHaveBeenCalledWith({
        keyAlias: "session-key",
        fileName: "session.dat",
        strongBoxPreferred: true,
        cacheStrategy: CacheStrategy.CACHE_ON_FAILURE,
        account: "com.example.session",
        encryptor: true,
      });
    });

    it("configureSessionStorage validates config", () => {
      expect(() => configureSessionStorage(null as any)).toThrow(/Missing configuration/);
    });

    it("configureOidcStorage creates a storage instance", () => {
      const mockId = "oidc-id";
      mockNativeRNPingStorage.configureOidcStorage.mockReturnValue(mockId);

      const instance = configureOidcStorage({});

      expect(mockNativeRNPingStorage.configureOidcStorage).toHaveBeenCalledWith({
      });
      expect(instance.id).toBe(mockId);
    });

    it("configureOidcStorage can be created with all config options", () => {
      const mockId = "oidc-id";
      mockNativeRNPingStorage.configureOidcStorage.mockReturnValue(mockId);

      const config = {
        keyAlias: "oidc-key",
        fileName: "oidc.dat",
        strongBoxPreferred: false,
        cacheStrategy: CacheStrategy.NO_CACHE,
        ios: {
          account: "com.example.oidc",
          encryptor: false,
        },
      };

      configureOidcStorage(config);

      expect(mockNativeRNPingStorage.configureOidcStorage).toHaveBeenCalledWith({
        keyAlias: "oidc-key",
        fileName: "oidc.dat",
        strongBoxPreferred: false,
        cacheStrategy: CacheStrategy.NO_CACHE,
        account: "com.example.oidc",
        encryptor: false,
      });
    });

    it("configureOidcStorage validates config", () => {
      expect(() => configureOidcStorage(undefined as any)).toThrow(/Missing configuration/);
    });
  });
});
