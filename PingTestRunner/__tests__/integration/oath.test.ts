/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-oath
 *
 * Validates that the oath package:
 * - Exports createOathClient as a function
 * - Returned client exposes all eight operation methods
 * - close() prevents subsequent calls with a state_error
 * - Logger flows through when provided
 */

export {};

type NativeOathMock = {
  create: jest.Mock;
  addCredentialFromUri: jest.Mock;
  getCredential: jest.Mock;
  getCredentials: jest.Mock;
  saveCredential: jest.Mock;
  deleteCredential: jest.Mock;
  generateCode: jest.Mock;
  generateCodeWithValidity: jest.Mock;
  close: jest.Mock;
  registerOathPolicyEvaluator: jest.Mock;
};

const DEFAULT_CREDENTIAL = {
  id: 'cred-1',
  issuer: 'Acme',
  displayIssuer: 'Acme',
  accountName: 'user@acme.com',
  displayAccountName: 'user@acme.com',
  type: 'TOTP',
  userId: null,
  resourceId: null,
  digits: 6,
  period: 30,
  counter: 0,
  imageURL: null,
  backgroundColor: null,
  isLocked: false,
  algorithm: 'SHA1',
  createdAt: 1700000000000,
  policies: null,
  lockingPolicy: null,
};

function makeMock(overrides: Partial<NativeOathMock> = {}): NativeOathMock {
  return {
    create: jest.fn(async () => 'handle-abc'),
    addCredentialFromUri: jest.fn(async () => DEFAULT_CREDENTIAL),
    getCredential: jest.fn(async () => DEFAULT_CREDENTIAL),
    getCredentials: jest.fn(async () => [DEFAULT_CREDENTIAL]),
    saveCredential: jest.fn(async () => DEFAULT_CREDENTIAL),
    deleteCredential: jest.fn(async () => true),
    generateCode: jest.fn(async () => '123456'),
    generateCodeWithValidity: jest.fn(async () => ({
      code: '123456',
      timeRemaining: 15,
      counter: 0,
      progress: 0.5,
      totalPeriod: 30,
    })),
    close: jest.fn(async () => undefined),
    registerOathPolicyEvaluator: jest.fn(() => 'evaluator-id-1'),
    ...overrides,
  };
}

