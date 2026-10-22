/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-recaptcha
 *
 * Validates that the recaptcha package:
 * - Exports createRecaptchaClient and client methods
 * - Forwards journey id + options to native verifyForJourney
 * - Returns the native result unchanged (success and failure variants)
 * - Propagates native rejections to the caller
 * - Validates the Journey instance before calling native
 */

export {};

type NativeRecaptchaMock = {
  verifyForJourney: jest.Mock;
};

type JourneyNode = import('@ping-identity/rn-journey').JourneyNode;
type RecaptchaClient = import('@ping-identity/rn-recaptcha').RecaptchaClient;
type RecaptchaVerifyResult =
  import('@ping-identity/rn-recaptcha').RecaptchaVerifyResult;

const VALID_JOURNEY_CONFIG = {
  serverUrl: 'https://openam.example.com/openam',
  realmPath: '/alpha',
  tree: 'RN-ReCaptcha',
};

// Raw callback payload shape served by a reCAPTCHA Enterprise node.
const RECAPTCHA_CALLBACK_NODE: JourneyNode = {
  type: 'ContinueNode',
  callbacks: [
    {
      type: 'ReCaptchaEnterpriseCallback',
      raw: {
        type: 'ReCaptchaEnterpriseCallback',
        output: [{ name: 'recaptchaSiteKey', value: '6Lc-test-site-key' }],
        input: [
          { name: 'IDToken1token', value: '' },
          { name: 'IDToken1action', value: '' },
          { name: 'IDToken1clientError', value: '' },
          { name: 'IDToken1payload', value: '{}' },
        ],
      },
    },
  ],
};

function makeRecaptchaMock(
  overrides: Partial<NativeRecaptchaMock> = {},
): NativeRecaptchaMock {
  return {
    verifyForJourney: jest.fn(async () => ({
      type: 'success',
      token: 'mock-recaptcha-token',
    })),
    ...overrides,
  };
}

