/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

type NativeDaVinciModuleMock = {
  configureDaVinci: jest.Mock;
  start: jest.Mock;
  next: jest.Mock;
  getSession: jest.Mock;
  refresh: jest.Mock;
  revoke: jest.Mock;
  userinfo: jest.Mock;
  logout: jest.Mock;
  dispose: jest.Mock;
};

const createNativeMock = (
  overrides: Partial<NativeDaVinciModuleMock> = {},
): NativeDaVinciModuleMock => ({
  configureDaVinci: jest.fn(async () => 'davinci-id-1'),
  start: jest.fn(async () => ({ type: 'ContinueNode', collectors: [] })),
  next: jest.fn(async () => ({ type: 'ContinueNode', collectors: [] })),
  getSession: jest.fn(async () => ({ accessToken: 'token' })),
  refresh: jest.fn(async () => ({ accessToken: 'refreshed-token' })),
  revoke: jest.fn(async () => true),
  userinfo: jest.fn(async () => ({ sub: 'user-1' })),
  logout: jest.fn(async () => undefined),
  dispose: jest.fn(async () => undefined),
  ...overrides,
});

const loadMethods = (nativeModule: NativeDaVinciModuleMock) => {
  jest.resetModules();
  jest.doMock('../NativeRNPingDavinci', () => ({
    __esModule: true,
    default: nativeModule,
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../davinciMethods');
};

const assertDaVinciError = (
  err: unknown,
  expectedCode: string,
  expectedMessage?: string,
) => {
  expect(err).toBeInstanceOf(Error);
  expect((err as Error).name).toBe('DaVinciError');
  expect((err as Record<string, unknown>).code).toBe(expectedCode);
  if (expectedMessage !== undefined) {
    expect((err as Error).message).toBe(expectedMessage);
  }
};

describe('davinciMethods', () => {
  describe('configureDaVinci', () => {
    it('calls native configureDaVinci and returns the davinciId', async () => {
      const native = createNativeMock();
      const { configureDaVinci } = loadMethods(native);

      const id = await configureDaVinci({
        discoveryEndpoint:
          'https://example.com/.well-known/openid-configuration',
        clientId: 'client',
        redirectUri: 'app://cb',
      });

      expect(id).toBe('davinci-id-1');
      expect(native.configureDaVinci).toHaveBeenCalledTimes(1);
    });

    it('coerces native rejection to DaVinciError', async () => {
      const native = createNativeMock({
        configureDaVinci: jest.fn(async () => {
          throw {
            type: 'argument_error',
            error: 'DAVINCI_CONFIG_ERROR',
            message: 'bad config',
          };
        }),
      });
      const { configureDaVinci } = loadMethods(native);

      const err = await configureDaVinci({
        discoveryEndpoint:
          'https://example.com/.well-known/openid-configuration',
        clientId: 'client',
        redirectUri: 'app://cb',
      }).catch((e: unknown) => e);

      assertDaVinciError(err, 'DAVINCI_CONFIG_ERROR', 'bad config');
    });
  });

  describe('startDaVinci', () => {
    it('calls native start with davinciId and returns the node', async () => {
      const native = createNativeMock();
      const { startDaVinci } = loadMethods(native);

      const node = await startDaVinci('davinci-id-1');

      expect(node).toEqual({ type: 'ContinueNode', collectors: [] });
      expect(native.start).toHaveBeenCalledWith('davinci-id-1');
    });

    it('coerces native rejection to DaVinciError', async () => {
      const native = createNativeMock({
        start: jest.fn(async () => {
          throw {
            type: 'state_error',
            error: 'DAVINCI_START_ERROR',
            message: 'start failed',
          };
        }),
      });
      const { startDaVinci } = loadMethods(native);

      const err = await startDaVinci('davinci-id-1').catch((e: unknown) => e);

      assertDaVinciError(err, 'DAVINCI_START_ERROR', 'start failed');
    });
  });

  describe('nextDaVinci', () => {
    it('calls native next with davinciId and the input payload', async () => {
      const native = createNativeMock();
      const { nextDaVinci } = loadMethods(native);
      const input = { collectors: [{ key: 'username', value: 'alice' }] };

      const node = await nextDaVinci('davinci-id-1', input);

      expect(node).toEqual({ type: 'ContinueNode', collectors: [] });
      expect(native.next).toHaveBeenCalledWith('davinci-id-1', input);
    });

    it('coerces native rejection to DaVinciError', async () => {
      const native = createNativeMock({
        next: jest.fn(async () => {
          throw {
            type: 'server_error',
            error: 'DAVINCI_NEXT_ERROR',
            message: 'next failed',
          };
        }),
      });
      const { nextDaVinci } = loadMethods(native);

      const err = await nextDaVinci('davinci-id-1', { collectors: [] }).catch(
        (e: unknown) => e,
      );

      assertDaVinciError(err, 'DAVINCI_NEXT_ERROR', 'next failed');
    });
  });

  describe('getDaVinciSession', () => {
    it('returns the session payload when native resolves a value', async () => {
      const native = createNativeMock();
      const { getDaVinciSession } = loadMethods(native);

      const session = await getDaVinciSession('davinci-id-1');

      expect(session).toEqual({ accessToken: 'token' });
      expect(native.getSession).toHaveBeenCalledWith('davinci-id-1');
    });

    it('returns null when native resolves null', async () => {
      const native = createNativeMock({
        getSession: jest.fn(async () => null),
      });
      const { getDaVinciSession } = loadMethods(native);

      expect(await getDaVinciSession('davinci-id-1')).toBeNull();
    });

    it('coerces native rejection to DaVinciError', async () => {
      const native = createNativeMock({
        getSession: jest.fn(async () => {
          throw {
            type: 'state_error',
            error: 'DAVINCI_SESSION_ERROR',
            message: 'no session',
          };
        }),
      });
      const { getDaVinciSession } = loadMethods(native);

      const err = await getDaVinciSession('davinci-id-1').catch(
        (e: unknown) => e,
      );

      assertDaVinciError(err, 'DAVINCI_SESSION_ERROR', 'no session');
    });
  });

  describe('refreshDaVinciSession', () => {
    it('returns the refreshed session payload', async () => {
      const native = createNativeMock();
      const { refreshDaVinciSession } = loadMethods(native);

      const session = await refreshDaVinciSession('davinci-id-1');

      expect(session).toEqual({ accessToken: 'refreshed-token' });
      expect(native.refresh).toHaveBeenCalledWith('davinci-id-1');
    });

    it('returns null when native resolves null', async () => {
      const native = createNativeMock({ refresh: jest.fn(async () => null) });
      const { refreshDaVinciSession } = loadMethods(native);

      expect(await refreshDaVinciSession('davinci-id-1')).toBeNull();
    });

    it('coerces native rejection to DaVinciError', async () => {
      const native = createNativeMock({
        refresh: jest.fn(async () => {
          throw {
            type: 'state_error',
            error: 'DAVINCI_SESSION_ERROR',
            message: 'refresh failed',
          };
        }),
      });
      const { refreshDaVinciSession } = loadMethods(native);

      const err = await refreshDaVinciSession('davinci-id-1').catch(
        (e: unknown) => e,
      );

      assertDaVinciError(err, 'DAVINCI_SESSION_ERROR', 'refresh failed');
    });
  });

  describe('revokeDaVinciSession', () => {
    it('calls native revoke and resolves true', async () => {
      const native = createNativeMock();
      const { revokeDaVinciSession } = loadMethods(native);

      await expect(revokeDaVinciSession('davinci-id-1')).resolves.toBe(true);
      expect(native.revoke).toHaveBeenCalledWith('davinci-id-1');
    });

    it('coerces native rejection to DaVinciError', async () => {
      const native = createNativeMock({
        revoke: jest.fn(async () => {
          throw {
            type: 'state_error',
            error: 'DAVINCI_SESSION_ERROR',
            message: 'revoke failed',
          };
        }),
      });
      const { revokeDaVinciSession } = loadMethods(native);

      const err = await revokeDaVinciSession('davinci-id-1').catch(
        (e: unknown) => e,
      );

      assertDaVinciError(err, 'DAVINCI_SESSION_ERROR', 'revoke failed');
    });
  });

  describe('getDaVinciUserInfo', () => {
    it('returns the userinfo payload', async () => {
      const native = createNativeMock();
      const { getDaVinciUserInfo } = loadMethods(native);

      const info = await getDaVinciUserInfo('davinci-id-1');

      expect(info).toEqual({ sub: 'user-1' });
      expect(native.userinfo).toHaveBeenCalledWith('davinci-id-1');
    });

    it('returns null when native resolves null', async () => {
      const native = createNativeMock({ userinfo: jest.fn(async () => null) });
      const { getDaVinciUserInfo } = loadMethods(native);

      expect(await getDaVinciUserInfo('davinci-id-1')).toBeNull();
    });

    it('coerces native rejection to DaVinciError', async () => {
      const native = createNativeMock({
        userinfo: jest.fn(async () => {
          throw {
            type: 'state_error',
            error: 'DAVINCI_SESSION_ERROR',
            message: 'userinfo failed',
          };
        }),
      });
      const { getDaVinciUserInfo } = loadMethods(native);

      const err = await getDaVinciUserInfo('davinci-id-1').catch(
        (e: unknown) => e,
      );

      assertDaVinciError(err, 'DAVINCI_SESSION_ERROR', 'userinfo failed');
    });
  });

  describe('logoutDaVinci', () => {
    it('calls native logout and resolves void', async () => {
      const native = createNativeMock();
      const { logoutDaVinci } = loadMethods(native);

      await expect(logoutDaVinci('davinci-id-1')).resolves.toBeUndefined();
      expect(native.logout).toHaveBeenCalledWith('davinci-id-1');
    });

    it('coerces native rejection to DaVinciError', async () => {
      const native = createNativeMock({
        logout: jest.fn(async () => {
          throw {
            type: 'state_error',
            error: 'DAVINCI_LOGOUT_ERROR',
            message: 'logout failed',
          };
        }),
      });
      const { logoutDaVinci } = loadMethods(native);

      const err = await logoutDaVinci('davinci-id-1').catch((e: unknown) => e);

      assertDaVinciError(err, 'DAVINCI_LOGOUT_ERROR', 'logout failed');
    });
  });

  describe('disposeDaVinci', () => {
    it('calls native dispose and resolves void', async () => {
      const native = createNativeMock();
      const { disposeDaVinci } = loadMethods(native);

      await expect(disposeDaVinci('davinci-id-1')).resolves.toBeUndefined();
      expect(native.dispose).toHaveBeenCalledWith('davinci-id-1');
    });

    it('coerces native rejection to DaVinciError', async () => {
      const native = createNativeMock({
        dispose: jest.fn(async () => {
          throw {
            type: 'state_error',
            error: 'DAVINCI_DISPOSE_ERROR',
            message: 'dispose failed',
          };
        }),
      });
      const { disposeDaVinci } = loadMethods(native);

      const err = await disposeDaVinci('davinci-id-1').catch((e: unknown) => e);

      assertDaVinciError(err, 'DAVINCI_DISPOSE_ERROR', 'dispose failed');
    });
  });
});
