/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { OidcStorageHandle } from '@ping-identity/rn-types';
import type { OidcClientConfig } from '../index';

type NativeModuleMock = {
  createClient: jest.Mock;
  createWebClient: jest.Mock;
  clientToken: jest.Mock;
  clientRefresh: jest.Mock;
  clientUserinfo: jest.Mock;
  clientRevoke: jest.Mock;
  clientEndSession: jest.Mock;
  authorize: jest.Mock;
  hasUser: jest.Mock;
  token: jest.Mock;
  refresh: jest.Mock;
  userinfo: jest.Mock;
  revoke: jest.Mock;
  logout: jest.Mock;
};

const createNativeMock = (
  overrides: Partial<NativeModuleMock> = {},
): NativeModuleMock => {
  return {
    createClient: jest.fn(() => 'client-id'),
    createWebClient: jest.fn(() => 'web-id'),
    clientToken: jest.fn(async () => ({ accessToken: 'token' })),
    clientRefresh: jest.fn(async () => ({ accessToken: 'token' })),
    clientUserinfo: jest.fn(async () => ({ sub: 'user' })),
    clientRevoke: jest.fn(async () => undefined),
    clientEndSession: jest.fn(async () => true),
    authorize: jest.fn(async () => ({ type: 'success' })),
    hasUser: jest.fn(async () => true),
    token: jest.fn(async () => ({ accessToken: 'token' })),
    refresh: jest.fn(async () => ({ accessToken: 'token' })),
    userinfo: jest.fn(async () => ({ sub: 'user' })),
    revoke: jest.fn(async () => undefined),
    logout: jest.fn(async () => undefined),
    ...overrides,
  };
};

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
  jest.doMock('../NativeRNPingOidc', () => ({
    getNativeModule: () => nativeModule,
  }));
  jest.doMock(
    '@ping-identity/rn-logger',
    () => ({
      logger: jest.fn(() => ({
        nativeHandle: { id: 'native-none-id' },
        changeLevel: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      })),
    }),
    // virtual: true bypasses filesystem resolution — rn-logger is not a
    // dependency of this package, so Jest with --coverage would fail to
    // resolve it without this flag.
    { virtual: true },
  );
  return import('../index');
};

