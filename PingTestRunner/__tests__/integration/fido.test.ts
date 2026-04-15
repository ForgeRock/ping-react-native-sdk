/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-fido
 *
 * Validates that the fido package:
 * - Exports createFidoClient and client methods
 * - Forwards options to native registerCredential / authenticateCredential
 * - Returns the native result unchanged
 * - Propagates native rejections to the caller
 */

export {};

type NativeFidoMock = {
  registerCredential: jest.Mock;
  authenticateCredential: jest.Mock;
  registerCredentialForJourney: jest.Mock;
  authenticateCredentialForJourney: jest.Mock;
};

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

type JourneyClient = import('@ping-identity/rn-journey').JourneyClient;
type JourneyNode = import('@ping-identity/rn-journey').JourneyNode;
type FidoClient = import('@ping-identity/rn-fido').FidoClient;

function makeMock(overrides: Partial<NativeFidoMock> = {}): NativeFidoMock {
  return {
    registerCredential: jest.fn(async () => ({
      credentialId: 'mock-credential-id',
    })),
    authenticateCredential: jest.fn(async () => ({
      signature: 'mock-signature',
    })),
    registerCredentialForJourney: jest.fn(async () => ({ type: 'success' })),
    authenticateCredentialForJourney: jest.fn(async () => ({
      type: 'success',
    })),
    ...overrides,
  };
}

