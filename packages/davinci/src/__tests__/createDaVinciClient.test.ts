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
  next: jest.fn(async () => ({
    type: 'SuccessNode',
    session: { value: 'tok' },
  })),
  getSession: jest.fn(async () => ({ accessToken: 'token' })),
  refresh: jest.fn(async () => ({ accessToken: 'refreshed-token' })),
  revoke: jest.fn(async () => true),
  userinfo: jest.fn(async () => ({ sub: 'user-1' })),
  logout: jest.fn(async () => undefined),
  dispose: jest.fn(async () => undefined),
  ...overrides,
});

const loadModule = (nativeModule: NativeDaVinciModuleMock) => {
  jest.resetModules();
  jest.doMock('../NativeRNPingDavinci', () => ({
    __esModule: true,
    default: nativeModule,
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../index');
};

const VALID_CONFIG = {
  modules: {
    oidc: {
      discoveryEndpoint:
        'https://auth.example.com/.well-known/openid-configuration',
      clientId: 'my-client',
      redirectUri: 'app://callback',
    },
  },
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

describe('createDaVinciClient — validation', () => {
  it('throws when discoveryEndpoint is missing', () => {
    const { createDaVinciClient } = loadModule(createNativeMock());

    expect(() =>
      createDaVinciClient({
        modules: {
          oidc: {
            discoveryEndpoint: '',
            clientId: 'c',
            redirectUri: 'app://cb',
          },
        },
      }),
    ).toThrow(
      '[@ping-identity/rn-davinci] Missing configuration. Provide a non-empty modules.oidc.discoveryEndpoint.',
    );
  });

  it('throws when discoveryEndpoint is whitespace only', () => {
    const { createDaVinciClient } = loadModule(createNativeMock());

    expect(() =>
      createDaVinciClient({
        modules: {
          oidc: {
            discoveryEndpoint: '   ',
            clientId: 'c',
            redirectUri: 'app://cb',
          },
        },
      }),
    ).toThrow('modules.oidc.discoveryEndpoint');
  });

  it('throws when clientId is missing', () => {
    const { createDaVinciClient } = loadModule(createNativeMock());

    expect(() =>
      createDaVinciClient({
        modules: {
          oidc: {
            discoveryEndpoint: 'https://example.com',
            clientId: '',
            redirectUri: 'app://cb',
          },
        },
      }),
    ).toThrow(
      '[@ping-identity/rn-davinci] Missing configuration. Provide a non-empty modules.oidc.clientId.',
    );
  });

  it('throws when redirectUri is missing', () => {
    const { createDaVinciClient } = loadModule(createNativeMock());

    expect(() =>
      createDaVinciClient({
        modules: {
          oidc: {
            discoveryEndpoint: 'https://example.com',
            clientId: 'c',
            redirectUri: '',
          },
        },
      }),
    ).toThrow(
      '[@ping-identity/rn-davinci] Missing configuration. Provide a non-empty modules.oidc.redirectUri.',
    );
  });

  it('validation errors are DaVinciError with DAVINCI_CONFIG_ERROR code', () => {
    const { createDaVinciClient } = loadModule(createNativeMock());

    let caught: unknown;
    try {
      createDaVinciClient({
        modules: {
          oidc: {
            discoveryEndpoint: '',
            clientId: 'c',
            redirectUri: 'app://cb',
          },
        },
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).toBe('DaVinciError');
    expect((caught as Record<string, unknown>).code).toBe(
      'DAVINCI_CONFIG_ERROR',
    );
    expect((caught as Record<string, unknown>).type).toBe('argument_error');
  });

  it('throws when modules.oidc.storage has wrong kind', () => {
    const { createDaVinciClient } = loadModule(createNativeMock());

    expect(() =>
      createDaVinciClient({
        modules: {
          oidc: {
            discoveryEndpoint: 'https://example.com',
            clientId: 'c',
            redirectUri: 'app://cb',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            storage: { id: 'store-1', kind: 'session' } as any,
          },
        },
      }),
    ).toThrow(
      '[@ping-identity/rn-davinci] Invalid modules.oidc.storage handle. Use configureOidcStorage(...) from @ping-identity/rn-storage.',
    );
  });

  it('throws when modules.oidc.storage is missing the id field', () => {
    const { createDaVinciClient } = loadModule(createNativeMock());

    expect(() =>
      createDaVinciClient({
        modules: {
          oidc: {
            discoveryEndpoint: 'https://example.com',
            clientId: 'c',
            redirectUri: 'app://cb',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            storage: { kind: 'oidc' } as any,
          },
        },
      }),
    ).toThrow('configureOidcStorage');
  });
});

describe('createDaVinciClient — configure payload', () => {
  it('passes required OIDC fields to configureDaVinci on first call', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    await client.start();

    expect(native.configureDaVinci).toHaveBeenCalledWith(
      expect.objectContaining({
        discoveryEndpoint:
          'https://auth.example.com/.well-known/openid-configuration',
        clientId: 'my-client',
        redirectUri: 'app://callback',
      }),
    );
  });

  it('passes optional OIDC fields to configureDaVinci when provided', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);

    const client = createDaVinciClient({
      timeout: 30000,
      modules: {
        oidc: {
          discoveryEndpoint:
            'https://auth.example.com/.well-known/openid-configuration',
          clientId: 'my-client',
          redirectUri: 'app://callback',
          scopes: ['openid', 'profile'],
          signOutRedirectUri: 'app://signed-out',
          loginHint: 'demo-user',
          nonce: 'nonce-abc',
          state: 'state-xyz',
          prompt: 'login',
          display: 'page',
          uiLocales: 'en fr',
          acrValues: 'loa-2',
          refreshThreshold: 30,
          additionalParameters: { audience: 'urn:example:api' },
        },
      },
    });

    await client.start();

    expect(native.configureDaVinci).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 30000,
        scopes: ['openid', 'profile'],
        signOutRedirectUri: 'app://signed-out',
        loginHint: 'demo-user',
        nonce: 'nonce-abc',
        state: 'state-xyz',
        prompt: 'login',
        display: 'page',
        uiLocales: 'en fr',
        acrValues: 'loa-2',
        refreshThreshold: 30,
        additionalParameters: { audience: 'urn:example:api' },
      }),
    );
  });

  it('passes storageId when a valid oidc storage handle is provided', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);

    const client = createDaVinciClient({
      modules: {
        oidc: {
          discoveryEndpoint:
            'https://auth.example.com/.well-known/openid-configuration',
          clientId: 'my-client',
          redirectUri: 'app://callback',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          storage: { id: 'oidc-store-1', kind: 'oidc' } as any,
        },
      },
    });

    await client.start();

    expect(native.configureDaVinci).toHaveBeenCalledWith(
      expect.objectContaining({ storageId: 'oidc-store-1' }),
    );
  });

  it('omits storageId when no storage handle is provided', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    await client.start();

    expect(native.configureDaVinci).toHaveBeenCalledWith(
      expect.objectContaining({ storageId: undefined }),
    );
  });

  it('passes loggerId from top-level logger nativeHandle', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);

    const client = createDaVinciClient({
      logger: {
        nativeHandle: { id: 'logger-handle-1' },
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      modules: {
        oidc: {
          discoveryEndpoint:
            'https://auth.example.com/.well-known/openid-configuration',
          clientId: 'c',
          redirectUri: 'app://cb',
        },
      },
    });

    await client.start();

    expect(native.configureDaVinci).toHaveBeenCalledWith(
      expect.objectContaining({ loggerId: 'logger-handle-1' }),
    );
  });

  it('omits loggerId when no logger is provided', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    await client.start();

    expect(native.configureDaVinci).toHaveBeenCalledWith(
      expect.objectContaining({ loggerId: undefined }),
    );
  });

  it('omits loggerId when logger nativeHandle id is whitespace', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);

    const client = createDaVinciClient({
      logger: {
        nativeHandle: { id: '   ' },
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      modules: {
        oidc: {
          discoveryEndpoint:
            'https://auth.example.com/.well-known/openid-configuration',
          clientId: 'c',
          redirectUri: 'app://cb',
        },
      },
    });

    await client.start();

    expect(native.configureDaVinci).toHaveBeenCalledWith(
      expect.objectContaining({ loggerId: undefined }),
    );
  });
});