async function loadRecaptcha(nativeMock: NativeRecaptchaMock) {
  jest.resetModules();
  jest.doMock('../../../packages/recaptcha/src/NativeRNPingRecaptcha', () => ({
    __esModule: true,
    getNativeModule: jest.fn(() => nativeMock),
    toNativeVerifyOptions: jest.fn((options: unknown) => options),
    toNativeClientConfig: jest.fn((config: unknown) => config),
    fromNativeVerifyResult: jest.fn((result: unknown) => result),
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@ping-identity/rn-recaptcha');
}

function makeJourneyMock(startNode: JourneyNode): {
  configureJourney: jest.Mock;
  start: jest.Mock;
  next: jest.Mock;
} {
  return {
    configureJourney: jest.fn(async () => 'journey-id-recaptcha'),
    start: jest.fn(async () => startNode),
    next: jest.fn(async () => ({ type: 'SuccessNode' })),
  };
}

async function loadJourneyAndRecaptcha(
  startNode: JourneyNode,
  nativeRecaptchaMock: NativeRecaptchaMock,
): Promise<{
  journey: typeof import('@ping-identity/rn-journey');
  recaptchaClient: RecaptchaClient;
  nativeJourneyMock: ReturnType<typeof makeJourneyMock>;
}> {
  const nativeJourneyMock = makeJourneyMock(startNode);
  jest.resetModules();
  jest.doMock('../../../packages/journey/src/NativeRNPingJourney', () => ({
    __esModule: true,
    default: nativeJourneyMock,
  }));
  jest.doMock('../../../packages/recaptcha/src/NativeRNPingRecaptcha', () => ({
    __esModule: true,
    getNativeModule: jest.fn(() => nativeRecaptchaMock),
    toNativeVerifyOptions: jest.fn((options: unknown) => options),
    toNativeClientConfig: jest.fn((config: unknown) => config),
    fromNativeVerifyResult: jest.fn((result: unknown) => result),
  }));

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const journey = require('@ping-identity/rn-journey');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const recaptcha = require('@ping-identity/rn-recaptcha');
  const recaptchaClient = recaptcha.createRecaptchaClient();
  return { journey, recaptchaClient, nativeJourneyMock };
}

describe('@ping-identity/rn-recaptcha — integration', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('exports', () => {
    it('exports createRecaptchaClient and RecaptchaError', async () => {
      const mod = await loadRecaptcha(makeRecaptchaMock());
      expect(typeof mod.createRecaptchaClient).toBe('function');
      expect(typeof mod.RecaptchaError).toBe('function');
      expect(typeof mod.recaptchaErrorCodes).toBe('object');
    });

    it('createRecaptchaClient exposes verifyForJourney', async () => {
      const mod = await loadRecaptcha(makeRecaptchaMock());
      const recaptcha = mod.createRecaptchaClient();
      expect(typeof recaptcha.verifyForJourney).toBe('function');
    });
  });

  describe('verifyForJourney()', () => {
    it('calls native verifyForJourney with journey id, options, and config', async () => {
      const mock = makeRecaptchaMock();
      const mod = await loadRecaptcha(mock);
      const recaptcha = mod.createRecaptchaClient();
      const journey = { getId: jest.fn(async () => 'journey-123') };
      const result = await recaptcha.verifyForJourney(journey, {
        index: 0,
        action: 'login',
        timeoutMs: 15000,
      });
      expect(journey.getId).toHaveBeenCalledTimes(1);
      expect(mock.verifyForJourney).toHaveBeenCalledWith(
        'journey-123',
        { index: 0, action: 'login', timeoutMs: 15000 },
        { loggerId: undefined },
      );
      expect(result).toEqual({
        type: 'success',
        token: 'mock-recaptcha-token',
      });
    });

    it('forwards optional payload in options', async () => {
      const mock = makeRecaptchaMock();
      const mod = await loadRecaptcha(mock);
      const recaptcha = mod.createRecaptchaClient();
      const journey = { getId: jest.fn(async () => 'journey-456') };
      await recaptcha.verifyForJourney(journey, {
        index: 2,
        payload: { risk: 'low' },
      });
      expect(mock.verifyForJourney).toHaveBeenCalledWith(
        'journey-456',
        { index: 2, payload: { risk: 'low' } },
        { loggerId: undefined },
      );
    });

    it('returns the native failure variant unchanged (no throw)', async () => {
      const mock = makeRecaptchaMock({
        verifyForJourney: jest.fn(async () => ({
          type: 'failure',
          code: 'NETWORK_ERROR',
          message: 'Verification request failed.',
        })),
      });
      const mod = await loadRecaptcha(mock);
      const recaptcha = mod.createRecaptchaClient();
      const journey = { getId: jest.fn(async () => 'journey-789') };
      const result: RecaptchaVerifyResult =
        await recaptcha.verifyForJourney(journey);
      expect(result).toEqual({
        type: 'failure',
        code: 'NETWORK_ERROR',
        message: 'Verification request failed.',
      });
    });

    it('propagates native rejection (callback not found) as RecaptchaError', async () => {
      const mock = makeRecaptchaMock({
        verifyForJourney: jest.fn(async () => {
          throw {
            error: 'RECAPTCHA_CALLBACK_NOT_FOUND',
            message: 'No active ReCaptchaEnterpriseCallback at index 0.',
            type: 'state_error',
          };
        }),
      });
      const mod = await loadRecaptcha(mock);
      const recaptcha = mod.createRecaptchaClient();
      const journey = { getId: jest.fn(async () => 'journey-000') };
      await expect(recaptcha.verifyForJourney(journey)).rejects.toMatchObject({
        name: 'RecaptchaError',
        code: 'RECAPTCHA_CALLBACK_NOT_FOUND',
        type: 'state_error',
      });
    });

    it('validates the journey instance before calling native', async () => {
      const mock = makeRecaptchaMock();
      const mod = await loadRecaptcha(mock);
      const recaptcha = mod.createRecaptchaClient();
      await expect(
        (
          recaptcha as unknown as {
            verifyForJourney(journey: unknown): Promise<unknown>;
          }
        ).verifyForJourney(null),
      ).rejects.toMatchObject({
        name: 'RecaptchaError',
        type: 'argument_error',
      });
      expect(mock.verifyForJourney).not.toHaveBeenCalled();
    });
  });

  describe('ReCaptchaEnterpriseCallback journey orchestration', () => {
    it('verifies the callback field by typeIndex and advances with next()', async () => {
      const { journey, recaptchaClient, nativeJourneyMock } =
        await loadJourneyAndRecaptcha(
          RECAPTCHA_CALLBACK_NODE,
          makeRecaptchaMock(),
        );

      const client = journey.createJourneyClient(VALID_JOURNEY_CONFIG);
      await client.init();
      const node = await client.start('RN-ReCaptcha');
      expect(node.type).toBe('ContinueNode');

      // Mirror the useJourneyForm handoff: the ReCaptchaEnterpriseCallback is
      // claimed via handledCallbackTypes, so buildNextInput emits no entry for
      // it and the caller advances with an empty input.
      await recaptchaClient.verifyForJourney(client, { index: 0 });
      await client.next({});

      expect(nativeJourneyMock.next).toHaveBeenCalledWith(
        'journey-id-recaptcha',
        '',
        {},
      );
    });

    it('continues the journey after a failure result (client error recorded natively)', async () => {
      const nativeRecaptchaMock = makeRecaptchaMock({
        verifyForJourney: jest.fn(async () => ({
          type: 'failure',
          code: 'NETWORK_ERROR',
          message: 'Verification request failed.',
        })),
      });
      const { journey, recaptchaClient, nativeJourneyMock } =
        await loadJourneyAndRecaptcha(
          RECAPTCHA_CALLBACK_NODE,
          nativeRecaptchaMock,
        );

      const client = journey.createJourneyClient(VALID_JOURNEY_CONFIG);
      await client.init();
      const node = await client.start('RN-ReCaptcha');
      if (node.type !== 'ContinueNode') {
        throw new Error('Expected ContinueNode');
      }

      const result = await recaptchaClient.verifyForJourney(client, {
        index: 0,
      });
      if (result.type !== 'failure') {
        throw new Error('Expected failure result');
      }
      // The failure variant is a resolution: the callback inputs already carry
      // the client error, so the flow advances with an empty input.
      await client.next({});

      expect(result.code).toBe('NETWORK_ERROR');
      expect(nativeJourneyMock.next).toHaveBeenCalledWith(
        'journey-id-recaptcha',
        '',
        {},
      );
    });
  });
});
