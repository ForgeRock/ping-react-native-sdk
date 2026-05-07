/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

type NativeModuleMock = {
  create: jest.Mock;
  addCredentialFromUri: jest.Mock;
  getCredential: jest.Mock;
  getCredentials: jest.Mock;
  saveCredential: jest.Mock;
  deleteCredential: jest.Mock;
  generateCode: jest.Mock;
  generateCodeWithValidity: jest.Mock;
  close: jest.Mock;
};

const DEFAULT_CREDENTIAL = {
  id: 'cred-1',
  issuer: 'Issuer',
  accountName: 'user@example.com',
  type: 'TOTP' as const,
  digits: 6,
  period: 30,
  counter: 0,
  displayIssuer: 'Issuer',
  displayAccountName: 'user@example.com',
  isLocked: false,
  userId: null,
  resourceId: null,
  imageURL: null,
  backgroundColor: null,
  algorithm: 'SHA1' as const,
  createdAt: 1700000000000,
  policies: null,
  lockingPolicy: null,
};

const createNativeMock = (
  overrides: Partial<NativeModuleMock> = {},
): NativeModuleMock => ({
  create: jest.fn(async () => 'test-handle-uuid'),
  addCredentialFromUri: jest.fn(async () => ({ ...DEFAULT_CREDENTIAL })),
  getCredential: jest.fn(async () => ({ ...DEFAULT_CREDENTIAL })),
  getCredentials: jest.fn(async () => []),
  saveCredential: jest.fn(async () => ({ ...DEFAULT_CREDENTIAL })),
  deleteCredential: jest.fn(async () => true),
  generateCode: jest.fn(async () => '123456'),
  generateCodeWithValidity: jest.fn(async () => ({
    code: '123456',
    timeRemaining: 25,
    counter: -1,
    progress: 0.17,
    totalPeriod: 30,
  })),
  close: jest.fn(async () => undefined),
  ...overrides,
});

const createJsLogger = () => ({
  nativeHandle: { id: 'native-logger-id' },
  changeLevel: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
});

const loadModule = async (nativeModule: NativeModuleMock) => {
  jest.resetModules();
  jest.doMock('../NativeRNPingOath', () => ({
    getNativeModule: () => nativeModule,
  }));
  return import('../index');
};

describe('createOathClient', () => {
  it('calls native create with config on construction', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    const logger = createJsLogger();

    await createOathClient({ logger });

    expect(nativeModule.create).toHaveBeenCalledWith(expect.any(Object));
  });

  it('forwards loggerId from logger.nativeHandle.id to native create', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    const logger = createJsLogger();

    await createOathClient({ logger });

    expect(nativeModule.create).toHaveBeenCalledWith({
      loggerId: 'native-logger-id',
      timeout: undefined,
      enableCredentialCache: undefined,
      encryptionEnabled: undefined,
    });
  });

  it('omits loggerId when no logger is provided', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);

    await createOathClient();

    expect(nativeModule.create).toHaveBeenCalledWith({
      loggerId: undefined,
      timeout: undefined,
      enableCredentialCache: undefined,
      encryptionEnabled: undefined,
    });
  });

  it('omits loggerId when logger nativeHandle.id is empty (noopLogger)', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    const noop = {
      nativeHandle: { id: '' },
      changeLevel: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    await createOathClient({ logger: noop });

    expect(nativeModule.create).toHaveBeenCalledWith({
      loggerId: undefined,
      timeout: undefined,
      enableCredentialCache: undefined,
      encryptionEnabled: undefined,
    });
  });

  it('omits loggerId when logger nativeHandle.id is whitespace', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    const logger = {
      nativeHandle: { id: '   ' },
      changeLevel: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };

    await createOathClient({ logger });

    expect(nativeModule.create).toHaveBeenCalledWith({
      loggerId: undefined,
      timeout: undefined,
      enableCredentialCache: undefined,
      encryptionEnabled: undefined,
    });
  });

  it('returns a client object with all 8 methods', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);

    const client = await createOathClient();

    expect(typeof client.addCredentialFromUri).toBe('function');
    expect(typeof client.getCredential).toBe('function');
    expect(typeof client.getCredentials).toBe('function');
    expect(typeof client.saveCredential).toBe('function');
    expect(typeof client.deleteCredential).toBe('function');
    expect(typeof client.generateCode).toBe('function');
    expect(typeof client.generateCodeWithValidity).toBe('function');
    expect(typeof client.close).toBe('function');
  });

  it('propagates native create errors', async () => {
    const nativeModule = createNativeMock({
      create: jest.fn(async () => {
        throw new Error('init failed');
      }),
    });
    const { createOathClient } = await loadModule(nativeModule);

    await expect(createOathClient()).rejects.toThrow('init failed');
  });

  it('logs debug on entry and info on success', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    const logger = createJsLogger();

    await createOathClient({ logger });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('createOathClient'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('createOathClient'),
    );
  });

  it('logs error when native create fails', async () => {
    const nativeModule = createNativeMock({
      create: jest.fn(async () => {
        throw new Error('init failed');
      }),
    });
    const { createOathClient } = await loadModule(nativeModule);
    const logger = createJsLogger();

    await expect(createOathClient({ logger })).rejects.toThrow('init failed');

    expect(logger.error).toHaveBeenCalled();
  });
});

