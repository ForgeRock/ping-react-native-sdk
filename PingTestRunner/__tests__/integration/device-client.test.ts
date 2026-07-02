/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-device-client
 *
 * Validates that the device-client package:
 * - Exports createDeviceClient
 * - Validates required configuration up-front
 * - Creates the native handle lazily and caches it across operations
 * - Forwards get / update / delete calls to the right native methods
 *   with the correct `(handleId, kind, payload)` arguments
 * - Unwraps `{ result }` payloads from the native bridge
 * - Rejects further operations after `dispose()`
 * - Propagates native rejections unchanged to the caller
 * - Passes `loggerId` through when a logger is supplied
 */

export {};

type NativeDeviceClientMock = {
  create: jest.Mock;
  get: jest.Mock;
  update: jest.Mock;
  deleteDevice: jest.Mock;
  dispose: jest.Mock;
};

function makeMock(
  overrides: Partial<NativeDeviceClientMock> = {},
): NativeDeviceClientMock {
  return {
    create: jest.fn(async () => 'handle-1'),
    get: jest.fn(async () => ({ result: [] })),
    update: jest.fn(async () => ({ result: { id: 'x', deviceName: 'n' } })),
    deleteDevice: jest.fn(async () => ({
      result: { id: 'x', deviceName: 'n' },
    })),
    dispose: jest.fn(async () => undefined),
    ...overrides,
  };
}