describe('OIDC JS API', () => {
  it('passes openId configuration without discoveryEndpoint', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient } = await loadModule(nativeModule);

    createOidcClient({
      clientId: 'client',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
      openId: {
        authorizationEndpoint: 'https://issuer/authorize',
        tokenEndpoint: 'https://issuer/token',
        userinfoEndpoint: 'https://issuer/userinfo',
      },
    });

    expect(nativeModule.createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: {
          authorizationEndpoint: 'https://issuer/authorize',
          tokenEndpoint: 'https://issuer/token',
          userinfoEndpoint: 'https://issuer/userinfo',
        },
      }),
    );
  });

  it('throws when storage is provided without id', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient } = await loadModule(nativeModule);

    expect(() =>
      createOidcClient({
        clientId: 'client',
        discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
        redirectUri: 'app://redirect',
        scopes: ['openid'],
        storage: {} as unknown as OidcStorageHandle,
      }),
    ).toThrow(
      '[@ping-identity/rn-oidc] Invalid storage handle. Use configureOidcStorage(...) from @ping-identity/rn-storage.',
    );
  });

  it('throws when discoveryEndpoint and openId are missing', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient } = await loadModule(nativeModule);

    expect(() =>
      createOidcClient({
        clientId: 'client',
        redirectUri: 'app://redirect',
        scopes: ['openid'],
      }),
    ).toThrow(
      '[@ping-identity/rn-oidc] Missing configuration. Provide discoveryEndpoint or openId.',
    );
  });

  it('passes storageId and loggerId when creating a client', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient } = await loadModule(nativeModule);

    const logger = createJsLogger();

    createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
      storage: {
        id: 'storage-id',
        kind: 'oidc',
      } as unknown as OidcStorageHandle,
      logger,
    });

    expect(nativeModule.createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        storageId: 'storage-id',
        loggerId: 'native-logger-id',
      }),
    );
  });

  it('does not pass signOutRedirectUri from JS config', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient } = await loadModule(nativeModule);

    createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
      signOutRedirectUri: 'app://logout',
    } as OidcClientConfig & { signOutRedirectUri: string });

    expect(nativeModule.createClient).toHaveBeenCalledWith(
      expect.not.objectContaining({
        signOutRedirectUri: expect.anything(),
      }),
    );
  });

  it('does not pass loggerId when logger is omitted', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient } = await loadModule(nativeModule);

    createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    expect(nativeModule.createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        loggerId: undefined,
      }),
    );
  });

  it('throws when storage handle is missing an id', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient } = await loadModule(nativeModule);

    expect(() =>
      createOidcClient({
        clientId: 'client',
        discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
        redirectUri: 'app://redirect',
        scopes: ['openid'],
        storage: {} as unknown as OidcStorageHandle,
      }),
    ).toThrow(
      '[@ping-identity/rn-oidc] Invalid storage handle. Use configureOidcStorage(...) from @ping-identity/rn-storage.',
    );
  });

  it('throws when storage handle has a non-oidc kind', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient } = await loadModule(nativeModule);

    expect(() =>
      createOidcClient({
        clientId: 'client',
        discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
        redirectUri: 'app://redirect',
        scopes: ['openid'],
        storage: {
          id: 'storage-id',
          kind: 'session',
        } as unknown as OidcStorageHandle,
      }),
    ).toThrow(
      '[@ping-identity/rn-oidc] Invalid storage handle. Use configureOidcStorage(...) from @ping-identity/rn-storage.',
    );
  });

  it('creates a web client and forwards authorize options', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    await webClient.authorize({ loginHint: 'user@example.com' });

    expect(nativeModule.createWebClient).toHaveBeenCalledWith('client-id');
    expect(nativeModule.authorize).toHaveBeenCalledWith('web-id', {
      loginHint: 'user@example.com',
    });
  });

  it('passes empty options to authorize when none are provided', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    await webClient.authorize();

    expect(nativeModule.authorize).toHaveBeenCalledWith('web-id', {});
  });

  it('logs debug and info during client creation', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient } = await loadModule(nativeModule);
    const logger = createJsLogger();

    createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
      logger,
    });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('OIDC createClient config'),
    );
    expect(logger.info).toHaveBeenCalledWith('OIDC createClient success');
  });

  it('logs errors when authorize fails', async () => {
    const error = new Error('authorize failed');
    const nativeModule = createNativeMock({
      authorize: jest.fn(async () => {
        throw error;
      }),
    });
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);
    const logger = createJsLogger();

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
      logger,
    });

    const webClient = createOidcWebClient(client);
    await expect(webClient.authorize()).rejects.toThrow('authorize failed');
    expect(logger.error).toHaveBeenCalledWith('OIDC authorize failed');
  });

  it('propagates authorize errors from the native module', async () => {
    const error = new Error('authorize failed');
    const nativeModule = createNativeMock({
      authorize: jest.fn(async () => {
        throw error;
      }),
    });
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    await expect(webClient.authorize({})).rejects.toThrow('authorize failed');
  });

  it('returns null from user when hasUser is false', async () => {
    const nativeModule = createNativeMock({
      hasUser: jest.fn(async () => false),
    });
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    const user = await webClient.user();

    expect(user).toBeNull();
    expect(nativeModule.hasUser).toHaveBeenCalledWith('web-id');
  });

  it('bubbles up hasUser errors when resolving a user', async () => {
    const nativeModule = createNativeMock({
      hasUser: jest.fn(async () => {
        throw new Error('hasUser failed');
      }),
    });
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    await expect(webClient.user()).rejects.toThrow('hasUser failed');
  });

  it('uses default cache=false for userinfo when not provided', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    const user = await webClient.user();

    expect(user).not.toBeNull();
    await user!.userinfo();

    expect(nativeModule.userinfo).toHaveBeenCalledWith('web-id', false);
  });

  it('forwards userinfo cache flag when provided', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    const user = await webClient.user();
    await user!.userinfo(true);

    expect(nativeModule.userinfo).toHaveBeenCalledWith('web-id', true);
  });

  it('calls native endSession from the client', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient } = await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    await client.endSession();

    expect(nativeModule.clientEndSession).toHaveBeenCalledWith('client-id');
  });

  it('propagates client token errors', async () => {
    const nativeModule = createNativeMock({
      clientToken: jest.fn(async () => {
        throw new Error('token failed');
      }),
    });
    const { createOidcClient } = await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    await expect(client.token()).rejects.toThrow('token failed');
  });

  it('propagates user logout errors', async () => {
    const nativeModule = createNativeMock({
      logout: jest.fn(async () => {
        throw new Error('logout failed');
      }),
    });
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    const user = await webClient.user();

    await expect(user!.logout()).rejects.toThrow('logout failed');
  });

  it('propagates client endSession errors', async () => {
    const nativeModule = createNativeMock({
      clientEndSession: jest.fn(async () => {
        throw new Error('endSession failed');
      }),
    });
    const { createOidcClient } = await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    await expect(client.endSession()).rejects.toThrow('endSession failed');
  });

  it('propagates client userinfo errors', async () => {
    const nativeModule = createNativeMock({
      clientUserinfo: jest.fn(async () => {
        throw new Error('client userinfo failed');
      }),
    });
    const { createOidcClient } = await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    await expect(client.userinfo()).rejects.toThrow('client userinfo failed');
  });

  it('propagates user token errors', async () => {
    const nativeModule = createNativeMock({
      token: jest.fn(async () => {
        throw new Error('user token failed');
      }),
    });
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    const user = await webClient.user();

    await expect(user!.token()).rejects.toThrow('user token failed');
  });

  it('propagates user refresh errors', async () => {
    const nativeModule = createNativeMock({
      refresh: jest.fn(async () => {
        throw new Error('user refresh failed');
      }),
    });
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    const user = await webClient.user();

    await expect(user!.refresh()).rejects.toThrow('user refresh failed');
  });

  it('propagates user revoke errors', async () => {
    const nativeModule = createNativeMock({
      revoke: jest.fn(async () => {
        throw new Error('user revoke failed');
      }),
    });
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    const user = await webClient.user();

    await expect(user!.revoke()).rejects.toThrow('user revoke failed');
  });

  it('propagates user userinfo errors', async () => {
    const nativeModule = createNativeMock({
      userinfo: jest.fn(async () => {
        throw new Error('user userinfo failed');
      }),
    });
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    const user = await webClient.user();

    await expect(user!.userinfo()).rejects.toThrow('user userinfo failed');
  });

  it('propagates client refresh errors', async () => {
    const nativeModule = createNativeMock({
      clientRefresh: jest.fn(async () => {
        throw new Error('client refresh failed');
      }),
    });
    const { createOidcClient } = await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    await expect(client.refresh()).rejects.toThrow('client refresh failed');
  });

  it('propagates client revoke errors', async () => {
    const nativeModule = createNativeMock({
      clientRevoke: jest.fn(async () => {
        throw new Error('client revoke failed');
      }),
    });
    const { createOidcClient } = await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    await expect(client.revoke()).rejects.toThrow('client revoke failed');
  });

  it('propagates client userinfo errors with cache flag', async () => {
    const nativeModule = createNativeMock({
      clientUserinfo: jest.fn(async () => {
        throw new Error('client userinfo failed');
      }),
    });
    const { createOidcClient } = await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    await expect(client.userinfo(true)).rejects.toThrow(
      'client userinfo failed',
    );
  });

  it('propagates client token errors with web client path untouched', async () => {
    const nativeModule = createNativeMock();
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    await expect(client.token()).resolves.toEqual({ accessToken: 'token' });
    await webClient.authorize();

    expect(nativeModule.authorize).toHaveBeenCalledWith('web-id', {});
  });

  it('wraps native rejections as OidcError instances', async () => {
    const nativeError = {
      error: 'OIDC_AUTHORIZE_ERROR',
      type: 'oidc_error',
      message: 'authorize failed',
    };
    const nativeModule = createNativeMock({
      authorize: jest.fn().mockRejectedValue(nativeError),
    });
    const { createOidcClient, createOidcWebClient } =
      await loadModule(nativeModule);

    const client = createOidcClient({
      clientId: 'client',
      discoveryEndpoint: 'https://issuer/.well-known/openid-configuration',
      redirectUri: 'app://redirect',
      scopes: ['openid'],
    });

    const webClient = createOidcWebClient(client);
    const err = await webClient.authorize().catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    // OidcError is loaded via jest.resetModules() so instanceof check uses name instead
    expect(err.name).toBe('OidcError');
    expect(err.code).toBe('OIDC_AUTHORIZE_ERROR');
    expect(err.message).toBe('authorize failed');
  });
});