function loadOath(nativeMock: NativeOathMock) {
  jest.resetModules();
  jest.doMock('../../../packages/oath/src/NativeRNPingOath', () => ({
    __esModule: true,
    getNativeModule: jest.fn(() => nativeMock),
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@ping-identity/rn-oath');
}

describe('@ping-identity/rn-oath — integration', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('exports', () => {
    it('exports createOathClient as a function', () => {
      const mod = loadOath(makeMock());
      expect(typeof mod.createOathClient).toBe('function');
    });

    it('returned client exposes all eight operation methods', async () => {
      const native = makeMock();
      const mod = loadOath(native);
      const client = await mod.createOathClient({});
      for (const method of [
        'addCredentialFromUri',
        'getCredential',
        'getCredentials',
        'saveCredential',
        'deleteCredential',
        'generateCode',
        'generateCodeWithValidity',
        'close',
      ]) {
        expect(typeof client[method]).toBe('function');
      }
    });
  });

  describe('native delegation', () => {
    it('calls native.create once during createOathClient', async () => {
      const native = makeMock();
      const mod = loadOath(native);
      await mod.createOathClient({});
      expect(native.create).toHaveBeenCalledTimes(1);
    });

    it('forwards handle and uri to native.addCredentialFromUri', async () => {
      const native = makeMock();
      const mod = loadOath(native);
      const client = await mod.createOathClient({});
      const uri = 'otpauth://totp/Acme:user@acme.com?secret=JBSWY3DPEHPK3PXP';
      const result = await client.addCredentialFromUri(uri);
      expect(native.addCredentialFromUri).toHaveBeenCalledWith(
        'handle-abc',
        uri,
      );
      expect(result).toEqual(DEFAULT_CREDENTIAL);
    });

    it('forwards handle and credentialId to native.getCredential', async () => {
      const native = makeMock();
      const mod = loadOath(native);
      const client = await mod.createOathClient({});
      await client.getCredential('cred-1');
      expect(native.getCredential).toHaveBeenCalledWith('handle-abc', 'cred-1');
    });

    it('forwards handle to native.getCredentials', async () => {
      const native = makeMock();
      const mod = loadOath(native);
      const client = await mod.createOathClient({});
      const results = await client.getCredentials();
      expect(native.getCredentials).toHaveBeenCalledWith('handle-abc');
      expect(results).toEqual([DEFAULT_CREDENTIAL]);
    });

    it('forwards handle and credentialId to native.generateCode', async () => {
      const native = makeMock();
      const mod = loadOath(native);
      const client = await mod.createOathClient({});
      const code = await client.generateCode('cred-1');
      expect(native.generateCode).toHaveBeenCalledWith('handle-abc', 'cred-1');
      expect(code).toBe('123456');
    });

    it('generateCodeWithValidity returns all five fields', async () => {
      const native = makeMock();
      const mod = loadOath(native);
      const client = await mod.createOathClient({});
      const info = await client.generateCodeWithValidity('cred-1');
      expect(info).toMatchObject({
        code: '123456',
        timeRemaining: 15,
        counter: 0,
        progress: 0.5,
        totalPeriod: 30,
      });
    });

    it('forwards handle and credential to native.saveCredential', async () => {
      const native = makeMock();
      const mod = loadOath(native);
      const client = await mod.createOathClient({});
      const result = await client.saveCredential(DEFAULT_CREDENTIAL);
      expect(native.saveCredential).toHaveBeenCalledWith(
        'handle-abc',
        DEFAULT_CREDENTIAL,
      );
      expect(result).toEqual(DEFAULT_CREDENTIAL);
    });

    it('forwards handle and credentialId to native.deleteCredential', async () => {
      const native = makeMock();
      const mod = loadOath(native);
      const client = await mod.createOathClient({});
      const result = await client.deleteCredential('cred-1');
      expect(native.deleteCredential).toHaveBeenCalledWith(
        'handle-abc',
        'cred-1',
      );
      expect(result).toBe(true);
    });
  });

  describe('close()', () => {
    it('calls native.close with the handle', async () => {
      const native = makeMock();
      const mod = loadOath(native);
      const client = await mod.createOathClient({});
      await client.close();
      expect(native.close).toHaveBeenCalledWith('handle-abc');
    });

    it('rejects subsequent operations after close with state_error', async () => {
      const native = makeMock();
      const mod = loadOath(native);
      const client = await mod.createOathClient({});
      await client.close();
      await expect(client.generateCode('cred-1')).rejects.toMatchObject({
        type: 'state_error',
        code: 'OATH_STATE_ERROR',
      });
    });
  });

  describe('logger', () => {
    it('logs debug and info on a successful generateCode call', async () => {
      const native = makeMock();
      const mod = loadOath(native);
      const debugSpy = jest.fn();
      const infoSpy = jest.fn();
      const log = {
        debug: debugSpy,
        info: infoSpy,
        warn: jest.fn(),
        error: jest.fn(),
        changeLevel: jest.fn(),
        nativeHandle: { id: '' },
      };
      const client = await mod.createOathClient({ logger: log });
      await client.generateCode('cred-1');
      expect(debugSpy).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalled();
    });

    it('logs error on a failed generateCode call', async () => {
      const native = makeMock({
        generateCode: jest.fn(async () => {
          throw { type: 'state_error', error: 'OATH_CREDENTIAL_NOT_FOUND' };
        }),
      });
      const mod = loadOath(native);
      const errorSpy = jest.fn();
      const log = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: errorSpy,
        changeLevel: jest.fn(),
        nativeHandle: { id: '' },
      };
      const client = await mod.createOathClient({ logger: log });
      await expect(client.generateCode('cred-1')).rejects.toBeDefined();
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});

describe('configureOathPolicyEvaluator', () => {
  function loadOathWithEvaluator(nativeMock: NativeOathMock) {
    jest.resetModules();
    jest.doMock('../../../packages/oath/src/NativeRNPingOath', () => ({
      __esModule: true,
      getNativeModule: jest.fn(() => nativeMock),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@ping-identity/rn-oath');
  }

  it('exports configureOathPolicyEvaluator as a function', () => {
    const native = makeMock();
    const mod = loadOathWithEvaluator(native);
    expect(typeof mod.configureOathPolicyEvaluator).toBe('function');
  });

  it('returns a handle with the registered id and kind', () => {
    const native = makeMock();
    const mod = loadOathWithEvaluator(native);
    const handle = mod.configureOathPolicyEvaluator({
      policies: [{ kind: 'biometricAvailable' }],
    });
    expect(handle.id).toBe('evaluator-id-1');
    expect(handle.kind).toBe('oath_policy_evaluator');
  });

  it('calls native.registerOathPolicyEvaluator with mapped policy kinds', () => {
    const native = makeMock();
    const mod = loadOathWithEvaluator(native);
    mod.configureOathPolicyEvaluator({
      policies: [{ kind: 'biometricAvailable' }, { kind: 'deviceTampering' }],
    });
    expect(native.registerOathPolicyEvaluator).toHaveBeenCalledWith(
      expect.objectContaining({
        policies: ['biometricAvailable', 'deviceTampering'],
      }),
    );
  });

  it('forwards loggerId when provided', () => {
    const native = makeMock();
    const mod = loadOathWithEvaluator(native);
    mod.configureOathPolicyEvaluator({
      policies: [{ kind: 'biometricAvailable' }],
      loggerId: 'logger-xyz',
    });
    expect(native.registerOathPolicyEvaluator).toHaveBeenCalledWith(
      expect.objectContaining({ loggerId: 'logger-xyz' }),
    );
  });

  it('omits loggerId when not provided', () => {
    const native = makeMock();
    const mod = loadOathWithEvaluator(native);
    mod.configureOathPolicyEvaluator({
      policies: [{ kind: 'biometricAvailable' }],
    });
    const call = native.registerOathPolicyEvaluator.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(call).not.toHaveProperty('loggerId');
  });

  it('throws argument_error when policies array is empty', () => {
    const native = makeMock();
    const mod = loadOathWithEvaluator(native);
    let thrown: unknown;
    try {
      mod.configureOathPolicyEvaluator({ policies: [] });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toMatchObject({
      type: 'argument_error',
      code: 'OATH_INVALID_PARAMETER',
    });
  });

  it('throws argument_error for an unknown policy kind', () => {
    const native = makeMock();
    const mod = loadOathWithEvaluator(native);
    let thrown: unknown;
    try {
      mod.configureOathPolicyEvaluator({
        policies: [{ kind: 'unknownPolicy' }],
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toMatchObject({
      type: 'argument_error',
      code: 'OATH_INVALID_PARAMETER',
    });
    expect(native.registerOathPolicyEvaluator).not.toHaveBeenCalled();
  });
});