async function loadDeviceClient(nativeMock: NativeDeviceClientMock) {
  jest.resetModules();
  jest.doMock(
    '../../../packages/device-client/src/NativeRNPingDeviceClient',
    () => ({
      __esModule: true,
      getNativeModule: jest.fn(() => nativeMock),
    }),
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@ping-identity/rn-device-client');
}

/**
 * Load device-client AND the real rn-logger package together. Mocks only the
 * two native bridges — everything above runs real JS so we verify that
 * rn-logger's handle id actually flows through rn-device-client's config
 * (cross-package wiring, not just device-client in isolation).
 */
function loadDeviceClientWithLogger(
  nativeDeviceMock: NativeDeviceClientMock,
  loggerId: string,
) {
  jest.resetModules();
  jest.doMock(
    '../../../packages/device-client/src/NativeRNPingDeviceClient',
    () => ({
      __esModule: true,
      getNativeModule: jest.fn(() => nativeDeviceMock),
    }),
  );
  const registerLoggerSpy = jest.fn(() => loggerId);
  const syncLoggerSpy = jest.fn();
  jest.doMock('../../../packages/logger/src/NativeRNPingLogger', () => ({
    __esModule: true,
    default: {
      registerLogger: registerLoggerSpy,
      syncLogger: syncLoggerSpy,
    },
  }));
  /* eslint-disable @typescript-eslint/no-require-imports */
  const deviceClient = require('@ping-identity/rn-device-client');
  const { logger } = require('@ping-identity/rn-logger');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { deviceClient, logger, registerLoggerSpy };
}

const VALID_CONFIG = {
  serverUrl: 'https://openam.example.com/am',
  ssoToken: 'sso-token-abc',
  realm: 'alpha',
  cookieName: 'iPlanetDirectoryPro',
};

describe('@ping-identity/rn-device-client — integration', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('exports', () => {
    it('exports createDeviceClient as a function', async () => {
      const mod = await loadDeviceClient(makeMock());
      expect(typeof mod.createDeviceClient).toBe('function');
    });

    it('returned client exposes all five per-kind repos plus dispose', async () => {
      const mod = await loadDeviceClient(makeMock());
      const client = mod.createDeviceClient(VALID_CONFIG);
      for (const kind of ['oath', 'push', 'bound', 'profile', 'webAuthn']) {
        expect(typeof client[kind].get).toBe('function');
        expect(typeof client[kind].update).toBe('function');
        expect(typeof client[kind].delete).toBe('function');
      }
      expect(typeof client.dispose).toBe('function');
    });
  });

  describe('config validation', () => {
    it('throws when serverUrl is missing', async () => {
      const mod = await loadDeviceClient(makeMock());
      expect(() =>
        mod.createDeviceClient({ ...VALID_CONFIG, serverUrl: '' }),
      ).toThrow(/serverUrl/);
    });

    it('throws when ssoToken is missing', async () => {
      const mod = await loadDeviceClient(makeMock());
      expect(() =>
        mod.createDeviceClient({ ...VALID_CONFIG, ssoToken: '' }),
      ).toThrow(/ssoToken/);
    });

    it('throws when realm is missing', async () => {
      const mod = await loadDeviceClient(makeMock());
      expect(() =>
        mod.createDeviceClient({ ...VALID_CONFIG, realm: '' }),
      ).toThrow(/realm/);
    });

    it('throws when cookieName is missing', async () => {
      const mod = await loadDeviceClient(makeMock());
      expect(() =>
        mod.createDeviceClient({ ...VALID_CONFIG, cookieName: '' }),
      ).toThrow(/cookieName/);
    });
  });

  describe('handle lifecycle', () => {
    it('does not call native create until the first operation', async () => {
      const native = makeMock();
      const mod = await loadDeviceClient(native);
      mod.createDeviceClient(VALID_CONFIG);
      expect(native.create).not.toHaveBeenCalled();
    });

    it('creates the native handle lazily on the first operation', async () => {
      const native = makeMock();
      const mod = await loadDeviceClient(native);
      const client = mod.createDeviceClient(VALID_CONFIG);
      await client.oath.get();
      expect(native.create).toHaveBeenCalledTimes(1);
      expect(native.create).toHaveBeenCalledWith(
        expect.objectContaining({
          serverUrl: VALID_CONFIG.serverUrl,
          ssoToken: VALID_CONFIG.ssoToken,
          realm: VALID_CONFIG.realm,
          cookieName: VALID_CONFIG.cookieName,
        }),
      );
    });

    it('reuses the same native handle across multiple operations', async () => {
      const native = makeMock();
      const mod = await loadDeviceClient(native);
      const client = mod.createDeviceClient(VALID_CONFIG);
      await client.oath.get();
      await client.push.get();
      await client.bound.get();
      expect(native.create).toHaveBeenCalledTimes(1);
      expect(native.get).toHaveBeenNthCalledWith(1, 'handle-1', 'oath');
      expect(native.get).toHaveBeenNthCalledWith(2, 'handle-1', 'push');
      expect(native.get).toHaveBeenNthCalledWith(3, 'handle-1', 'bound');
    });

    it('retries native create if the first attempt rejects', async () => {
      const native = makeMock({
        create: jest
          .fn()
          .mockRejectedValueOnce(new Error('boom'))
          .mockResolvedValueOnce('handle-2'),
      });
      const mod = await loadDeviceClient(native);
      const client = mod.createDeviceClient(VALID_CONFIG);
      await expect(client.oath.get()).rejects.toThrow(/boom/);
      await expect(client.oath.get()).resolves.toEqual([]);
      expect(native.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('per-kind forwarding', () => {
    it.each([
      ['oath'] as const,
      ['push'] as const,
      ['bound'] as const,
      ['profile'] as const,
      ['webAuthn'] as const,
    ])('%s.get forwards handle and kind to native.get', async (kind) => {
      const native = makeMock();
      const mod = await loadDeviceClient(native);
      const client = mod.createDeviceClient(VALID_CONFIG);
      await client[kind].get();
      expect(native.get).toHaveBeenCalledWith('handle-1', kind);
    });

    it('unwraps `{ result: [...] }` arrays from native.get', async () => {
      const devices = [{ id: '1', deviceName: 'A' }];
      const native = makeMock({
        get: jest.fn(async () => ({ result: devices })),
      });
      const mod = await loadDeviceClient(native);
      const client = mod.createDeviceClient(VALID_CONFIG);
      await expect(client.oath.get()).resolves.toEqual(devices);
    });

    it('returns an empty array when native.get payload is not result-shaped', async () => {
      const native = makeMock({
        get: jest.fn(async () => ({ unexpected: true })),
      });
      const mod = await loadDeviceClient(native);
      const client = mod.createDeviceClient(VALID_CONFIG);
      await expect(client.oath.get()).resolves.toEqual([]);
    });

    it('update forwards (handle, kind, device) to native.update', async () => {
      const device = { id: 'd1', deviceName: 'iPhone' };
      const native = makeMock({
        update: jest.fn(async () => ({
          result: { ...device, deviceName: 'Ren' },
        })),
      });
      const mod = await loadDeviceClient(native);
      const client = mod.createDeviceClient(VALID_CONFIG);
      const updated = await client.bound.update({
        ...device,
        deviceName: 'Ren',
        deviceId: 'abc',
      });
      expect(native.update).toHaveBeenCalledWith(
        'handle-1',
        'bound',
        expect.objectContaining({ deviceName: 'Ren' }),
      );
      expect(updated).toMatchObject({ deviceName: 'Ren' });
    });

    it('delete forwards (handle, kind, device) to native.deleteDevice and returns deleted device', async () => {
      const device = { id: 'd1', deviceName: 'iPhone' };
      const native = makeMock({
        deleteDevice: jest.fn(async () => ({
          result: { ...device, credentialId: 'cred-123' },
        })),
      });
      const mod = await loadDeviceClient(native);
      const client = mod.createDeviceClient(VALID_CONFIG);
      const deleted = await client.webAuthn.delete({
        ...device,
        credentialId: 'cred-123',
      });
      expect(native.deleteDevice).toHaveBeenCalledWith(
        'handle-1',
        'webAuthn',
        expect.objectContaining({ credentialId: 'cred-123' }),
      );
      expect(deleted).toMatchObject({ id: 'd1', credentialId: 'cred-123' });
    });

    it('propagates native rejections unchanged to JS callers', async () => {
      const nativeError = {
        code: 'DEVICE_CLIENT_INVALID_TOKEN',
        message: 'SSO token expired.',
        status: 401,
      };
      const native = makeMock({
        get: jest.fn(async () => {
          throw nativeError;
        }),
      });
      const mod = await loadDeviceClient(native);
      const client = mod.createDeviceClient(VALID_CONFIG);
      await expect(client.oath.get()).rejects.toMatchObject({
        code: nativeError.code,
        message: nativeError.message,
        status: nativeError.status,
      });
    });
  });

  describe('dispose()', () => {
    it('forwards the handle to native.dispose', async () => {
      const native = makeMock();
      const mod = await loadDeviceClient(native);
      const client = mod.createDeviceClient(VALID_CONFIG);
      await client.oath.get();
      await client.dispose();
      expect(native.dispose).toHaveBeenCalledWith('handle-1');
    });

    it('does not call native.dispose when no operation has run', async () => {
      const native = makeMock();
      const mod = await loadDeviceClient(native);
      const client = mod.createDeviceClient(VALID_CONFIG);
      await client.dispose();
      expect(native.dispose).not.toHaveBeenCalled();
    });

    it('is idempotent — second dispose call is a no-op', async () => {
      const native = makeMock();
      const mod = await loadDeviceClient(native);
      const client = mod.createDeviceClient(VALID_CONFIG);
      await client.oath.get();
      await client.dispose();
      await client.dispose();
      expect(native.dispose).toHaveBeenCalledTimes(1);
    });

    it('rejects subsequent operations after dispose', async () => {
      const native = makeMock();
      const mod = await loadDeviceClient(native);
      const client = mod.createDeviceClient(VALID_CONFIG);
      await client.oath.get();
      await client.dispose();
      await expect(client.oath.get()).rejects.toThrow(/disposed/);
    });
  });

  describe('rn-logger cross-package wiring', () => {
    it('forwards the real rn-logger handle id into device-client native config', async () => {
      const native = makeMock();
      const loggerId = 'logger-handle-real-42';
      const { deviceClient, logger, registerLoggerSpy } =
        loadDeviceClientWithLogger(native, loggerId);

      const log = logger({ level: 'debug' });
      expect(registerLoggerSpy).toHaveBeenCalledTimes(1);
      expect(log.nativeHandle.id).toBe(loggerId);

      const client = deviceClient.createDeviceClient({
        ...VALID_CONFIG,
        logger: log,
      });
      await client.oath.get();

      // The id the real rn-logger produced is the id device-client sent native.
      expect(native.create).toHaveBeenCalledWith(
        expect.objectContaining({ loggerId }),
      );
    });
  });
});
