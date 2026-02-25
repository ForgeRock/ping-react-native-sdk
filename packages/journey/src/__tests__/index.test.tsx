/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

type NativeJourneyModuleMock = {
  configureJourney: jest.Mock;
  start: jest.Mock;
  next: jest.Mock;
  resume: jest.Mock;
  getSession: jest.Mock;
  refresh: jest.Mock;
  revoke: jest.Mock;
  userinfo: jest.Mock;
  ssoToken: jest.Mock;
  logout: jest.Mock;
  dispose: jest.Mock;
};

const createNativeMock = (
  overrides: Partial<NativeJourneyModuleMock> = {}
): NativeJourneyModuleMock => {
  return {
    configureJourney: jest.fn(async () => 'journey-id-1'),
    start: jest.fn(async () => ({ id: 'n1', type: 'ContinueNode', callbacks: [] })),
    next: jest.fn(async () => ({ id: 'n2', type: 'ContinueNode', callbacks: [] })),
    resume: jest.fn(async () => ({ id: 'n3', type: 'ContinueNode', callbacks: [] })),
    getSession: jest.fn(async () => ({ accessToken: 'token' })),
    refresh: jest.fn(async () => ({ accessToken: 'refreshed-token' })),
    revoke: jest.fn(async () => true),
    userinfo: jest.fn(async () => ({ sub: 'user-1' })),
    ssoToken: jest.fn(async () => ({ value: 'sso', successUrl: '/enduser', realm: '/alpha' })),
    logout: jest.fn(async () => true),
    dispose: jest.fn(async () => undefined),
    ...overrides,
  };
};

const loadModule = async (nativeModule: NativeJourneyModuleMock) => {
  jest.resetModules();
  jest.doMock('../NativeRNPingJourney', () => ({
    __esModule: true,
    default: nativeModule,
  }));

  return require('../index');
};