async function loadFido(nativeMock: NativeFidoMock) {
  jest.resetModules();
  jest.doMock('../../../packages/fido/src/NativeRNPingFido', () => ({
    __esModule: true,
    getNativeModule: jest.fn(() => nativeMock),
    toNativeConfigOptions: jest.fn((options: unknown) => options),
    toNativeRegistrationOptions: jest.fn((options: unknown) => options),
    toNativeAuthenticationOptions: jest.fn((options: unknown) => options),
    fromNativeRegistrationResult: jest.fn((result: unknown) => result),
    fromNativeAuthenticationResult: jest.fn((result: unknown) => result),
    toNativeJourneyRegistrationOptions: jest.fn((options: unknown) => options),
    toNativeJourneyAuthenticationOptions: jest.fn(
      (options: unknown) => options,
    ),
    fromNativeJourneyResult: jest.fn((result: unknown) => result),
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@ping-identity/rn-fido');
}

function makeJourneyMock(startNode: JourneyNode): NativeJourneyMock {
  return {
    configureJourney: jest.fn(async () => 'journey-id-rn-webauthn'),
    start: jest.fn(async () => startNode),
    next: jest.fn(async () => ({ type: 'SuccessNode' })),
    resume: jest.fn(async () => ({ type: 'ContinueNode', callbacks: [] })),
    getSession: jest.fn(async () => null),
    refresh: jest.fn(async () => null),
    revoke: jest.fn(async () => true),
    userinfo: jest.fn(async () => null),
    ssoToken: jest.fn(async () => null),
    logout: jest.fn(async () => true),
    dispose: jest.fn(async () => undefined),
  };
}

async function loadJourneyAndFido(
  nativeJourneyMock: NativeJourneyMock,
  nativeFidoMock: NativeFidoMock,
): Promise<{
  journey: typeof import('@ping-identity/rn-journey');
  fidoClient: FidoClient;
}> {
  jest.resetModules();
  jest.doMock('../../../packages/journey/src/NativeRNPingJourney', () => ({
    __esModule: true,
    default: nativeJourneyMock,
  }));
  jest.doMock('../../../packages/fido/src/NativeRNPingFido', () => ({
    __esModule: true,
    getNativeModule: jest.fn(() => nativeFidoMock),
    toNativeConfigOptions: jest.fn((options: unknown) => options),
    toNativeRegistrationOptions: jest.fn((options: unknown) => options),
    toNativeAuthenticationOptions: jest.fn((options: unknown) => options),
    fromNativeRegistrationResult: jest.fn((result: unknown) => result),
    fromNativeAuthenticationResult: jest.fn((result: unknown) => result),
    toNativeJourneyRegistrationOptions: jest.fn((options: unknown) => options),
    toNativeJourneyAuthenticationOptions: jest.fn(
      (options: unknown) => options,
    ),
    fromNativeJourneyResult: jest.fn((result: unknown) => result),
  }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const journey = require('@ping-identity/rn-journey');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fido = require('@ping-identity/rn-fido');
  const fidoClient = fido.createFidoClient();
  return { journey, fidoClient };
}

function getTypeIndexMap(
  callbacks: Array<{ type?: string }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  const indices: Record<string, number> = {};
  callbacks.forEach((callback, callbackIndex) => {
    const type = callback.type ?? '';
    const typeIndex = counts[type] ?? 0;
    counts[type] = typeIndex + 1;
    indices[String(callbackIndex)] = typeIndex;
  });
  return indices;
}

async function executeRNWebAuthnStep(
  node: JourneyNode,
  client: JourneyClient,
  fido: FidoClient,
  options: { registrationDeviceName?: string } = {},
): Promise<JourneyNode> {
  if (node.type !== 'ContinueNode' || !Array.isArray(node.callbacks)) {
    return node;
  }

  const perCallbackTypeIndex = getTypeIndexMap(node.callbacks);
  let hasFidoCallback = false;

  for (const [callbackIndex, callback] of node.callbacks.entries()) {
    const typeIndex = perCallbackTypeIndex[String(callbackIndex)] ?? 0;
    if (callback.type === 'FidoRegistrationCallback') {
      hasFidoCallback = true;
      await fido.registerForJourney(client, {
        index: typeIndex,
        ...(options.registrationDeviceName
          ? { deviceName: options.registrationDeviceName }
          : {}),
      });
      continue;
    }

    if (callback.type === 'FidoAuthenticationCallback') {
      hasFidoCallback = true;
      try {
        await fido.authenticateForJourney(client, { index: typeIndex });
      } catch (error) {
        const code = (error as { code?: unknown })?.code;
        if (code !== 'FIDO_AUTHENTICATE_CANCELLED') {
          throw error;
        }
      }
    }
  }

  return client.next(hasFidoCallback ? {} : { callbacks: [] });
}

const VALID_JOURNEY_CONFIG = {
  serverUrl: 'https://openam.example.com/openam',
  realmPath: '/alpha',
  tree: 'RN-WebAuthn',
};

describe('@ping-identity/rn-fido — integration', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('exports', () => {
    it('exports createFidoClient', async () => {
      const mod = await loadFido(makeMock());
      expect(typeof mod.createFidoClient).toBe('function');
    });

    it('createFidoClient exposes register/authenticate methods', async () => {
      const mod = await loadFido(makeMock());
      const fido = mod.createFidoClient();
      expect(typeof fido.register).toBe('function');
      expect(typeof fido.authenticate).toBe('function');
      expect(typeof fido.registerForJourney).toBe('function');
      expect(typeof fido.authenticateForJourney).toBe('function');
    });
  });

  describe('register()', () => {
    it('calls native registerCredential with the provided options', async () => {
      const mock = makeMock();
      const mod = await loadFido(mock);
      const fido = mod.createFidoClient();
      const options = {
        challenge: 'abc',
        rp: { id: 'example.com', name: 'Example' },
      };
      await fido.register(options);
      expect(mock.registerCredential).toHaveBeenCalledWith(options, {
        loggerId: undefined,
        useFido2Client: undefined,
      });
    });

    it('returns the native result', async () => {
      const mod = await loadFido(makeMock());
      const fido = mod.createFidoClient();
      const result = await fido.register({ challenge: 'abc' });
      expect(result).toEqual({ credentialId: 'mock-credential-id' });
    });

    it('propagates native rejection to the caller', async () => {
      const nativeError = {
        code: 'FIDO_REGISTER_ERROR',
        message: 'Registration failed.',
      };
      const mock = makeMock({
        registerCredential: jest.fn(async () => {
          throw nativeError;
        }),
      });
      const mod = await loadFido(mock);
      const fido = mod.createFidoClient();
      await expect(fido.register({ challenge: 'abc' })).rejects.toEqual(
        nativeError,
      );
    });

    it('propagates window unavailable error', async () => {
      const nativeError = {
        code: 'FIDO_WINDOW_UNAVAILABLE',
        message: 'No active window.',
      };
      const mock = makeMock({
        registerCredential: jest.fn(async () => {
          throw nativeError;
        }),
      });
      const mod = await loadFido(mock);
      const fido = mod.createFidoClient();
      await expect(fido.register({ challenge: 'abc' })).rejects.toMatchObject({
        code: 'FIDO_WINDOW_UNAVAILABLE',
      });
    });
  });

  describe('authenticate()', () => {
    it('calls native authenticateCredential with the provided options', async () => {
      const mock = makeMock();
      const mod = await loadFido(mock);
      const fido = mod.createFidoClient();
      const options = {
        challenge: 'def',
        rpId: 'example.com',
        allowCredentials: [],
      };
      await fido.authenticate(options);
      expect(mock.authenticateCredential).toHaveBeenCalledWith(options, {
        loggerId: undefined,
        useFido2Client: undefined,
      });
    });

    it('returns the native result', async () => {
      const mod = await loadFido(makeMock());
      const fido = mod.createFidoClient();
      const result = await fido.authenticate({ challenge: 'def' });
      expect(result).toEqual({ signature: 'mock-signature' });
    });

    it('propagates native rejection to the caller', async () => {
      const nativeError = {
        code: 'FIDO_AUTHENTICATE_ERROR',
        message: 'Authentication failed.',
      };
      const mock = makeMock({
        authenticateCredential: jest.fn(async () => {
          throw nativeError;
        }),
      });
      const mod = await loadFido(mock);
      const fido = mod.createFidoClient();
      await expect(fido.authenticate({ challenge: 'def' })).rejects.toEqual(
        nativeError,
      );
    });

    it('propagates activity unavailable error', async () => {
      const nativeError = {
        code: 'FIDO_ACTIVITY_UNAVAILABLE',
        message: 'No foreground activity.',
      };
      const mock = makeMock({
        authenticateCredential: jest.fn(async () => {
          throw nativeError;
        }),
      });
      const mod = await loadFido(mock);
      const fido = mod.createFidoClient();
      await expect(
        fido.authenticate({ challenge: 'def' }),
      ).rejects.toMatchObject({
        code: 'FIDO_ACTIVITY_UNAVAILABLE',
      });
    });
  });

  describe('registerForJourney()', () => {
    it('calls native registerCredentialForJourney with journey id and options', async () => {
      const mock = makeMock();
      const mod = await loadFido(mock);
      const fido = mod.createFidoClient();
      const journey = { getId: jest.fn(async () => 'journey-123') };
      await fido.registerForJourney(journey, {
        index: 1,
        deviceName: 'Device A',
      });
      expect(journey.getId).toHaveBeenCalledTimes(1);
      expect(mock.registerCredentialForJourney).toHaveBeenCalledWith(
        'journey-123',
        {
          index: 1,
          deviceName: 'Device A',
        },
        {
          loggerId: undefined,
          useFido2Client: undefined,
        },
      );
    });
  });

  describe('authenticateForJourney()', () => {
    it('calls native authenticateCredentialForJourney with journey id and options', async () => {
      const mock = makeMock();
      const mod = await loadFido(mock);
      const fido = mod.createFidoClient();
      const journey = { getId: jest.fn(async () => 'journey-456') };
      await fido.authenticateForJourney(journey, { index: 0 });
      expect(journey.getId).toHaveBeenCalledTimes(1);
      expect(mock.authenticateCredentialForJourney).toHaveBeenCalledWith(
        'journey-456',
        {
          index: 0,
        },
        {
          loggerId: undefined,
          useFido2Client: undefined,
        },
      );
    });
  });

  describe('RN-WebAuthn Journey orchestration', () => {
    it('runs registration callback explicitly and advances with next({})', async () => {
      const startNode: JourneyNode = {
        type: 'ContinueNode',
        callbacks: [
          { type: 'FidoRegistrationCallback', output: [] },
          { type: 'HiddenValueCallback', output: [], value: 'false' },
        ],
      };
      const nativeJourneyMock = makeJourneyMock(startNode);
      const nativeFidoMock = makeMock();
      const { journey, fidoClient } = await loadJourneyAndFido(
        nativeJourneyMock,
        nativeFidoMock,
      );

      const client = journey.createJourneyClient(VALID_JOURNEY_CONFIG);
      await client.init();
      const node = await client.start('RN-WebAuthn');
      await executeRNWebAuthnStep(node, client, fidoClient, {
        registrationDeviceName: 'SM-A566W',
      });

      expect(nativeFidoMock.registerCredentialForJourney).toHaveBeenCalledWith(
        'journey-id-rn-webauthn',
        { index: 0, deviceName: 'SM-A566W' },
        {
          loggerId: undefined,
          useFido2Client: undefined,
        },
      );
      expect(nativeJourneyMock.next).toHaveBeenCalledWith(
        'journey-id-rn-webauthn',
        '',
        {},
      );
    });

    it('continues the journey after authentication cancellation', async () => {
      const startNode: JourneyNode = {
        type: 'ContinueNode',
        callbacks: [{ type: 'FidoAuthenticationCallback', output: [] }],
      };
      const nativeJourneyMock = makeJourneyMock(startNode);
      const nativeFidoMock = makeMock({
        authenticateCredentialForJourney: jest.fn(async () => {
          throw {
            code: 'FIDO_AUTHENTICATE_CANCELLED',
            message: 'Cancelled by user',
          };
        }),
      });
      const { journey, fidoClient } = await loadJourneyAndFido(
        nativeJourneyMock,
        nativeFidoMock,
      );

      const client = journey.createJourneyClient(VALID_JOURNEY_CONFIG);
      await client.init();
      const node = await client.start('RN-WebAuthn');
      await executeRNWebAuthnStep(node, client, fidoClient);

      expect(
        nativeFidoMock.authenticateCredentialForJourney,
      ).toHaveBeenCalledWith(
        'journey-id-rn-webauthn',
        { index: 0 },
        {
          loggerId: undefined,
          useFido2Client: undefined,
        },
      );
      expect(nativeJourneyMock.next).toHaveBeenCalledWith(
        'journey-id-rn-webauthn',
        '',
        {},
      );
    });
  });
});
