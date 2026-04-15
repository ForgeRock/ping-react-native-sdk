/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-journey
 *
 * Validates that the journey package:
 * - Exports createJourneyClient, buildNextInput, normalizeCallbacks
 * - Throws when serverUrl is missing
 * - Returned client handles expose the correct method surface
 * - start() returns a JourneyNode with expected shape
 * - next() advances the journey
 * - resume() resumes from a URL
 * - user/getSession/revoke/logout delegate to native
 * - dispose() cleans up the native instance
 */

export {};

type NativeJourneyMock = {
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

function makeMock(overrides: Partial<NativeJourneyMock> = {}): NativeJourneyMock {
  return {
    configureJourney: jest.fn(async () => 'journey-id-mock'),
    start: jest.fn(async () => ({ id: 'n1', type: 'ContinueNode', callbacks: [] })),
    next: jest.fn(async () => ({ id: 'n2', type: 'SuccessNode' })),
    resume: jest.fn(async () => ({ id: 'n3', type: 'ContinueNode', callbacks: [] })),
    getSession: jest.fn(async () => ({ accessToken: 'mock-access-token' })),
    refresh: jest.fn(async () => ({ accessToken: 'mock-refreshed-token' })),
    revoke: jest.fn(async () => true),
    userinfo: jest.fn(async () => ({ sub: 'user-mock' })),
    ssoToken: jest.fn(async () => ({
      value: 'sso-mock',
      successUrl: '/enduser',
      realm: '/alpha',
    })),
    logout: jest.fn(async () => true),
    dispose: jest.fn(async () => undefined),
    ...overrides,
  };
}

async function loadJourney(nativeMock: NativeJourneyMock) {
  jest.resetModules();
  jest.doMock('../../../packages/journey/src/NativeRNPingJourney', () => ({
    __esModule: true,
    default: nativeMock,
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@ping-identity/rn-journey');
}

const VALID_CONFIG = {
  serverUrl: 'https://openam.example.com/openam',
  realmPath: '/alpha',
  tree: 'Login',
};

describe('@ping-identity/rn-journey — integration', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('exports', () => {
    it('exports createJourneyClient', async () => {
      const mod = await loadJourney(makeMock());
      expect(typeof mod.createJourneyClient).toBe('function');
    });

    it('exports buildNextInput', async () => {
      const mod = await loadJourney(makeMock());
      expect(typeof mod.buildNextInput).toBe('function');
    });

    it('exports normalizeCallbacks', async () => {
      const mod = await loadJourney(makeMock());
      expect(typeof mod.normalizeCallbacks).toBe('function');
    });

    it('exports JourneyProvider', async () => {
      const mod = await loadJourney(makeMock());
      expect(mod.JourneyProvider).toBeDefined();
    });

    it('exports useJourney hook', async () => {
      const mod = await loadJourney(makeMock());
      expect(typeof mod.useJourney).toBe('function');
    });
  });

  describe('createJourneyClient()', () => {
    it('throws when serverUrl is empty', async () => {
      const mod = await loadJourney(makeMock());
      expect(() =>
        mod.createJourneyClient({ serverUrl: '' })
      ).toThrow('[@ping-identity/rn-journey] Missing configuration. Provide a non-empty serverUrl.');
    });

    it('throws when serverUrl is missing', async () => {
      const mod = await loadJourney(makeMock());
      expect(() =>
        mod.createJourneyClient({})
      ).toThrow();
    });

    it('returns a client handle with the expected method surface', async () => {
      const mod = await loadJourney(makeMock());
      const client = mod.createJourneyClient(VALID_CONFIG);
      const methods = [
        'init', 'getId', 'start', 'next', 'resume',
        'user', 'refresh', 'revoke', 'userinfo', 'ssoToken', 'logoutUser', 'dispose',
      ];
      for (const m of methods) {
        expect(typeof client[m]).toBe('function');
      }
    });
  });

  describe('journey flow', () => {
    it('init() initialises the native journey and returns an id', async () => {
      const mock = makeMock();
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      const id = await client.init();
      expect(typeof id).toBe('string');
      expect(mock.configureJourney).toHaveBeenCalledTimes(1);
    });

    it('start() returns a ContinueNode with callbacks array', async () => {
      const mock = makeMock();
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      await client.init();
      const node = await client.start('Login');
      expect(node.type).toBe('ContinueNode');
      expect(Array.isArray(node.callbacks)).toBe(true);
    });

    it('next() advances the journey and returns the next node', async () => {
      const mock = makeMock();
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      await client.init();
      await client.start('Login');
      const next = await client.next({ callbacks: [] });
      expect(next).toBeDefined();
      expect(mock.next).toHaveBeenCalledTimes(1);
    });

    it('resume() resumes from a redirect URL', async () => {
      const mock = makeMock();
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      await client.init();
      const node = await client.resume('https://example.com/callback?code=abc');
      expect(node).toBeDefined();
      expect(mock.resume).toHaveBeenCalledTimes(1);
    });

    it('revoke() resolves with a boolean', async () => {
      const mock = makeMock();
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      await client.init();
      const result = await client.revoke();
      expect(typeof result).toBe('boolean');
    });

    it('logoutUser() resolves with a boolean', async () => {
      const mock = makeMock();
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      await client.init();
      const result = await client.logoutUser();
      expect(typeof result).toBe('boolean');
    });

    it('user() resolves with the active session', async () => {
      const mock = makeMock();
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      await client.init();
      const session = await client.user();
      expect(session).toMatchObject({ accessToken: 'mock-access-token' });
    });

    it('user() resolves with null when no session exists', async () => {
      const mock = makeMock({ getSession: jest.fn(async () => null) });
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      await client.init();
      const session = await client.user();
      expect(session).toBeNull();
    });

    it('userinfo() resolves with the userinfo payload', async () => {
      const mock = makeMock();
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      await client.init();
      const info = await client.userinfo();
      expect(info).toMatchObject({ sub: 'user-mock' });
    });

    it('ssoToken() resolves with the SSO token payload', async () => {
      const mock = makeMock();
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      await client.init();
      const token = await client.ssoToken();
      expect(token).toMatchObject({ value: 'sso-mock' });
    });

    it('dispose() cleans up the native instance', async () => {
      const mock = makeMock();
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      await client.init();
      await expect(client.dispose()).resolves.not.toThrow();
      expect(mock.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe('failure paths', () => {
    it('start() propagates native errors', async () => {
      const mock = makeMock({
        start: jest.fn(async () => { throw new Error('Journey start failed'); }),
      });
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      await client.init();
      await expect(client.start('Login')).rejects.toThrow('Journey start failed');
    });

    it('next() propagates native errors', async () => {
      const mock = makeMock({
        next: jest.fn(async () => { throw new Error('Journey next failed'); }),
      });
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      await client.init();
      await client.start('Login');
      await expect(client.next({ callbacks: [] })).rejects.toThrow('Journey next failed');
    });

    it('resume() propagates native errors', async () => {
      const mock = makeMock({
        resume: jest.fn(async () => { throw new Error('Journey resume failed'); }),
      });
      const mod = await loadJourney(mock);
      const client = mod.createJourneyClient(VALID_CONFIG);
      await client.init();
      await expect(client.resume('myapp://callback')).rejects.toThrow('Journey resume failed');
    });
  });

  describe('normalizeCallbacks()', () => {
    it('returns an array from an empty callbacks input', async () => {
      const mod = await loadJourney(makeMock());
      const result = mod.normalizeCallbacks([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns normalized fields for a simple node', async () => {
      const mod = await loadJourney(makeMock());
      const node = {
        type: 'ContinueNode',
        callbacks: [
          { type: 'NameCallback', output: [] },
          { type: 'PasswordCallback', output: [] },
        ],
      };
      const fields = mod.normalizeCallbacks(node);
      expect(fields).toHaveLength(2);
      expect(fields[0]).toMatchObject({ id: 'NameCallback:0', ref: { type: 'NameCallback' } });
      expect(fields[1]).toMatchObject({ id: 'PasswordCallback:0', ref: { type: 'PasswordCallback' } });
    });
  });
});