describe('Journey JS API', () => {
  it('throws when serverUrl is missing', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);

    expect(() =>
      createJourneyClient({
        serverUrl: '',
      })
    ).toThrow('[@ping-identity/rn-journey] Missing configuration. Provide a non-empty serverUrl.');
  });

  it('passes storage and logger ids to configureJourney', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);

    const client = createJourneyClient({
      serverUrl: 'https://example.com',
      logger: {
        nativeHandle: { id: 'logger-id' },
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      modules: {
        session: {
          storage: {
            id: 'session-storage-id',
            kind: 'session',
          } as any,
        },
      },
    });

    await client.init();

    expect(native.configureJourney).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionStorageId: 'session-storage-id',
        loggerId: 'logger-id',
      })
    );
  });

  it('uses modules.oidc.nativeLogger id when top-level logger is not provided', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);

    const client = createJourneyClient({
      serverUrl: 'https://example.com',
      modules: {
        oidc: {
          clientId: 'rn-client',
          discoveryEndpoint:
            'https://example.com/am/oauth2/.well-known/openid-configuration',
          redirectUri: 'com.example.app://oauth2redirect',
          scopes: ['openid'],
          nativeLogger: { id: 'oidc-native-logger-id' },
        },
      },
    });

    await client.init();

    expect(native.configureJourney).toHaveBeenCalledWith(
      expect.objectContaining({
        loggerId: 'oidc-native-logger-id',
      })
    );
  });

  it('does not use modules.oidc.logger for journey logger id resolution', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);

    const oidcLogger = {
      nativeHandle: { id: 'oidc-js-logger-id' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const client = createJourneyClient({
      serverUrl: 'https://example.com',
      modules: {
        oidc: {
          clientId: 'rn-client',
          discoveryEndpoint:
            'https://example.com/am/oauth2/.well-known/openid-configuration',
          redirectUri: 'com.example.app://oauth2redirect',
          scopes: ['openid'],
          logger: oidcLogger,
        },
      },
    });

    await client.init();

    expect(native.configureJourney).toHaveBeenCalledWith(
      expect.objectContaining({
        loggerId: undefined,
      })
    );
  });

  it('prefers top-level logger over module native logger', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);

    const topLevelLogger = {
      nativeHandle: { id: 'top-level-logger-id' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const client = createJourneyClient({
      serverUrl: 'https://example.com',
      logger: topLevelLogger,
      modules: {
        oidc: {
          clientId: 'rn-client',
          discoveryEndpoint:
            'https://example.com/am/oauth2/.well-known/openid-configuration',
          redirectUri: 'com.example.app://oauth2redirect',
          scopes: ['openid'],
          nativeLogger: { id: 'oidc-native-logger-id' },
        },
      },
    });

    await client.init();

    expect(native.configureJourney).toHaveBeenCalledWith(
      expect.objectContaining({
        loggerId: 'top-level-logger-id',
      })
    );
  });

  it('does not pass loggerId when logger is omitted', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);

    const client = createJourneyClient({
      serverUrl: 'https://example.com',
    });

    await client.init();

    expect(native.configureJourney).toHaveBeenCalledWith(
      expect.objectContaining({
        loggerId: undefined,
      })
    );
  });

  it('passes timeout to configureJourney when provided', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);

    const client = createJourneyClient({
      serverUrl: 'https://example.com',
      timeout: 30000,
    });

    await client.init();

    expect(native.configureJourney).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 30000,
      })
    );
  });

  it('passes advanced nested OIDC config to configureJourney', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);

    const client = createJourneyClient({
      serverUrl: 'https://example.com',
      modules: {
        oidc: {
          clientId: 'rn-client',
          redirectUri: 'com.example.app://oauth2redirect',
          openId: {
            authorizationEndpoint: 'https://example.com/am/oauth2/authorize',
            tokenEndpoint: 'https://example.com/am/oauth2/token',
            userinfoEndpoint: 'https://example.com/am/oauth2/userinfo',
          },
          scopes: ['openid', 'profile'],
          acrValues: 'loa-2',
          signOutRedirectUri: 'com.example.app://signed-out',
          state: 'state-123',
          nonce: 'nonce-123',
          uiLocales: 'en fr',
          refreshThreshold: 30,
          loginHint: 'demo-user',
          display: 'page',
          prompt: 'login',
          additionalParameters: {
            audience: 'urn:example:api',
          },
        },
      },
    });

    await client.init();

    expect(native.configureJourney).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'rn-client',
        redirectUri: 'com.example.app://oauth2redirect',
        openId: {
          authorizationEndpoint: 'https://example.com/am/oauth2/authorize',
          tokenEndpoint: 'https://example.com/am/oauth2/token',
          userinfoEndpoint: 'https://example.com/am/oauth2/userinfo',
        },
        scopes: ['openid', 'profile'],
        acrValues: 'loa-2',
        signOutRedirectUri: 'com.example.app://signed-out',
        state: 'state-123',
        nonce: 'nonce-123',
        uiLocales: 'en fr',
        refreshThreshold: 30,
        loginHint: 'demo-user',
        display: 'page',
        prompt: 'login',
        additionalParameters: {
          audience: 'urn:example:api',
        },
      })
    );
  });

  it('passes oidc storage id from nested OIDC config', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);

    const client = createJourneyClient({
      serverUrl: 'https://example.com',
      modules: {
        oidc: {
          clientId: 'rn-client',
          discoveryEndpoint:
            'https://example.com/am/oauth2/.well-known/openid-configuration',
          redirectUri: 'com.example.app://oauth2redirect',
          scopes: ['openid'],
          storage: {
            id: 'oidc-storage-id',
            kind: 'oidc',
          } as any,
        },
      },
    });

    await client.init();

    expect(native.configureJourney).toHaveBeenCalledWith(
      expect.objectContaining({
        oidcStorageId: 'oidc-storage-id',
      })
    );
  });

  it('throws when modules.session.storage is not a valid session handle', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);

    expect(() =>
      createJourneyClient({
        serverUrl: 'https://example.com',
        modules: {
          session: {
            storage: {
              id: 'session-storage-id',
            } as any,
          },
        },
      })
    ).toThrow(
      '[@ping-identity/rn-journey] Invalid modules.session.storage handle. ' +
        'Use configureSessionStorage(...) from @react-native-pingidentity/storage.'
    );
  });

  it('throws when modules.oidc.storage is not a valid oidc handle', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);

    expect(() =>
      createJourneyClient({
        serverUrl: 'https://example.com',
        modules: {
          oidc: {
            clientId: 'rn-client',
            discoveryEndpoint:
              'https://example.com/am/oauth2/.well-known/openid-configuration',
            redirectUri: 'com.example.app://oauth2redirect',
            scopes: ['openid'],
            storage: {
              id: 'oidc-storage-id',
              kind: 'session',
            } as any,
          },
        },
      })
    ).toThrow(
      '[@ping-identity/rn-journey] Invalid modules.oidc.storage handle. ' +
        'Use configureOidcStorage(...) from @react-native-pingidentity/storage.'
    );
  });

  it('configures only once and reuses native id', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);
    const client = createJourneyClient({ serverUrl: 'https://example.com' });

    const idA = await client.init();
    const idB = await client.getId();

    expect(idA).toBe('journey-id-1');
    expect(idB).toBe('journey-id-1');
    expect(native.configureJourney).toHaveBeenCalledTimes(1);
  });

  it('passes start options and journey name to native start', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);
    const client = createJourneyClient({ serverUrl: 'https://example.com' });

    await client.start('Login', { forceAuth: true, noSession: true });

    expect(native.start).toHaveBeenCalledWith(
      'journey-id-1',
      'Login',
      { forceAuth: true, noSession: true }
    );
  });

  it('throws argument error when start journey name is empty', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);
    const client = createJourneyClient({ serverUrl: 'https://example.com' });

    await expect(client.start('   ')).rejects.toMatchObject({
      type: 'argument_error',
      error: 'JOURNEY_START_ERROR',
    });
  });

  it('calls native next with placeholder node id and input payload', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);
    const client = createJourneyClient({ serverUrl: 'https://example.com' });

    await client.start('Login');
    await client.next({
      callbacks: [{ type: 'NameCallback', value: 'user' }],
    });

    expect(native.next).toHaveBeenCalledWith('journey-id-1', '', {
      callbacks: [{ type: 'NameCallback', value: 'user' }],
    });
  });

  it('throws argument error when resume uri is empty', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);
    const client = createJourneyClient({ serverUrl: 'https://example.com' });

    await expect(client.resume('   ')).rejects.toMatchObject({
      type: 'argument_error',
      error: 'JOURNEY_RESUME_ERROR',
    });
  });

  it('forwards user, refresh, revoke, userinfo, ssoToken, and logout calls to native', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);
    const client = createJourneyClient({ serverUrl: 'https://example.com' });

    const session = await client.user();
    const refreshedSession = await client.refresh();
    const didRevoke = await client.revoke();
    const userInfo = await client.userinfo();
    const ssoToken = await client.ssoToken();
    const didLogout = await client.logoutUser();

    expect(session).toEqual({ accessToken: 'token' });
    expect(refreshedSession).toEqual({ accessToken: 'refreshed-token' });
    expect(didRevoke).toBe(true);
    expect(userInfo).toEqual({ sub: 'user-1' });
    expect(ssoToken).toEqual({ value: 'sso', successUrl: '/enduser', realm: '/alpha' });
    expect(didLogout).toBe(true);
    expect(native.getSession).toHaveBeenCalledWith('journey-id-1');
    expect(native.refresh).toHaveBeenCalledWith('journey-id-1');
    expect(native.revoke).toHaveBeenCalledWith('journey-id-1');
    expect(native.userinfo).toHaveBeenCalledWith('journey-id-1');
    expect(native.ssoToken).toHaveBeenCalledWith('journey-id-1');
    expect(native.logout).toHaveBeenCalledWith('journey-id-1');
  });

  it('disposes native journey instance and clears cached id', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);
    const client = createJourneyClient({ serverUrl: 'https://example.com' });

    await client.init();
    await client.dispose();
    await client.init();

    expect(native.dispose).toHaveBeenCalledWith('journey-id-1');
    expect(native.configureJourney).toHaveBeenCalledTimes(2);
  });

  it('skips native dispose when client was never initialized', async () => {
    const native = createNativeMock();
    const { createJourneyClient } = await loadModule(native);
    const client = createJourneyClient({ serverUrl: 'https://example.com' });

    await client.dispose();

    expect(native.dispose).not.toHaveBeenCalled();
    expect(native.configureJourney).not.toHaveBeenCalled();
  });

  it('propagates native rejections for session operations', async () => {
    const expectedError = {
      type: 'state_error',
      error: 'JOURNEY_STATE_ERROR',
      message: 'native failure',
    };
    const native = createNativeMock({
      getSession: jest.fn(async () => {
        throw expectedError;
      }),
      refresh: jest.fn(async () => {
        throw expectedError;
      }),
      revoke: jest.fn(async () => {
        throw expectedError;
      }),
      userinfo: jest.fn(async () => {
        throw expectedError;
      }),
      ssoToken: jest.fn(async () => {
        throw expectedError;
      }),
      logout: jest.fn(async () => {
        throw expectedError;
      }),
    });
    const { createJourneyClient } = await loadModule(native);
    const client = createJourneyClient({ serverUrl: 'https://example.com' });

    await expect(client.user()).rejects.toEqual(expectedError);
    await expect(client.refresh()).rejects.toEqual(expectedError);
    await expect(client.revoke()).rejects.toEqual(expectedError);
    await expect(client.userinfo()).rejects.toEqual(expectedError);
    await expect(client.ssoToken()).rejects.toEqual(expectedError);
    await expect(client.logoutUser()).rejects.toEqual(expectedError);
  });
});