describe('createDaVinciClient — lazy configure', () => {
  it('configures only once and reuses the native davinciId across calls', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    await client.start();
    await client.start();

    expect(native.configureDaVinci).toHaveBeenCalledTimes(1);
  });

  it('re-configures after dispose clears the cached id', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    await client.start();
    await client.dispose();
    await client.start();

    expect(native.configureDaVinci).toHaveBeenCalledTimes(2);
    expect(native.dispose).toHaveBeenCalledWith('davinci-id-1');
  });

  it('skips native dispose when client was never configured', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    await client.dispose();

    expect(native.dispose).not.toHaveBeenCalled();
    expect(native.configureDaVinci).not.toHaveBeenCalled();
  });
});

describe('createDaVinciClient — client methods', () => {
  it('start() calls native start with davinciId and returns the node', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    const node = await client.start();

    expect(node).toEqual({ type: 'ContinueNode', collectors: [] });
    expect(native.start).toHaveBeenCalledWith('davinci-id-1');
  });

  it('next() calls native next with davinciId and the key-indexed input', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);
    const input = { collectors: [{ key: 'username', value: 'alice' }] };

    const node = await client.next(input);

    expect(node).toEqual({ type: 'SuccessNode', session: { value: 'tok' } });
    expect(native.next).toHaveBeenCalledWith('davinci-id-1', input);
  });

  it('user() returns the session payload', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    const session = await client.user();

    expect(session).toEqual({ accessToken: 'token' });
    expect(native.getSession).toHaveBeenCalledWith('davinci-id-1');
  });

  it('user() returns null when native resolves null', async () => {
    const native = createNativeMock({ getSession: jest.fn(async () => null) });
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    expect(await client.user()).toBeNull();
  });

  it('refresh() returns the refreshed session payload', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    const session = await client.refresh();

    expect(session).toEqual({ accessToken: 'refreshed-token' });
    expect(native.refresh).toHaveBeenCalledWith('davinci-id-1');
  });

  it('refresh() returns null when native resolves null', async () => {
    const native = createNativeMock({ refresh: jest.fn(async () => null) });
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    expect(await client.refresh()).toBeNull();
  });

  it('revoke() calls native revoke and resolves true', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    await expect(client.revoke()).resolves.toBe(true);
    expect(native.revoke).toHaveBeenCalledWith('davinci-id-1');
  });

  it('userinfo() returns the userinfo payload', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    const info = await client.userinfo();

    expect(info).toEqual({ sub: 'user-1' });
    expect(native.userinfo).toHaveBeenCalledWith('davinci-id-1');
  });

  it('userinfo() returns null when native resolves null', async () => {
    const native = createNativeMock({ userinfo: jest.fn(async () => null) });
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    expect(await client.userinfo()).toBeNull();
  });

  it('logoutUser() calls native logout and resolves void', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);

    await expect(client.logoutUser()).resolves.toBeUndefined();
    expect(native.logout).toHaveBeenCalledWith('davinci-id-1');
  });
});