describe('addCredentialFromUri', () => {
  let nativeModule: NativeModuleMock;
  let client: Awaited<
    ReturnType<Awaited<ReturnType<typeof loadModule>>['createOathClient']>
  >;

  beforeEach(async () => {
    nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    client = await createOathClient();
  });

  it('forwards handle and uri to native', async () => {
    await client.addCredentialFromUri('otpauth://totp/...');

    expect(nativeModule.addCredentialFromUri).toHaveBeenCalledWith(
      'test-handle-uuid',
      'otpauth://totp/...',
    );
  });

  it('returns the credential from native', async () => {
    const result = await client.addCredentialFromUri('otpauth://totp/...');

    expect(result).toMatchObject({ id: 'cred-1' });
  });

  it('propagates errors from native', async () => {
    nativeModule.addCredentialFromUri.mockImplementation(async () => {
      throw new Error('bad uri');
    });

    await expect(
      client.addCredentialFromUri('otpauth://totp/...'),
    ).rejects.toThrow('bad uri');
  });
});

describe('getCredential', () => {
  let nativeModule: NativeModuleMock;
  let client: Awaited<
    ReturnType<Awaited<ReturnType<typeof loadModule>>['createOathClient']>
  >;

  beforeEach(async () => {
    nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    client = await createOathClient();
  });

  it('returns null when native returns null', async () => {
    nativeModule.getCredential.mockImplementation(async () => null);

    const result = await client.getCredential('cred-1');

    expect(result).toBeNull();
  });

  it('returns credential when found', async () => {
    const result = await client.getCredential('cred-1');

    expect(result).toMatchObject({ id: 'cred-1' });
  });

  it('forwards handle and credentialId to native', async () => {
    await client.getCredential('cred-1');

    expect(nativeModule.getCredential).toHaveBeenCalledWith(
      'test-handle-uuid',
      'cred-1',
    );
  });
});

describe('getCredentials', () => {
  let nativeModule: NativeModuleMock;
  let client: Awaited<
    ReturnType<Awaited<ReturnType<typeof loadModule>>['createOathClient']>
  >;

  beforeEach(async () => {
    nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    client = await createOathClient();
  });

  it('returns empty array when no credentials', async () => {
    const result = await client.getCredentials();

    expect(result).toEqual([]);
  });

  it('returns array of credentials', async () => {
    nativeModule.getCredentials.mockImplementation(async () => [
      { ...DEFAULT_CREDENTIAL },
      { ...DEFAULT_CREDENTIAL, id: 'cred-2' },
    ]);

    const result = await client.getCredentials();

    expect(result).toHaveLength(2);
  });
});

describe('generateCode', () => {
  let nativeModule: NativeModuleMock;
  let client: Awaited<
    ReturnType<Awaited<ReturnType<typeof loadModule>>['createOathClient']>
  >;

  beforeEach(async () => {
    nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    client = await createOathClient();
  });

  it('forwards handle and credentialId', async () => {
    await client.generateCode('cred-1');

    expect(nativeModule.generateCode).toHaveBeenCalledWith(
      'test-handle-uuid',
      'cred-1',
    );
  });

  it('returns the OTP string', async () => {
    const result = await client.generateCode('cred-1');

    expect(result).toBe('123456');
  });
});

