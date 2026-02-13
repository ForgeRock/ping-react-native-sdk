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
    const { journey } = await loadModule(native);

    expect(() =>
      journey({
        serverUrl: '',
      })
    ).toThrow('[@ping-identity/rn-journey] Missing configuration. Provide a non-empty serverUrl.');
  });

  it('passes storage and logger ids to configureJourney', async () => {
    const native = createNativeMock();
    const { journey } = await loadModule(native);

    const client = journey(
      {
        serverUrl: 'https://example.com',
        logger: {
          nativeHandle: { id: 'logger-id' },
          changeLevel: jest.fn(),
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        },
      },
      {
        session: {
          storage: {
            id: 'session-storage-id',
          },
        },
      }
    );

    await client.init();

    expect(native.configureJourney).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionStorageId: 'session-storage-id',
        loggerId: 'logger-id',
      })
    );
  });

  it('configures only once and reuses native id', async () => {
    const native = createNativeMock();
    const { journey } = await loadModule(native);
    const client = journey({ serverUrl: 'https://example.com' });

    const idA = await client.init();
    const idB = await client.getId();

    expect(idA).toBe('journey-id-1');
    expect(idB).toBe('journey-id-1');
    expect(native.configureJourney).toHaveBeenCalledTimes(1);
  });

  it('passes start options and journey name to native start', async () => {
    const native = createNativeMock();
    const { journey } = await loadModule(native);
    const client = journey({ serverUrl: 'https://example.com' });

    await client.start('Login', { forceAuth: true, noSession: true });

    expect(native.start).toHaveBeenCalledWith(
      'journey-id-1',
      'Login',
      { forceAuth: true, noSession: true }
    );
  });

  it('throws argument error when start journey name is empty', async () => {
    const native = createNativeMock();
    const { journey } = await loadModule(native);
    const client = journey({ serverUrl: 'https://example.com' });

    await expect(client.start('   ')).rejects.toMatchObject({
      type: 'argument_error',
      error: 'JOURNEY_START_ERROR',
    });
  });

  it('calls native next with placeholder node id and input payload', async () => {
    const native = createNativeMock();
    const { journey } = await loadModule(native);
    const client = journey({ serverUrl: 'https://example.com' });

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
    const { journey } = await loadModule(native);
    const client = journey({ serverUrl: 'https://example.com' });

    await expect(client.resume('   ')).rejects.toMatchObject({
      type: 'argument_error',
      error: 'JOURNEY_RESUME_ERROR',
    });
  });

  it('forwards user and logout calls to native', async () => {
    const native = createNativeMock();
    const { journey } = await loadModule(native);
    const client = journey({ serverUrl: 'https://example.com' });

    const session = await client.user();
    const didLogout = await client.logoutUser();

    expect(session).toEqual({ accessToken: 'token' });
    expect(didLogout).toBe(true);
    expect(native.getSession).toHaveBeenCalledWith('journey-id-1');
    expect(native.logout).toHaveBeenCalledWith('journey-id-1');
  });

  it('disposes native journey instance and clears cached id', async () => {
    const native = createNativeMock();
    const { journey } = await loadModule(native);
    const client = journey({ serverUrl: 'https://example.com' });

    await client.init();
    await client.dispose();
    await client.init();

    expect(native.dispose).toHaveBeenCalledWith('journey-id-1');
    expect(native.configureJourney).toHaveBeenCalledTimes(2);
  });
});