describe('createDaVinciClient — logging behaviour', () => {
  it('serialize strips function-valued properties before logging', async () => {
    const native = createNativeMock();
    const { createDaVinciClient } = loadModule(native);
    const debugSpy = jest.fn();

    const client = createDaVinciClient({
      logger: {
        nativeHandle: { id: '' },
        changeLevel: jest.fn(),
        debug: debugSpy,
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      modules: {
        oidc: {
          discoveryEndpoint:
            'https://auth.example.com/.well-known/openid-configuration',
          clientId: 'c',
          redirectUri: 'app://cb',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          additionalParameters: { fn: (() => 'drop-me') as any },
        },
      },
    });

    await client.start();

    const debugCalls = debugSpy.mock.calls.flat().join(' ');
    expect(debugCalls).not.toContain('drop-me');
  });

  it('logError uses String(error) when a non-Error is thrown', async () => {
    const native = createNativeMock({
      start: jest.fn(async () => {
        throw 'plain-string-error';
      }),
    });
    const { createDaVinciClient } = loadModule(native);
    const errorSpy = jest.fn();

    const client = createDaVinciClient({
      logger: {
        nativeHandle: { id: '' },
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: errorSpy,
      },
      modules: {
        oidc: {
          discoveryEndpoint:
            'https://auth.example.com/.well-known/openid-configuration',
          clientId: 'c',
          redirectUri: 'app://cb',
        },
      },
    });

    await client.start().catch(() => undefined);

    const errorCalls = errorSpy.mock.calls.flat().join(' ');
    expect(errorCalls).toContain('plain-string-error');
  });
});

describe('createDaVinciClient — error propagation', () => {
  const nativeError = {
    type: 'state_error',
    error: 'DAVINCI_STATE_ERROR',
    message: 'native failure',
  };

  it('propagates native start rejection as DaVinciError', async () => {
    const native = createNativeMock({
      start: jest.fn(async () => {
        throw nativeError;
      }),
    });
    const { createDaVinciClient } = loadModule(native);

    assertDaVinciError(
      await createDaVinciClient(VALID_CONFIG)
        .start()
        .catch((e: unknown) => e),
      'DAVINCI_STATE_ERROR',
      'native failure',
    );
  });

  it('propagates native next rejection as DaVinciError', async () => {
    const native = createNativeMock({
      next: jest.fn(async () => {
        throw nativeError;
      }),
    });
    const { createDaVinciClient } = loadModule(native);

    assertDaVinciError(
      await createDaVinciClient(VALID_CONFIG)
        .next({ collectors: [] })
        .catch((e: unknown) => e),
      'DAVINCI_STATE_ERROR',
      'native failure',
    );
  });

  it('propagates native getSession rejection as DaVinciError', async () => {
    const native = createNativeMock({
      getSession: jest.fn(async () => {
        throw nativeError;
      }),
    });
    const { createDaVinciClient } = loadModule(native);

    assertDaVinciError(
      await createDaVinciClient(VALID_CONFIG)
        .user()
        .catch((e: unknown) => e),
      'DAVINCI_STATE_ERROR',
      'native failure',
    );
  });

  it('propagates native refresh rejection as DaVinciError', async () => {
    const native = createNativeMock({
      refresh: jest.fn(async () => {
        throw nativeError;
      }),
    });
    const { createDaVinciClient } = loadModule(native);

    assertDaVinciError(
      await createDaVinciClient(VALID_CONFIG)
        .refresh()
        .catch((e: unknown) => e),
      'DAVINCI_STATE_ERROR',
      'native failure',
    );
  });

  it('propagates native revoke rejection as DaVinciError', async () => {
    const native = createNativeMock({
      revoke: jest.fn(async () => {
        throw nativeError;
      }),
    });
    const { createDaVinciClient } = loadModule(native);

    assertDaVinciError(
      await createDaVinciClient(VALID_CONFIG)
        .revoke()
        .catch((e: unknown) => e),
      'DAVINCI_STATE_ERROR',
      'native failure',
    );
  });

  it('propagates native userinfo rejection as DaVinciError', async () => {
    const native = createNativeMock({
      userinfo: jest.fn(async () => {
        throw nativeError;
      }),
    });
    const { createDaVinciClient } = loadModule(native);

    assertDaVinciError(
      await createDaVinciClient(VALID_CONFIG)
        .userinfo()
        .catch((e: unknown) => e),
      'DAVINCI_STATE_ERROR',
      'native failure',
    );
  });

  it('propagates native logout rejection as DaVinciError', async () => {
    const native = createNativeMock({
      logout: jest.fn(async () => {
        throw nativeError;
      }),
    });
    const { createDaVinciClient } = loadModule(native);

    assertDaVinciError(
      await createDaVinciClient(VALID_CONFIG)
        .logoutUser()
        .catch((e: unknown) => e),
      'DAVINCI_STATE_ERROR',
      'native failure',
    );
  });

  it('propagates native dispose rejection as DaVinciError', async () => {
    const native = createNativeMock({
      dispose: jest.fn(async () => {
        throw nativeError;
      }),
    });
    const { createDaVinciClient } = loadModule(native);
    const client = createDaVinciClient(VALID_CONFIG);
    await client.start();

    assertDaVinciError(
      await client.dispose().catch((e: unknown) => e),
      'DAVINCI_STATE_ERROR',
      'native failure',
    );
  });

  it('propagates native configure rejection as DaVinciError', async () => {
    const configError = {
      type: 'argument_error',
      error: 'DAVINCI_CONFIG_ERROR',
      message: 'bad config',
    };
    const native = createNativeMock({
      configureDaVinci: jest.fn(async () => {
        throw configError;
      }),
    });
    const { createDaVinciClient } = loadModule(native);

    assertDaVinciError(
      await createDaVinciClient(VALID_CONFIG)
        .start()
        .catch((e: unknown) => e),
      'DAVINCI_CONFIG_ERROR',
      'bad config',
    );
  });
});