describe('generateCodeWithValidity', () => {
  let nativeModule: NativeModuleMock;
  let client: Awaited<
    ReturnType<Awaited<ReturnType<typeof loadModule>>['createOathClient']>
  >;

  beforeEach(async () => {
    nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    client = await createOathClient();
  });

  it('returns all 5 fields: code, timeRemaining, counter, progress, totalPeriod', async () => {
    const info = await client.generateCodeWithValidity('cred-1');

    expect(info.code).toBe('123456');
    expect(info.timeRemaining).toBe(25);
    expect(info.counter).toBe(-1);
    expect(info.progress).toBe(0.17);
    expect(info.totalPeriod).toBe(30);
  });
});

describe('deleteCredential', () => {
  let nativeModule: NativeModuleMock;
  let client: Awaited<
    ReturnType<Awaited<ReturnType<typeof loadModule>>['createOathClient']>
  >;

  beforeEach(async () => {
    nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    client = await createOathClient();
  });

  it('returns true on success', async () => {
    const result = await client.deleteCredential('cred-1');

    expect(result).toBe(true);
  });

  it('forwards handle and credentialId to native', async () => {
    await client.deleteCredential('cred-1');

    expect(nativeModule.deleteCredential).toHaveBeenCalledWith(
      'test-handle-uuid',
      'cred-1',
    );
  });
});

describe('saveCredential', () => {
  let nativeModule: NativeModuleMock;
  let client: Awaited<
    ReturnType<Awaited<ReturnType<typeof loadModule>>['createOathClient']>
  >;

  beforeEach(async () => {
    nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    client = await createOathClient();
  });

  it('forwards credential object to native', async () => {
    const credential = {
      id: 'cred-1',
      issuer: 'Issuer',
      accountName: 'user',
      type: 'TOTP' as const,
      digits: 6,
      period: 30,
      counter: 0,
      displayIssuer: 'Issuer',
      displayAccountName: 'user',
      isLocked: false,
      userId: null,
      resourceId: null,
      imageURL: null,
      backgroundColor: null,
      algorithm: 'SHA1' as const,
      createdAt: 1700000000000,
      policies: null,
      lockingPolicy: null,
    };

    await client.saveCredential(credential);

    expect(nativeModule.saveCredential).toHaveBeenCalledWith(
      'test-handle-uuid',
      expect.objectContaining({ id: 'cred-1' }),
    );
  });
});

describe('close', () => {
  let nativeModule: NativeModuleMock;
  let client: Awaited<
    ReturnType<Awaited<ReturnType<typeof loadModule>>['createOathClient']>
  >;

  beforeEach(async () => {
    nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    client = await createOathClient();
  });

  it('calls native close with the handle', async () => {
    await client.close();

    expect(nativeModule.close).toHaveBeenCalledWith('test-handle-uuid');
  });

  it('subsequent method calls throw OATH_STATE_ERROR after close', async () => {
    await client.close();

    await expect(client.generateCode('cred-1')).rejects.toMatchObject({
      type: 'state_error',
      error: 'OATH_STATE_ERROR',
    });
  });

  it('calling close twice throws on the second call', async () => {
    await client.close();

    await expect(client.close()).rejects.toMatchObject({
      error: 'OATH_STATE_ERROR',
    });
  });
});

