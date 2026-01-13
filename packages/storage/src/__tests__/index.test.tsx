import { createSessionStorage, createOidcStorage } from "../index";

// Mock the Native Module
const mockNativeRNPingStorage = {
  configureSessionStorage: jest.fn(),
  configureOidcStorage: jest.fn(),
};

jest.mock("../NativeRNPingStorage", () => ({
  getNativeModule: () => mockNativeRNPingStorage,
}));

describe("Storage API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Factory functions", () => {
    it("createSessionStorage creates a storage instance", () => {
      const mockId = "session-id";
      mockNativeRNPingStorage.configureSessionStorage.mockReturnValue(mockId);

      const instance = createSessionStorage({ type: "encrypted" });

      expect(mockNativeRNPingStorage.configureSessionStorage).toHaveBeenCalledWith({
        type: "encrypted",
      });
      expect(instance.id).toBe(mockId);
    });

    it("createSessionStorage can be created with all config options", () => {
      const mockId = "session-id";
      mockNativeRNPingStorage.configureSessionStorage.mockReturnValue(mockId);

      const config = {
        type: "encrypted" as const,
        encrypted: true,
        keyAlias: "session-key",
        fileName: "session.dat",
      };

      createSessionStorage(config);

      expect(mockNativeRNPingStorage.configureSessionStorage).toHaveBeenCalledWith({
        ...config,
      });
    });

    it("createSessionStorage validates config", () => {
      expect(() => createSessionStorage({} as any)).toThrow(/Missing configuration/);
      expect(() => createSessionStorage({ type: "invalid" as any })).toThrow(
        /Invalid storage type/
      );
    });

    it("createOidcStorage creates a storage instance", () => {
      const mockId = "oidc-id";
      mockNativeRNPingStorage.configureOidcStorage.mockReturnValue(mockId);

      const instance = createOidcStorage({ type: "encrypted" });

      expect(mockNativeRNPingStorage.configureOidcStorage).toHaveBeenCalledWith({
        type: "encrypted",
      });
      expect(instance.id).toBe(mockId);
    });

    it("createOidcStorage can be created with all config options", () => {
      const mockId = "oidc-id";
      mockNativeRNPingStorage.configureOidcStorage.mockReturnValue(mockId);

      const config = {
        type: "encrypted" as const,
        encrypted: true,
        keyAlias: "oidc-key",
        fileName: "oidc.dat",
      };

      createOidcStorage(config);

      expect(mockNativeRNPingStorage.configureOidcStorage).toHaveBeenCalledWith({
        ...config,
      });
    });

    it("createOidcStorage validates config", () => {
      expect(() => createOidcStorage({} as any)).toThrow(/Missing configuration/);
      expect(() => createOidcStorage({ type: "invalid" as any })).toThrow(
        /Invalid storage type/
      );
    });
  });
});
