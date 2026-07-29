/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-external-idp
 *
 * Validates that the external-idp bridge layer:
 * - Exports createExternalIdpClient and the returned client methods
 * - Validates redirectUri at factory creation time
 * - Resolves the journey id and forwards it to the native module
 * - Forwards options and config (including loggerId) to the native module
 * - Returns the native result unchanged
 * - Propagates native rejections to the caller
 * - Validates the provider argument before calling native
 *
 * Native iOS/Android SDK behaviour is not exercised here — the native module
 * is fully mocked so only the JS bridge layer is under test.
 */

export {};

type NativeExternalIdpMock = {
  authorizeForJourney: jest.Mock;
  selectProviderForJourney: jest.Mock;
  authorizeForDaVinci: jest.Mock;
};

function makeMock(
  overrides: Partial<NativeExternalIdpMock> = {},
): NativeExternalIdpMock {
  return {
    authorizeForJourney: jest.fn(async () => ({
      token: 'mock-token',
      additionalParameters: { foo: 'bar' },
    })),
    selectProviderForJourney: jest.fn(async () => undefined),
    authorizeForDaVinci: jest.fn(async () => undefined),
    ...overrides,
  };
}

async function loadExternalIdp(nativeMock: NativeExternalIdpMock) {
  jest.resetModules();
  jest.doMock(
    '../../../packages/external-idp/src/NativeRNPingExternalIdp',
    () => ({
      __esModule: true,
      getNativeModule: jest.fn(() => nativeMock),
      toNativeAuthorizeOptions: jest.fn((options: unknown) => options),
      toNativeSelectOptions: jest.fn((options: unknown) => options),
      toNativeConfig: jest.fn((config: unknown) => config),
      fromNativeAuthorizeResult: jest.fn((result: unknown) => result),
    }),
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@ping-identity/rn-external-idp');
}

async function loadExternalIdpWithRealHelpers(
  nativeMock: NativeExternalIdpMock,
) {
  jest.resetModules();
  jest.doMock(
    '../../../packages/external-idp/src/NativeRNPingExternalIdp',
    () => ({
      ...jest.requireActual(
        '../../../packages/external-idp/src/NativeRNPingExternalIdp',
      ),
      getNativeModule: jest.fn(() => nativeMock),
    }),
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@ping-identity/rn-external-idp');
}

describe('@ping-identity/rn-external-idp — integration', () => {
  afterEach(() => jest.restoreAllMocks());

  // ─── exports ──────────────────────────────────────────────────────────────

  describe('exports', () => {
    it('exports createExternalIdpClient', async () => {
      const mod = await loadExternalIdp(makeMock());
      expect(typeof mod.createExternalIdpClient).toBe('function');
    });

    it('createExternalIdpClient returns a client with authorizeForJourney, selectProviderForJourney, and authorizeForDaVinci', async () => {
      const mod = await loadExternalIdp(makeMock());
      const client = mod.createExternalIdpClient({});
      expect(typeof client.authorizeForJourney).toBe('function');
      expect(typeof client.selectProviderForJourney).toBe('function');
      expect(typeof client.authorizeForDaVinci).toBe('function');
    });
  });

  // ─── createExternalIdpClient() config validation ───────────────────────────

  describe('createExternalIdpClient() config validation', () => {
    it('throws when redirectUri is provided without a URI scheme', async () => {
      const mod = await loadExternalIdp(makeMock());
      expect(() =>
        mod.createExternalIdpClient({ redirectUri: 'no-scheme-here' }),
      ).toThrow('redirectUri');
    });

    it('accepts a valid redirectUri with a scheme', async () => {
      const mod = await loadExternalIdp(makeMock());
      expect(() =>
        mod.createExternalIdpClient({ redirectUri: 'com.myapp://callback' }),
      ).not.toThrow();
    });

    it('accepts an empty string redirectUri', async () => {
      const mod = await loadExternalIdp(makeMock());
      expect(() =>
        mod.createExternalIdpClient({ redirectUri: '' }),
      ).not.toThrow();
    });

    it('accepts an omitted redirectUri', async () => {
      const mod = await loadExternalIdp(makeMock());
      expect(() => mod.createExternalIdpClient({})).not.toThrow();
    });
  });

  // ─── authorizeForJourney() ────────────────────────────────────────────────

  describe('authorizeForJourney()', () => {
    it('resolves the journey id and forwards it to native', async () => {
      const mock = makeMock();
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'journey-123') };

      await client.authorizeForJourney(journey);

      expect(journey.getId).toHaveBeenCalledTimes(1);
      expect(mock.authorizeForJourney).toHaveBeenCalledWith(
        'journey-123',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('forwards options to native', async () => {
      const mock = makeMock();
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({
        redirectUri: 'com.myapp://callback',
      });
      const journey = { getId: jest.fn(async () => 'journey-opts') };

      await client.authorizeForJourney(journey, { index: 2 });

      expect(mock.authorizeForJourney).toHaveBeenCalledWith(
        'journey-opts',
        { index: 2 },
        expect.any(Object),
      );
    });

    it('forwards an empty options object when no options are provided', async () => {
      const mock = makeMock();
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'journey-defaults') };

      await client.authorizeForJourney(journey);

      expect(mock.authorizeForJourney).toHaveBeenCalledWith(
        'journey-defaults',
        {},
        expect.any(Object),
      );
    });

    it('forwards redirectUri and loggerId from config to native', async () => {
      const mock = makeMock();
      const mod = await loadExternalIdp(mock);
      const logger = {
        nativeHandle: { id: 'logger-handle-1' },
        changeLevel: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };
      const client = mod.createExternalIdpClient({
        redirectUri: 'com.myapp://callback',
        logger,
      });
      const journey = { getId: jest.fn(async () => 'journey-cfg') };

      await client.authorizeForJourney(journey);

      expect(mock.authorizeForJourney).toHaveBeenCalledWith(
        'journey-cfg',
        {},
        { redirectUri: 'com.myapp://callback', loggerId: 'logger-handle-1' },
      );
    });

    it('passes loggerId as undefined when no logger is provided', async () => {
      const mock = makeMock();
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({
        redirectUri: 'com.myapp://callback',
      });
      const journey = { getId: jest.fn(async () => 'journey-nolog') };

      await client.authorizeForJourney(journey);

      expect(mock.authorizeForJourney).toHaveBeenCalledWith(
        'journey-nolog',
        {},
        { redirectUri: 'com.myapp://callback', loggerId: undefined },
      );
    });

    it('returns the native result', async () => {
      const mod = await loadExternalIdp(makeMock());
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'journey-result') };

      const result = await client.authorizeForJourney(journey);

      expect(result).toEqual({
        token: 'mock-token',
        additionalParameters: { foo: 'bar' },
      });
    });

    it('propagates a native authorize error to the caller', async () => {
      const mock = makeMock({
        authorizeForJourney: jest.fn(async () => {
          throw {
            error: 'EXTERNAL_IDP_AUTHORIZE_ERROR',
            message: 'Authorization failed.',
            type: 'authorize_error',
          };
        }),
      });
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'journey-err') };

      await expect(client.authorizeForJourney(journey)).rejects.toMatchObject({
        code: 'EXTERNAL_IDP_AUTHORIZE_ERROR',
        message: 'Authorization failed.',
      });
    });

    it('propagates a cancellation error to the caller', async () => {
      const mock = makeMock({
        authorizeForJourney: jest.fn(async () => {
          throw {
            error: 'EXTERNAL_IDP_CANCELLED',
            message: 'User cancelled.',
            type: 'cancelled',
          };
        }),
      });
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'journey-cancel') };

      await expect(client.authorizeForJourney(journey)).rejects.toMatchObject({
        code: 'EXTERNAL_IDP_CANCELLED',
      });
    });

    it('propagates an unsupported provider error to the caller', async () => {
      const mock = makeMock({
        authorizeForJourney: jest.fn(async () => {
          throw {
            error: 'EXTERNAL_IDP_UNSUPPORTED_PROVIDER',
            message: 'Provider not supported.',
            type: 'unsupported_error',
          };
        }),
      });
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'journey-unsup') };

      await expect(client.authorizeForJourney(journey)).rejects.toMatchObject({
        code: 'EXTERNAL_IDP_UNSUPPORTED_PROVIDER',
      });
    });
  });

  // ─── authorizeForDaVinci() ────────────────────────────────────────────────

  describe('authorizeForDaVinci()', () => {
    it('resolves the davinci id and forwards it to native', async () => {
      const mock = makeMock();
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({});
      const daVinci = { getId: jest.fn(async () => 'davinci-123') };

      await client.authorizeForDaVinci(daVinci);

      expect(daVinci.getId).toHaveBeenCalledTimes(1);
      expect(mock.authorizeForDaVinci).toHaveBeenCalledWith(
        'davinci-123',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('forwards options to native', async () => {
      const mock = makeMock();
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({
        redirectUri: 'com.myapp://callback',
      });
      const daVinci = { getId: jest.fn(async () => 'davinci-opts') };

      await client.authorizeForDaVinci(daVinci, { index: 2 });

      expect(mock.authorizeForDaVinci).toHaveBeenCalledWith(
        'davinci-opts',
        { index: 2 },
        expect.any(Object),
      );
    });

    it('forwards an empty options object when no options are provided', async () => {
      const mock = makeMock();
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({});
      const daVinci = { getId: jest.fn(async () => 'davinci-defaults') };

      await client.authorizeForDaVinci(daVinci);

      expect(mock.authorizeForDaVinci).toHaveBeenCalledWith(
        'davinci-defaults',
        {},
        expect.any(Object),
      );
    });

    it('forwards redirectUri and loggerId from config to native', async () => {
      const mock = makeMock();
      const mod = await loadExternalIdp(mock);
      const logger = {
        nativeHandle: { id: 'logger-handle-dv' },
        changeLevel: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      };
      const client = mod.createExternalIdpClient({
        redirectUri: 'com.myapp://callback',
        logger,
      });
      const daVinci = { getId: jest.fn(async () => 'davinci-cfg') };

      await client.authorizeForDaVinci(daVinci);

      expect(mock.authorizeForDaVinci).toHaveBeenCalledWith(
        'davinci-cfg',
        {},
        { redirectUri: 'com.myapp://callback', loggerId: 'logger-handle-dv' },
      );
    });

    it('resolves without returning a value', async () => {
      const mod = await loadExternalIdp(makeMock());
      const client = mod.createExternalIdpClient({});
      const daVinci = { getId: jest.fn(async () => 'davinci-void') };

      const result = await client.authorizeForDaVinci(daVinci);

      expect(result).toBeUndefined();
    });

    it('propagates a native authorize error to the caller', async () => {
      const mock = makeMock({
        authorizeForDaVinci: jest.fn(async () => {
          throw {
            error: 'EXTERNAL_IDP_AUTHORIZE_ERROR',
            message: 'Authorization failed.',
            type: 'authorize_error',
          };
        }),
      });
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({});
      const daVinci = { getId: jest.fn(async () => 'davinci-err') };

      await expect(client.authorizeForDaVinci(daVinci)).rejects.toMatchObject({
        code: 'EXTERNAL_IDP_AUTHORIZE_ERROR',
        message: 'Authorization failed.',
      });
    });

    it('propagates a cancellation error to the caller', async () => {
      const mock = makeMock({
        authorizeForDaVinci: jest.fn(async () => {
          throw {
            error: 'EXTERNAL_IDP_CANCELLED',
            message: 'User cancelled.',
            type: 'cancelled',
          };
        }),
      });
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({});
      const daVinci = { getId: jest.fn(async () => 'davinci-cancel') };

      await expect(client.authorizeForDaVinci(daVinci)).rejects.toMatchObject({
        code: 'EXTERNAL_IDP_CANCELLED',
      });
    });
  });

  // ─── fromNativeAuthorizeResult — real field validation ────────────────────
  //
  // Uses jest.requireActual so the real fromNativeAuthorizeResult runs instead of
  // an identity stub. The helper reads .token and validates .additionalParameters,
  // so a bridge-side field rename is caught here without a device or simulator.

  describe('fromNativeAuthorizeResult — real field validation', () => {
    it('extracts token from native result', async () => {
      const mock = makeMock({
        authorizeForJourney: jest.fn(async () => ({ token: 'tok-1' })),
      });
      const mod = await loadExternalIdpWithRealHelpers(mock);
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'j-1') };
      const result = await client.authorizeForJourney(journey);
      expect(result.token).toBe('tok-1');
    });

    it('extracts token and additionalParameters from native result', async () => {
      const mock = makeMock({
        authorizeForJourney: jest.fn(async () => ({
          token: 'tok-2',
          additionalParameters: { key: 'val' },
        })),
      });
      const mod = await loadExternalIdpWithRealHelpers(mock);
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'j-2') };
      const result = await client.authorizeForJourney(journey);
      expect(result.token).toBe('tok-2');
      expect(result.additionalParameters).toEqual({ key: 'val' });
    });

    it('throws when native result is missing token', async () => {
      const mock = makeMock({
        authorizeForJourney: jest.fn(async () => ({})),
      });
      const mod = await loadExternalIdpWithRealHelpers(mock);
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'j-3') };
      await expect(client.authorizeForJourney(journey)).rejects.toThrow(
        'token must be a string',
      );
    });

    it('throws when additionalParameters contains a non-string value', async () => {
      const mock = makeMock({
        authorizeForJourney: jest.fn(async () => ({
          token: 'tok-4',
          additionalParameters: { k: 123 },
        })),
      });
      const mod = await loadExternalIdpWithRealHelpers(mock);
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'j-4') };
      await expect(client.authorizeForJourney(journey)).rejects.toThrow(
        'additionalParameters.k must be a string',
      );
    });
  });

  // ─── selectProviderForJourney() ───────────────────────────────────────────

  describe('selectProviderForJourney()', () => {
    it('resolves the journey id and forwards it with provider to native', async () => {
      const mock = makeMock();
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'journey-456') };

      await client.selectProviderForJourney(journey, 'google');

      expect(journey.getId).toHaveBeenCalledTimes(1);
      expect(mock.selectProviderForJourney).toHaveBeenCalledWith(
        'journey-456',
        'google',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('forwards index option to native', async () => {
      const mock = makeMock();
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'journey-idx') };

      await client.selectProviderForJourney(journey, 'apple', { index: 1 });

      expect(mock.selectProviderForJourney).toHaveBeenCalledWith(
        'journey-idx',
        'apple',
        { index: 1 },
        expect.any(Object),
      );
    });

    it('forwards config to native', async () => {
      const mock = makeMock();
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({
        redirectUri: 'com.myapp://callback',
      });
      const journey = { getId: jest.fn(async () => 'journey-selcfg') };

      await client.selectProviderForJourney(journey, 'facebook');

      expect(mock.selectProviderForJourney).toHaveBeenCalledWith(
        'journey-selcfg',
        'facebook',
        {},
        { redirectUri: 'com.myapp://callback', loggerId: undefined },
      );
    });

    it('resolves without returning a value', async () => {
      const mod = await loadExternalIdp(makeMock());
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'journey-void') };

      const result = await client.selectProviderForJourney(journey, 'google');

      expect(result).toBeUndefined();
    });

    it('throws when provider is an empty string', async () => {
      const mod = await loadExternalIdp(makeMock());
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'journey-blank') };

      await expect(
        client.selectProviderForJourney(journey, ''),
      ).rejects.toThrow('provider');
    });

    it('throws when provider is blank whitespace', async () => {
      const mod = await loadExternalIdp(makeMock());
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'journey-ws') };

      await expect(
        client.selectProviderForJourney(journey, '   '),
      ).rejects.toThrow('provider');
    });

    it('propagates a native callback-not-found error to the caller', async () => {
      const mock = makeMock({
        selectProviderForJourney: jest.fn(async () => {
          throw {
            error: 'EXTERNAL_IDP_CALLBACK_NOT_FOUND',
            message: 'No SelectIdpCallback found.',
            type: 'callback_error',
          };
        }),
      });
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'journey-notfound') };

      await expect(
        client.selectProviderForJourney(journey, 'google'),
      ).rejects.toMatchObject({
        code: 'EXTERNAL_IDP_CALLBACK_NOT_FOUND',
        message: 'No SelectIdpCallback found.',
      });
    });

    it('propagates an activity unavailable error to the caller', async () => {
      const mock = makeMock({
        selectProviderForJourney: jest.fn(async () => {
          throw {
            error: 'EXTERNAL_IDP_ACTIVITY_UNAVAILABLE',
            message: 'No foreground activity.',
            type: 'activity_error',
          };
        }),
      });
      const mod = await loadExternalIdp(mock);
      const client = mod.createExternalIdpClient({});
      const journey = { getId: jest.fn(async () => 'journey-activity') };

      await expect(
        client.selectProviderForJourney(journey, 'google'),
      ).rejects.toMatchObject({ code: 'EXTERNAL_IDP_ACTIVITY_UNAVAILABLE' });
    });
  });
});