describe('createOathClient — config wiring', () => {
  it('forwards timeout to native create', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);

    await createOathClient({ timeout: 30 });

    expect(nativeModule.create).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 30 }),
    );
  });

  it('omits timeout when not provided', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);

    await createOathClient();

    expect(nativeModule.create).toHaveBeenCalledWith({
      loggerId: undefined,
      timeout: undefined,
      enableCredentialCache: undefined,
      encryptionEnabled: undefined,
    });
  });

  it('rejects negative timeout with argument_error', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);

    await expect(createOathClient({ timeout: -1 })).rejects.toMatchObject({
      type: 'argument_error',
      error: 'OATH_INVALID_PARAMETER',
    });
    expect(nativeModule.create).not.toHaveBeenCalled();
  });

  it('forwards enableCredentialCache=true to native create', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);

    await createOathClient({ enableCredentialCache: true });

    expect(nativeModule.create).toHaveBeenCalledWith(
      expect.objectContaining({ enableCredentialCache: true }),
    );
  });

  it('forwards enableCredentialCache=false to native create', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);

    await createOathClient({ enableCredentialCache: false });

    expect(nativeModule.create).toHaveBeenCalledWith(
      expect.objectContaining({ enableCredentialCache: false }),
    );
  });

  it('omits enableCredentialCache when not provided', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);

    await createOathClient();

    expect(nativeModule.create).toHaveBeenCalledWith(
      expect.objectContaining({ enableCredentialCache: undefined }),
    );
  });

  it('forwards encryptionEnabled=true to native create on iOS', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    const nativeModule = createNativeMock();
    jest.doMock('../NativeRNPingOath', () => ({
      getNativeModule: () => nativeModule,
    }));
    const { createOathClient: createOathClientIos } = await import('../index');

    await createOathClientIos({ encryptionEnabled: true });

    expect(nativeModule.create).toHaveBeenCalledWith(
      expect.objectContaining({ encryptionEnabled: true }),
    );
  });

  it('drops encryptionEnabled on Android', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
    const nativeModule = createNativeMock();
    jest.doMock('../NativeRNPingOath', () => ({
      getNativeModule: () => nativeModule,
    }));
    const { createOathClient: createOathClientAndroid } =
      await import('../index');

    await createOathClientAndroid({ encryptionEnabled: true });

    expect(nativeModule.create).toHaveBeenCalledWith(
      expect.objectContaining({ encryptionEnabled: undefined }),
    );
  });

  it('omits encryptionEnabled when not provided', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);

    await createOathClient();

    expect(nativeModule.create).toHaveBeenCalledWith(
      expect.objectContaining({ encryptionEnabled: undefined }),
    );
  });

  it('combined-fields exact-keys — no extra keys, all values correct (iOS)', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    const nativeModule = createNativeMock();
    jest.doMock('../NativeRNPingOath', () => ({
      getNativeModule: () => nativeModule,
    }));
    const { createOathClient: createCombined } = await import('../index');
    const logger = createJsLogger();

    await createCombined({
      logger,
      timeout: 5,
      enableCredentialCache: true,
      encryptionEnabled: false,
    });

    expect(nativeModule.create).toHaveBeenCalledTimes(1);
    const callArg = nativeModule.create.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(Object.keys(callArg).sort()).toEqual([
      'enableCredentialCache',
      'encryptionEnabled',
      'loggerId',
      'timeout',
    ]);
    expect(callArg.loggerId).toBe('native-logger-id');
    expect(callArg.timeout).toBe(5);
    expect(callArg.enableCredentialCache).toBe(true);
    expect(callArg.encryptionEnabled).toBe(false);
  });
});

describe('createOathClient — storage handle wiring', () => {
  it('passes storageId to native create when storage handle is provided', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    const handle = {
      id: 'oath-storage-handle-id',
      kind: 'oath_storage' as const,
    };

    await createOathClient({
      storage: handle as Parameters<typeof createOathClient>[0]['storage'],
    });

    const callArg = nativeModule.create.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(callArg.storageId).toBe('oath-storage-handle-id');
  });

  it('omits storageId from native create when storage is not provided', async () => {
    const nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);

    await createOathClient();

    const callArg = nativeModule.create.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(Object.keys(callArg)).not.toContain('storageId');
  });

  it('exact keys test — all fields combined', async () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    const nativeModule = createNativeMock();
    jest.doMock('../NativeRNPingOath', () => ({
      getNativeModule: () => nativeModule,
    }));
    const { createOathClient: createWithStorage } = await import('../index');
    const handle = { id: 'storage-123', kind: 'oath_storage' as const };

    await createWithStorage({
      storage: handle as Parameters<typeof createWithStorage>[0]['storage'],
      timeout: 10,
      enableCredentialCache: true,
      encryptionEnabled: false,
    });

    expect(nativeModule.create).toHaveBeenCalledTimes(1);
    const callArg = nativeModule.create.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(Object.keys(callArg).sort()).toEqual([
      'enableCredentialCache',
      'encryptionEnabled',
      'loggerId',
      'storageId',
      'timeout',
    ]);
  });
});

