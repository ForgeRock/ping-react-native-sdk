/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-davinci
 *
 * Validates that the davinci package:
 * - Exports createDaVinciClient, normalizeCollectors, buildNextInput,
 *   computeFormMeta, resolveExecutionMode, DaVinciProvider, useDaVinci
 * - Throws when required OIDC config fields are missing
 * - Returned client handles expose the correct method surface
 * - start() returns a DaVinciNode with the expected shape
 * - next() advances the flow with key-indexed collector input
 * - user/refresh/revoke/userinfo/logoutUser delegate to native
 * - dispose() cleans up the native instance
 */

export {};

type NativeDaVinciMock = {
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

function makeMock(
  overrides: Partial<NativeDaVinciMock> = {},
): NativeDaVinciMock {
  return {
    configureDaVinci: jest.fn(async () => 'davinci-id-mock'),
    start: jest.fn(async () => ({
      type: 'ContinueNode',
      collectors: [
        {
          key: 'username',
          type: 'TEXT',
          label: 'Username',
          required: true,
          value: '',
        },
        {
          key: 'password',
          type: 'PASSWORD',
          label: 'Password',
          required: true,
          value: '',
        },
        {
          key: 'submit',
          type: 'SUBMIT_BUTTON',
          label: 'Submit',
          required: false,
        },
      ],
    })),
    next: jest.fn(async () => ({
      type: 'SuccessNode',
      session: { value: 'session-token' },
    })),
    getSession: jest.fn(async () => ({ accessToken: 'mock-access-token' })),
    refresh: jest.fn(async () => ({ accessToken: 'mock-refreshed-token' })),
    revoke: jest.fn(async () => true),
    userinfo: jest.fn(async () => ({ sub: 'user-mock' })),
    logout: jest.fn(async () => undefined),
    dispose: jest.fn(async () => undefined),
    ...overrides,
  };
}

async function loadDaVinci(nativeMock: NativeDaVinciMock) {
  jest.resetModules();
  jest.doMock('../../../packages/davinci/src/NativeRNPingDavinci', () => ({
    __esModule: true,
    default: nativeMock,
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@ping-identity/rn-davinci');
}

const VALID_CONFIG = {
  modules: {
    oidc: {
      discoveryEndpoint:
        'https://auth.example.com/.well-known/openid-configuration',
      clientId: 'davinci-client-id',
      redirectUri: 'org.forgerock.demo://oauth2redirect',
      scopes: ['openid', 'profile'],
    },
  },
};

describe('@ping-identity/rn-davinci — integration', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('exports', () => {
    it('exports createDaVinciClient', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(typeof mod.createDaVinciClient).toBe('function');
    });

    it('exports buildNextInput', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(typeof mod.buildNextInput).toBe('function');
    });

    it('exports normalizeCollectors', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(typeof mod.normalizeCollectors).toBe('function');
    });

    it('exports computeFormMeta', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(typeof mod.computeFormMeta).toBe('function');
    });

    it('exports resolveExecutionMode', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(typeof mod.resolveExecutionMode).toBe('function');
    });

    it('exports DaVinciProvider', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(mod.DaVinciProvider).toBeDefined();
    });

    it('exports useDaVinci hook', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(typeof mod.useDaVinci).toBe('function');
    });

    it('exports DaVinciError', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(typeof mod.DaVinciError).toBe('function');
    });
  });

  describe('createDaVinciClient()', () => {
    it('throws when modules.oidc is missing', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(() => mod.createDaVinciClient({})).toThrow(
        /modules\.oidc\.discoveryEndpoint/,
      );
    });

    it('throws when discoveryEndpoint is empty', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(() =>
        mod.createDaVinciClient({
          modules: {
            oidc: {
              discoveryEndpoint: '',
              clientId: 'x',
              redirectUri: 'y',
            },
          },
        }),
      ).toThrow(/discoveryEndpoint/);
    });

    it('throws when clientId is empty', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(() =>
        mod.createDaVinciClient({
          modules: {
            oidc: {
              discoveryEndpoint: 'https://auth.example.com',
              clientId: '',
              redirectUri: 'y',
            },
          },
        }),
      ).toThrow(/clientId/);
    });

    it('throws when redirectUri is empty', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(() =>
        mod.createDaVinciClient({
          modules: {
            oidc: {
              discoveryEndpoint: 'https://auth.example.com',
              clientId: 'x',
              redirectUri: '',
            },
          },
        }),
      ).toThrow(/redirectUri/);
    });

    it('returns a client handle with the expected method surface', async () => {
      const mod = await loadDaVinci(makeMock());
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const methods = [
        'start',
        'next',
        'user',
        'refresh',
        'revoke',
        'userinfo',
        'logoutUser',
        'dispose',
      ];
      for (const m of methods) {
        expect(typeof client[m]).toBe('function');
      }
    });

    it('configure is lazy — does not call native at factory time', async () => {
      const mock = makeMock();
      const mod = await loadDaVinci(mock);
      mod.createDaVinciClient(VALID_CONFIG);
      expect(mock.configureDaVinci).not.toHaveBeenCalled();
    });
  });

  describe('flow', () => {
    it('start() configures lazily and returns a ContinueNode with collectors', async () => {
      const mock = makeMock();
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      expect(mock.configureDaVinci).toHaveBeenCalledTimes(1);
      expect(node.type).toBe('ContinueNode');
      expect(Array.isArray(node.collectors)).toBe(true);
    });

    it('start() does not reconfigure on subsequent calls', async () => {
      const mock = makeMock();
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();
      await client.start();
      expect(mock.configureDaVinci).toHaveBeenCalledTimes(1);
      expect(mock.start).toHaveBeenCalledTimes(2);
    });

    it('next() forwards the key-indexed collector payload to native', async () => {
      const mock = makeMock();
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();
      const input = {
        collectors: [
          { key: 'username', value: 'alice' },
          { key: 'password', value: 'secret' },
          { key: 'submit', value: 'submit' },
        ],
      };
      const node = await client.next(input);
      expect(node.type).toBe('SuccessNode');
      expect(mock.next).toHaveBeenCalledTimes(1);
      expect(mock.next).toHaveBeenCalledWith('davinci-id-mock', input);
    });

    it('user() resolves with the active session', async () => {
      const mock = makeMock();
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();
      const session = await client.user();
      expect(session).toMatchObject({ accessToken: 'mock-access-token' });
    });

    it('user() resolves with null when no session exists', async () => {
      const mock = makeMock({ getSession: jest.fn(async () => null) });
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();
      const session = await client.user();
      expect(session).toBeNull();
    });

    it('refresh() resolves with a refreshed session', async () => {
      const mock = makeMock();
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();
      const session = await client.refresh();
      expect(session).toMatchObject({ accessToken: 'mock-refreshed-token' });
    });

    it('revoke() resolves with a boolean', async () => {
      const mock = makeMock();
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();
      const result = await client.revoke();
      expect(typeof result).toBe('boolean');
    });

    it('userinfo() resolves with the userinfo payload', async () => {
      const mock = makeMock();
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();
      const info = await client.userinfo();
      expect(info).toMatchObject({ sub: 'user-mock' });
    });

    it('logoutUser() resolves without throwing', async () => {
      const mock = makeMock();
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();
      await expect(client.logoutUser()).resolves.toBeUndefined();
      expect(mock.logout).toHaveBeenCalledTimes(1);
    });

    it('dispose() is a no-op when start() has not been called', async () => {
      const mock = makeMock();
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await expect(client.dispose()).resolves.toBeUndefined();
      expect(mock.dispose).not.toHaveBeenCalled();
    });

    it('dispose() cleans up the native instance after use', async () => {
      const mock = makeMock();
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();
      await client.dispose();
      expect(mock.dispose).toHaveBeenCalledTimes(1);
    });

    it('start() after dispose() reconfigures a new native instance', async () => {
      const mock = makeMock({
        configureDaVinci: jest
          .fn()
          .mockResolvedValueOnce('davinci-id-first')
          .mockResolvedValueOnce('davinci-id-second'),
      });
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();
      await client.dispose();
      await client.start();
      expect(mock.configureDaVinci).toHaveBeenCalledTimes(2);
    });
  });

  describe('failure paths', () => {
    it('start() propagates native errors as DaVinciError', async () => {
      const mock = makeMock({
        configureDaVinci: jest.fn(async () => {
          throw new Error('configure failed');
        }),
      });
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await expect(client.start()).rejects.toMatchObject({
        name: 'DaVinciError',
      });
    });

    it('next() propagates native errors as DaVinciError', async () => {
      const mock = makeMock({
        next: jest.fn(async () => {
          throw new Error('next failed');
        }),
      });
      const mod = await loadDaVinci(mock);
      const client = mod.createDaVinciClient(VALID_CONFIG);
      await client.start();
      await expect(client.next({ collectors: [] })).rejects.toMatchObject({
        name: 'DaVinciError',
      });
    });
  });

  describe('normalizeCollectors()', () => {
    it('returns an empty array for an empty input', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(mod.normalizeCollectors([])).toEqual([]);
    });

    it('enriches collectors with executionMode and requiresUserInput', async () => {
      const mod = await loadDaVinci(makeMock());
      const collectors = [
        { key: 'username', type: 'TEXT', label: 'Username', required: true },
        {
          key: 'submit',
          type: 'SUBMIT_BUTTON',
          label: 'Submit',
          required: false,
        },
        { key: 'label', type: 'LABEL', content: 'Hello' },
      ];
      const result = mod.normalizeCollectors(collectors);
      expect(result[0]).toMatchObject({
        executionMode: 'manual',
        requiresUserInput: true,
      });
      expect(result[1]).toMatchObject({
        executionMode: 'immediate',
        requiresUserInput: false,
      });
      expect(result[2]).toMatchObject({
        executionMode: 'output_only',
        requiresUserInput: false,
      });
    });
  });

  describe('resolveExecutionMode()', () => {
    it('classifies manual collector types', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(mod.resolveExecutionMode('TEXT')).toBe('manual');
      expect(mod.resolveExecutionMode('PASSWORD')).toBe('manual');
      expect(mod.resolveExecutionMode('PHONE_NUMBER')).toBe('manual');
    });

    it('classifies immediate / output-only / unsupported types', async () => {
      const mod = await loadDaVinci(makeMock());
      expect(mod.resolveExecutionMode('SUBMIT_BUTTON')).toBe('immediate');
      expect(mod.resolveExecutionMode('LABEL')).toBe('output_only');
      expect(mod.resolveExecutionMode('FUTURE_TYPE')).toBe('unsupported');
    });
  });

  // ─── ContinueNode wire-format — per-collector JS surface ───────────────────
  //
  // The native bridge unit tests (DaVinciNodeMapperTest /
  // DaVinciCollectorValueApplierTest on Android, the iOS twins) already prove
  // each collector class serialises to the documented JS object shape and that
  // user-supplied values are applied back to the right collector field.
  //
  // These tests exercise the JS-side composition layer: given a realistic
  // ContinueNode for each collector type, assert that
  //   1. normalizeCollectors enriches the collector correctly
  //   2. buildNextInput round-trips a user-supplied value into the right key
  //
  // Adding a new collector type to the SDK and forgetting to teach the helpers
  // about it fails here without a device or simulator.

  describe('ContinueNode wire-format — per collector type', () => {
    it('TEXT — round-trips a string value under the collector key', async () => {
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'ContinueNode',
            collectors: [
              {
                key: 'username',
                type: 'TEXT',
                label: 'Username',
                required: true,
                value: '',
                validation: { regex: '^.+$' },
              },
            ],
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      const collectors = mod.normalizeCollectors(node.collectors);
      expect(collectors[0]).toMatchObject({
        executionMode: 'manual',
        requiresUserInput: true,
        validation: { regex: '^.+$' },
      });
      const plan = mod.buildNextInput(node, { username: 'alice' });
      expect(plan.canSubmit).toBe(true);
      expect(plan.input.collectors).toEqual([
        { key: 'username', value: 'alice' },
      ]);
    });

    it('PASSWORD — round-trips a string value and surfaces passwordPolicy', async () => {
      const policy = {
        name: 'Default',
        description: 'Default policy',
        length: { min: 8, max: 64 },
        minCharacters: { '0123456789': 1 },
        maxRepeatedCharacters: 2,
        minUniqueCharacters: 5,
        excludesProfileData: true,
        notSimilarToCurrent: true,
        excludesCommonlyUsed: true,
        maxAgeDays: 90,
        minAgeDays: 1,
        populationCount: 1,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        default: true,
      };
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'ContinueNode',
            collectors: [
              {
                key: 'password',
                type: 'PASSWORD',
                label: 'Password',
                required: true,
                value: '',
                clearPassword: true,
                passwordPolicy: policy,
              },
            ],
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      const collectors = mod.normalizeCollectors(node.collectors);
      expect(collectors[0]).toMatchObject({
        type: 'PASSWORD',
        clearPassword: true,
        passwordPolicy: policy,
      });
      const plan = mod.buildNextInput(node, { password: 's3cret' });
      expect(plan.input.collectors).toEqual([
        { key: 'password', value: 's3cret' },
      ]);
    });

    it('SUBMIT_BUTTON — auto-included in payload with key as value', async () => {
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'ContinueNode',
            collectors: [
              {
                key: 'username',
                type: 'TEXT',
                label: 'Username',
                required: true,
                value: '',
              },
              {
                key: 'submit',
                type: 'SUBMIT_BUTTON',
                label: 'Submit',
                required: false,
              },
            ],
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      const plan = mod.buildNextInput(node, { username: 'alice' });
      expect(plan.input.collectors).toEqual([
        { key: 'username', value: 'alice' },
        { key: 'submit', value: 'submit' },
      ]);
    });

    it('FLOW_BUTTON — buildNextInput(flowKey) sends ONLY the flow key', async () => {
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'ContinueNode',
            collectors: [
              {
                key: 'username',
                type: 'TEXT',
                label: 'Username',
                required: true,
                value: '',
              },
              {
                key: 'forgot',
                type: 'FLOW_BUTTON',
                label: 'Forgot?',
                required: false,
              },
            ],
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      const plan = mod.buildNextInput(
        node,
        { username: 'alice' },
        undefined,
        'forgot',
      );
      expect(plan.input.collectors).toEqual([
        { key: 'forgot', value: 'forgot' },
      ]);
    });

    it('LABEL — output_only and excluded from the payload', async () => {
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'ContinueNode',
            collectors: [
              { key: 'banner', type: 'LABEL', content: 'Welcome back!' },
            ],
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      const collectors = mod.normalizeCollectors(node.collectors);
      expect(collectors[0]).toMatchObject({
        type: 'LABEL',
        content: 'Welcome back!',
        executionMode: 'output_only',
      });
      const plan = mod.buildNextInput(node, {});
      expect(plan.input.collectors).toEqual([]);
    });

    it('SINGLE_SELECT — preserves options[] and round-trips the selected value', async () => {
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'ContinueNode',
            collectors: [
              {
                key: 'colour',
                type: 'SINGLE_SELECT',
                label: 'Colour',
                required: true,
                value: '',
                options: [
                  { label: 'Red', value: 'red' },
                  { label: 'Blue', value: 'blue' },
                ],
              },
            ],
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      const collectors = mod.normalizeCollectors(node.collectors);
      expect(collectors[0]).toMatchObject({
        type: 'SINGLE_SELECT',
        options: [
          { label: 'Red', value: 'red' },
          { label: 'Blue', value: 'blue' },
        ],
      });
      const plan = mod.buildNextInput(node, { colour: 'blue' });
      expect(plan.input.collectors).toEqual([{ key: 'colour', value: 'blue' }]);
    });

    it('MULTI_SELECT — round-trips a string[] value', async () => {
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'ContinueNode',
            collectors: [
              {
                key: 'roles',
                type: 'MULTI_SELECT',
                label: 'Roles',
                required: true,
                value: [],
                options: [
                  { label: 'Admin', value: 'admin' },
                  { label: 'User', value: 'user' },
                ],
              },
            ],
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      const plan = mod.buildNextInput(node, {
        roles: ['admin', 'user'],
      });
      expect(plan.input.collectors).toEqual([
        { key: 'roles', value: ['admin', 'user'] },
      ]);
    });

    it('PHONE_NUMBER — round-trips { countryCode, phoneNumber }', async () => {
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'ContinueNode',
            collectors: [
              {
                key: 'phone',
                type: 'PHONE_NUMBER',
                label: 'Phone',
                required: true,
                defaultCountryCode: 'US',
                validatePhoneNumber: true,
                countryCode: 'US',
                phoneNumber: '',
              },
            ],
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      const collectors = mod.normalizeCollectors(node.collectors);
      expect(collectors[0]).toMatchObject({
        defaultCountryCode: 'US',
        validatePhoneNumber: true,
      });
      const plan = mod.buildNextInput(node, {
        phone: { countryCode: 'GB', phoneNumber: '+447700900123' },
      });
      expect(plan.input.collectors).toEqual([
        {
          key: 'phone',
          value: { countryCode: 'GB', phoneNumber: '+447700900123' },
        },
      ]);
    });

    it('DEVICE_REGISTRATION — exposes devices[] and round-trips a string type value', async () => {
      const devices = [
        {
          type: 'SMS',
          title: 'SMS',
          iconSrc: 'sms.png',
          isDefault: true,
        },
        {
          type: 'EMAIL',
          title: 'Email',
          iconSrc: 'email.png',
        },
      ];
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'ContinueNode',
            collectors: [
              {
                key: 'register',
                type: 'DEVICE_REGISTRATION',
                label: 'Register',
                required: true,
                devices,
              },
            ],
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      const collectors = mod.normalizeCollectors(node.collectors);
      expect(collectors[0]).toMatchObject({
        type: 'DEVICE_REGISTRATION',
        devices,
      });
      const plan = mod.buildNextInput(node, { register: 'SMS' });
      expect(plan.input.collectors).toEqual([
        { key: 'register', value: 'SMS' },
      ]);
    });

    it('DEVICE_AUTHENTICATION — round-trips { type, id, description }', async () => {
      const devices = [
        {
          id: 'device-1',
          type: 'PUSH',
          title: 'Pixel 7',
          description: 'My Pixel',
          iconSrc: 'push.png',
        },
      ];
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'ContinueNode',
            collectors: [
              {
                key: 'auth',
                type: 'DEVICE_AUTHENTICATION',
                label: 'Authenticate',
                required: true,
                devices,
              },
            ],
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      const collectors = mod.normalizeCollectors(node.collectors);
      expect(collectors[0]).toMatchObject({
        type: 'DEVICE_AUTHENTICATION',
        devices,
      });
      const value = {
        type: 'PUSH',
        id: 'device-1',
        description: 'My Pixel',
      };
      const plan = mod.buildNextInput(node, { auth: value });
      expect(plan.input.collectors).toEqual([{ key: 'auth', value }]);
    });

    it('unsupported collector — surfaces a non-blocking issue and excludes from payload', async () => {
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'ContinueNode',
            collectors: [
              {
                key: 'future',
                type: 'FUTURE_TYPE',
                label: 'Future',
                required: false,
              },
              {
                key: 'username',
                type: 'TEXT',
                label: 'Username',
                required: true,
                value: '',
              },
            ],
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      const plan = mod.buildNextInput(node, { username: 'alice' });
      expect(plan.canSubmit).toBe(true);
      expect(plan.issues).toEqual([
        expect.objectContaining({
          code: 'UNSUPPORTED_COLLECTOR',
          key: 'future',
        }),
      ]);
      expect(plan.input.collectors).toEqual([
        { key: 'username', value: 'alice' },
      ]);
    });
  });

  // ─── terminal node shapes ──────────────────────────────────────────────────
  //
  // SuccessNode/ErrorNode/FailureNode pass through the bridge as-is. These
  // tests verify the JS layer surfaces them with the documented shape so
  // consumers can rely on the discriminated union without sniffing.

  describe('terminal node shapes', () => {
    it('SuccessNode surfaces session.value', async () => {
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'SuccessNode',
            session: { value: 'session-tok-1' },
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      expect(node).toEqual({
        type: 'SuccessNode',
        session: { value: 'session-tok-1' },
      });
    });

    it('ErrorNode surfaces message', async () => {
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'ErrorNode',
            message: 'invalid credentials',
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      expect(node).toMatchObject({
        type: 'ErrorNode',
        message: 'invalid credentials',
      });
    });

    it('FailureNode surfaces message', async () => {
      const mod = await loadDaVinci(
        makeMock({
          start: jest.fn(async () => ({
            type: 'FailureNode',
            message: 'unrecoverable',
          })),
        }),
      );
      const client = mod.createDaVinciClient(VALID_CONFIG);
      const node = await client.start();
      expect(node).toMatchObject({
        type: 'FailureNode',
        message: 'unrecoverable',
      });
    });
  });
});
