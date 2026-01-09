import { storage, createSessionStorage, createOidcStorage } from '../index';
import type { StorageInstance } from '../index';

// Mock the Native Module
const mockNativeRNPingStorage = {
  configure: jest.fn(),
  save: jest.fn(),
  getItem: jest.fn(),
  deleteItem: jest.fn(),
};

jest.mock('../NativeRNPingStorage', () => ({
  getNativeModule: () => mockNativeRNPingStorage,
}));

describe('Storage API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('storage()', () => {
    it('throws error if config is undefined', () => {
      expect(() => storage(undefined as any)).toThrow(/Missing configuration/);
    });

    it('throws error if config.type is missing', () => {
      expect(() => storage({} as any)).toThrow(/Missing configuration/);
    });

    it('throws error if native configure fails (returns null/undefined)', () => {
      mockNativeRNPingStorage.configure.mockReturnValue(null);
      expect(() => storage({ type: 'encrypted' })).toThrow(
        /Failed to configure native storage/
      );
    });

    it('successfully creates a storage instance', () => {
      const mockId = 'mock-storage-id';
      mockNativeRNPingStorage.configure.mockReturnValue(mockId);

      const instance = storage({ type: 'encrypted' });

      expect(mockNativeRNPingStorage.configure).toHaveBeenCalledWith({
        type: 'encrypted',
      });
      expect(instance.id).toBe(mockId);
      expect(instance.save).toBeDefined();
      expect(instance.getItem).toBeDefined();
      expect(instance.deleteItem).toBeDefined();
    });

    it('supports all storage types', () => {
      const storageTypes = ['memory', 'encrypted', 'datastore'] as const;
      
      storageTypes.forEach((type) => {
        const mockId = `${type}-id`;
        mockNativeRNPingStorage.configure.mockReturnValue(mockId);
        
        const instance = storage({ type });
        
        expect(mockNativeRNPingStorage.configure).toHaveBeenCalledWith({ type });
        expect(instance.id).toBe(mockId);
      });
    });

    it('passes all configuration options to native module', () => {
      const mockId = 'config-test-id';
      mockNativeRNPingStorage.configure.mockReturnValue(mockId);

      const config = {
        type: 'encrypted' as const,
        keyAlias: 'custom-key',
        fileName: 'custom-file.dat',
        strongBoxPreferred: true,
        cacheStrategy: 'cache' as const,
        enforceAsymmetricKey: true,
      };

      storage(config);

      expect(mockNativeRNPingStorage.configure).toHaveBeenCalledWith(config);
    });

    it('throws error if native configure throws exception', () => {
      const error = new Error('Native configuration failed');
      mockNativeRNPingStorage.configure.mockImplementation(() => {
        throw error;
      });

      expect(() => storage({ type: 'encrypted' })).toThrow('Native configuration failed');
    });

    it('throws error for invalid storage type', () => {
      expect(() => storage({ type: 'invalid' as any })).toThrow(/Invalid storage type/);
    });

    it('throws error if registration fails', () => {
      const error = new Error('Registry registration failed');
      mockNativeRNPingStorage.configure.mockImplementation(() => {
        throw error;
      });

      expect(() => storage({ type: 'encrypted' })).toThrow('Registry registration failed');
    });
  });

  describe('StorageInstance methods', () => {
    const mockId = 'test-id';
    let instance: StorageInstance<{ foo: string }>;

    beforeEach(() => {
      mockNativeRNPingStorage.configure.mockReturnValue(mockId);
      instance = storage({ type: 'encrypted' });
    });

    it('save() calls native save', async () => {
      mockNativeRNPingStorage.save.mockResolvedValue(true);
      const data = { foo: 'bar' };

      const result = await instance.save(data);

      expect(mockNativeRNPingStorage.save).toHaveBeenCalledWith(mockId, data);
      expect(result).toBe(true);
    });

    it('save() handles rejection from native module', async () => {
      const error = new Error('Native save failed');
      mockNativeRNPingStorage.save.mockRejectedValue(error);
      const data = { foo: 'bar' };

      await expect(instance.save(data)).rejects.toThrow('Native save failed');
    });

    it('getItem() calls native getItem and returns value', async () => {
      const data = { foo: 'bar' };
      mockNativeRNPingStorage.getItem.mockResolvedValue(data);

      const result = await instance.getItem();

      expect(mockNativeRNPingStorage.getItem).toHaveBeenCalledWith(mockId);
      expect(result).toEqual(data);
    });

    it('getItem() returns null if native returns null', async () => {
      mockNativeRNPingStorage.getItem.mockResolvedValue(null);

      const result = await instance.getItem();

      expect(mockNativeRNPingStorage.getItem).toHaveBeenCalledWith(mockId);
      expect(result).toBeNull();
    });

    it('getItem() handles rejection from native module', async () => {
      const error = new Error('Native getItem failed');
      mockNativeRNPingStorage.getItem.mockRejectedValue(error);

      await expect(instance.getItem()).rejects.toThrow('Native getItem failed');
    });

    it('delete() calls native delete', async () => {
      mockNativeRNPingStorage.deleteItem.mockResolvedValue(true);

      const result = await instance.deleteItem();

      expect(mockNativeRNPingStorage.deleteItem).toHaveBeenCalledWith(mockId);
      expect(result).toBe(true);
    });

    it('delete() handles rejection from native module', async () => {
      const error = new Error('Native delete failed');
      mockNativeRNPingStorage.deleteItem.mockRejectedValue(error);

      await expect(instance.deleteItem()).rejects.toThrow('Native delete failed');
    });

    it('handles saving empty objects', async () => {
      mockNativeRNPingStorage.save.mockResolvedValue(true);
      const emptyData = {};

      const result = await instance.save(emptyData as any);

      expect(mockNativeRNPingStorage.save).toHaveBeenCalledWith(mockId, emptyData);
      expect(result).toBe(true);
    });

    it('getItem handles primitive string values', async () => {
      mockNativeRNPingStorage.getItem.mockResolvedValue({ value: 'string' });

      const result = await instance.getItem();

      expect(result).toEqual({ value: 'string' });
    });

    it('getItem handles primitive number values', async () => {
      mockNativeRNPingStorage.getItem.mockResolvedValue({ count: '42' });

      const result = await instance.getItem();

      expect(result).toEqual({ count: '42' });
    });

    it('getItem handles primitive boolean values', async () => {
      mockNativeRNPingStorage.getItem.mockResolvedValue({ enabled: 'true' });

      const result = await instance.getItem();

      expect(result).toEqual({ enabled: 'true' });
    });

    it('getItem handles mixed primitive types', async () => {
      const mixedData = {
        str: 'value',
        num: '42',
        bool: 'true',
        nullVal: 'null',
      };
      mockNativeRNPingStorage.getItem.mockResolvedValue(mixedData);

      const result = await instance.getItem();

      expect(result).toEqual(mixedData);
    });

    it('getItem handles nested objects', async () => {
      const nestedData = {
        outer: JSON.stringify({ inner: { value: '123' } }),
      };
      mockNativeRNPingStorage.getItem.mockResolvedValue(nestedData);

      const result = await instance.getItem();

      expect(result).toEqual(nestedData);
    });

    it('getItem handles array-like string values', async () => {
      const arrayData = {
        items: '[1,2,3]',
      };
      mockNativeRNPingStorage.getItem.mockResolvedValue(arrayData);

      const result = await instance.getItem();

      expect(result).toEqual(arrayData);
    });
  });

  describe('Multiple storage instances', () => {
    it('creates multiple independent storage instances', () => {
      const id1 = 'instance-1';
      const id2 = 'instance-2';

      mockNativeRNPingStorage.configure.mockReturnValueOnce(id1);
      const instance1 = storage({ type: 'encrypted' });

      mockNativeRNPingStorage.configure.mockReturnValueOnce(id2);
      const instance2 = storage({ type: 'memory' });

      expect(instance1.id).toBe(id1);
      expect(instance2.id).toBe(id2);
      expect(instance1.id).not.toBe(instance2.id);
    });

    it('operations on one instance do not affect another', async () => {
      const id1 = 'instance-1';
      const id2 = 'instance-2';

      mockNativeRNPingStorage.configure.mockReturnValueOnce(id1);
      const instance1 = storage({ type: 'encrypted' });

      mockNativeRNPingStorage.configure.mockReturnValueOnce(id2);
      const instance2 = storage({ type: 'memory' });

      mockNativeRNPingStorage.save.mockResolvedValue(true);
      
      await instance1.save({ data: 'instance1' });
      expect(mockNativeRNPingStorage.save).toHaveBeenCalledWith(id1, { data: 'instance1' });

      await instance2.save({ data: 'instance2' });
      expect(mockNativeRNPingStorage.save).toHaveBeenCalledWith(id2, { data: 'instance2' });
    });
  });

  describe('Factory functions', () => {
    it('createSessionStorage creates a storage instance', () => {
      const mockId = 'session-id';
      mockNativeRNPingStorage.configure.mockReturnValue(mockId);

      const instance = createSessionStorage({ type: 'encrypted' });

      expect(mockNativeRNPingStorage.configure).toHaveBeenCalledWith({
        type: 'encrypted',
      });
      expect(typeof instance.set).toBe('function');
      expect(typeof instance.getSSOToken).toBe('function');
      expect(typeof instance.deleteSSOToken).toBe('function');
    });

    it('createSessionStorage can be created with all config options', () => {
      const mockId = 'session-id';
      mockNativeRNPingStorage.configure.mockReturnValue(mockId);

      const config = {
        type: 'encrypted' as const,
        encrypted: true,
        keyAlias: 'session-key',
        fileName: 'session.dat',
      };

      const instance = createSessionStorage(config);

      expect(mockNativeRNPingStorage.configure).toHaveBeenCalledWith(config);
      expect(typeof instance.set).toBe('function');
      expect(typeof instance.getSSOToken).toBe('function');
      expect(typeof instance.deleteSSOToken).toBe('function');
    });

    it('createOidcStorage creates a storage instance', () => {
      const mockId = 'oidc-id';
      mockNativeRNPingStorage.configure.mockReturnValue(mockId);

      const instance = createOidcStorage({ type: 'encrypted' });

      expect(mockNativeRNPingStorage.configure).toHaveBeenCalledWith({
        type: 'encrypted',
      });
      expect(typeof instance.set).toBe('function');
      expect(typeof instance.getTokens).toBe('function');
      expect(typeof instance.deleteTokens).toBe('function');
    });

    it('createOidcStorage can be created with all config options', () => {
      const mockId = 'oidc-id';
      mockNativeRNPingStorage.configure.mockReturnValue(mockId);

      const config = {
        type: 'encrypted' as const,
        encrypted: true,
        keyAlias: 'oidc-key',
        fileName: 'oidc.dat',
      };

      const instance = createOidcStorage(config);

      expect(mockNativeRNPingStorage.configure).toHaveBeenCalledWith(config);
      expect(typeof instance.set).toBe('function');
      expect(typeof instance.getTokens).toBe('function');
      expect(typeof instance.deleteTokens).toBe('function');
    });
  });

  describe('Type safety with generics', () => {
    interface User {
      id: number;
      name: string;
    }

    it('respects generic types for save and retrieve operations', async () => {
      const mockId = 'typed-storage';
      mockNativeRNPingStorage.configure.mockReturnValue(mockId);

      const instance = storage<User>({ type: 'encrypted' });
      
      const user: User = { id: 1, name: 'Test User' };
      mockNativeRNPingStorage.save.mockResolvedValue(true);
      mockNativeRNPingStorage.getItem.mockResolvedValue(user);

      await instance.save(user);
      const retrieved = await instance.getItem();

      expect(retrieved).toEqual(user);
    });
  });

  describe('Cache strategies', () => {
    it('supports NO_CACHE strategy', () => {
      const mockId = 'no-cache-id';
      mockNativeRNPingStorage.configure.mockReturnValue(mockId);

      storage({ type: 'encrypted', cacheStrategy: 'no_cache' });

      expect(mockNativeRNPingStorage.configure).toHaveBeenCalledWith({
        type: 'encrypted',
        cacheStrategy: 'no_cache',
      });
    });

    it('supports CACHE strategy', () => {
      const mockId = 'cache-id';
      mockNativeRNPingStorage.configure.mockReturnValue(mockId);

      storage({ type: 'encrypted', cacheStrategy: 'cache' });

      expect(mockNativeRNPingStorage.configure).toHaveBeenCalledWith({
        type: 'encrypted',
        cacheStrategy: 'cache',
      });
    });

    it('supports CACHE_ON_FAILURE strategy', () => {
      const mockId = 'cache-on-failure-id';
      mockNativeRNPingStorage.configure.mockReturnValue(mockId);

      storage({ type: 'encrypted', cacheStrategy: 'cache_on_failure' });

      expect(mockNativeRNPingStorage.configure).toHaveBeenCalledWith({
        type: 'encrypted',
        cacheStrategy: 'cache_on_failure',
      });
    });
  });
});