describe('logger', () => {
  let nativeModule: NativeModuleMock;
  let client: Awaited<
    ReturnType<Awaited<ReturnType<typeof loadModule>>['createOathClient']>
  >;
  let logger: ReturnType<typeof createJsLogger>;

  beforeEach(async () => {
    nativeModule = createNativeMock();
    const { createOathClient } = await loadModule(nativeModule);
    logger = createJsLogger();
    client = await createOathClient({ logger });
  });

  it('logs debug on entry and info on success for generateCode', async () => {
    await client.generateCode('cred-1');

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('generateCode'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('generateCode'),
    );
  });

  it('logs error when generateCode fails', async () => {
    nativeModule.generateCode.mockImplementation(async () => {
      throw new Error('code gen failed');
    });

    await expect(client.generateCode('cred-1')).rejects.toThrow(
      'code gen failed',
    );

    expect(logger.error).toHaveBeenCalled();
  });

  it('logs debug on entry and info on success for saveCredential', async () => {
    await client.saveCredential({ ...DEFAULT_CREDENTIAL });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('saveCredential'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('saveCredential'),
    );
  });

  it('logs error when saveCredential fails', async () => {
    nativeModule.saveCredential.mockImplementation(async () => {
      throw new Error('save failed');
    });

    await expect(
      client.saveCredential({ ...DEFAULT_CREDENTIAL }),
    ).rejects.toThrow('save failed');

    expect(logger.error).toHaveBeenCalled();
  });

  it('logs debug on entry and info on success for addCredentialFromUri', async () => {
    await client.addCredentialFromUri('otpauth://totp/...');

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('addCredentialFromUri'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('addCredentialFromUri'),
    );
  });

  it('logs error when addCredentialFromUri fails', async () => {
    nativeModule.addCredentialFromUri.mockImplementation(async () => {
      throw new Error('bad uri');
    });

    await expect(
      client.addCredentialFromUri('otpauth://totp/...'),
    ).rejects.toThrow('bad uri');

    expect(logger.error).toHaveBeenCalled();
  });

  it('logs debug on entry and info on success for getCredential', async () => {
    await client.getCredential('cred-1');

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('getCredential'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('getCredential'),
    );
  });

  it('logs error when getCredential fails', async () => {
    nativeModule.getCredential.mockImplementation(async () => {
      throw new Error('not found');
    });

    await expect(client.getCredential('cred-1')).rejects.toThrow('not found');

    expect(logger.error).toHaveBeenCalled();
  });

  it('logs debug on entry and info on success for getCredentials', async () => {
    await client.getCredentials();

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('getCredentials'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('getCredentials'),
    );
  });

  it('logs error when getCredentials fails', async () => {
    nativeModule.getCredentials.mockImplementation(async () => {
      throw new Error('storage error');
    });

    await expect(client.getCredentials()).rejects.toThrow('storage error');

    expect(logger.error).toHaveBeenCalled();
  });

  it('logs debug on entry and info on success for deleteCredential', async () => {
    await client.deleteCredential('cred-1');

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('deleteCredential'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('deleteCredential'),
    );
  });

  it('logs error when deleteCredential fails', async () => {
    nativeModule.deleteCredential.mockImplementation(async () => {
      throw new Error('delete failed');
    });

    await expect(client.deleteCredential('cred-1')).rejects.toThrow(
      'delete failed',
    );

    expect(logger.error).toHaveBeenCalled();
  });

  it('logs debug on entry and info on success for generateCodeWithValidity', async () => {
    await client.generateCodeWithValidity('cred-1');

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('generateCodeWithValidity'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('generateCodeWithValidity'),
    );
  });

  it('logs error when generateCodeWithValidity fails', async () => {
    nativeModule.generateCodeWithValidity.mockImplementation(async () => {
      throw new Error('validity gen failed');
    });

    await expect(client.generateCodeWithValidity('cred-1')).rejects.toThrow(
      'validity gen failed',
    );

    expect(logger.error).toHaveBeenCalled();
  });
});
