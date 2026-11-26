/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import { Platform } from 'react-native';
import {
  buildNativeConfig,
  validateWorkflowOptionsBag,
} from '../ceremonyConfig';
import { FidoError } from '../types';
import type { LoggerInstance } from '@ping-identity/rn-types';
import type {
  FidoAuthenticationCeremonyOptions,
  FidoRegistrationCeremonyOptions,
} from '../types';

const logger: LoggerInstance = {
  nativeHandle: { id: '' },
  changeLevel: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const setPlatform = (os: 'ios' | 'android') => {
  (Platform as unknown as { OS: string }).OS = os;
};

describe('buildNativeConfig: composition contract', () => {
  afterEach(() => {
    setPlatform('ios');
    jest.clearAllMocks();
  });

  it('returns a fresh object per invocation and never mutates resolvedConfig', () => {
    setPlatform('android');
    const resolvedConfig = { useFido2ApiClient: true };
    const ceremonyOptions: FidoRegistrationCeremonyOptions = {
      android: { credentialManager: { clientDataHash: 'abc' } },
    };
    const first = buildNativeConfig(
      resolvedConfig,
      'registration',
      ceremonyOptions,
      logger,
    );
    const second = buildNativeConfig(
      resolvedConfig,
      'registration',
      {},
      logger,
    );

    expect(first).toEqual({
      useFido2ApiClient: true,
      android: { credentialManager: { clientDataHash: 'abc' } },
    });
    expect(second).toEqual({ useFido2ApiClient: true });
    expect(first).not.toBe(second);
    // The emitted block is a copy, not a reference to the caller's object.
    expect(first.android).not.toBe(ceremonyOptions.android);
    expect(resolvedConfig).toEqual({ useFido2ApiClient: true });
    expect(ceremonyOptions.android).toEqual({
      credentialManager: { clientDataHash: 'abc' },
    });
  });

  it('omits useFido2ApiClient when no explicit client flag exists', () => {
    setPlatform('android');
    const config = buildNativeConfig({}, 'authentication', {}, logger);
    expect(config).toEqual({});
    expect('useFido2ApiClient' in config).toBe(false);
  });

  it('keeps the explicit client flag when the ceremony has no routing blocks', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      { useFido2ApiClient: true },
      'authentication',
      { preferImmediatelyAvailableCredentials: true },
      logger,
    );
    expect(config.useFido2ApiClient).toBe(true);
    expect(config.preferImmediatelyAvailableCredentials).toBe(true);
  });

  it('keeps client configs isolated: one call does not leak into another', () => {
    setPlatform('android');
    const resolvedConfig = { loggerId: 'logger-1' };
    const first = buildNativeConfig(
      resolvedConfig,
      'authentication',
      { android: { credentialManager: { clientDataHash: 'abc' } } },
      logger,
    );
    expect('useFido2ApiClient' in first).toBe(false);
    const second = buildNativeConfig(
      { ...resolvedConfig, useFido2ApiClient: true },
      'authentication',
      {},
      logger,
    );
    expect(second.useFido2ApiClient).toBe(true);
    const third = buildNativeConfig(
      resolvedConfig,
      'authentication',
      {},
      logger,
    );
    expect(third).toEqual({ loggerId: 'logger-1' });
    expect('useFido2ApiClient' in third).toBe(false);
    expect('android' in third).toBe(false);
  });

  it('omits loggerId when undefined', () => {
    const config = buildNativeConfig({}, 'registration', {}, logger);
    expect(config).toEqual({});
    expect('loggerId' in config).toBe(false);
  });

  it('emits loggerId when resolved', () => {
    const config = buildNativeConfig(
      { loggerId: 'logger-1' },
      'registration',
      {},
      logger,
    );
    expect(config).toEqual({ loggerId: 'logger-1' });
  });
});

describe('buildNativeConfig: routing blocks', () => {
  afterEach(() => {
    setPlatform('ios');
    jest.clearAllMocks();
  });

  it('credentialManager block omits useFido2ApiClient', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'authentication',
      { android: { credentialManager: {} } },
      logger,
    );
    expect('useFido2ApiClient' in config).toBe(false);
    expect(config.android).toEqual({ credentialManager: {} });
  });

  it('playServices block omits useFido2ApiClient and forwards flat transports', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'authentication',
      {
        android: {
          playServices: {
            transports: ['usb', 'nfc', 'internal'],
            timeoutSeconds: 30,
            requestId: 7,
            authenticationExtensions: {
              fidoAppId: 'https://example.com',
              userVerificationMethod: true,
            },
          },
        },
      },
      logger,
    );
    expect('useFido2ApiClient' in config).toBe(false);
    expect(config.android?.playServices).toEqual({
      transports: ['usb', 'nfc', 'internal'],
      timeoutSeconds: 30,
      requestId: 7,
      authenticationExtensions: {
        fidoAppId: 'https://example.com',
        userVerificationMethod: true,
      },
    });
    // Flat list forwarded as-is; no per-credential entries are synthesized.
    expect(config.android?.playServices?.transports).not.toContain(
      expect.objectContaining({ id: expect.anything() }),
    );
  });

  it('accepts both blocks together and forwards both to native', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'authentication',
      {
        android: {
          credentialManager: { clientDataHash: 'abc' },
          playServices: { requestId: 7 },
        },
      },
      logger,
    );
    expect(config.android).toEqual({
      credentialManager: { clientDataHash: 'abc' },
      playServices: { requestId: 7 },
    });
    expect('useFido2ApiClient' in config).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not reject a block contradicting the client-level flag and forwards both', () => {
    setPlatform('android');
    const credentialManager = buildNativeConfig(
      { useFido2ApiClient: true },
      'authentication',
      { android: { credentialManager: { clientDataHash: 'abc' } } },
      logger,
    );
    expect(credentialManager.useFido2ApiClient).toBe(true);
    expect(credentialManager.android).toEqual({
      credentialManager: { clientDataHash: 'abc' },
    });
    const playServices = buildNativeConfig(
      { useFido2ApiClient: false },
      'authentication',
      { android: { playServices: { requestId: 7 } } },
      logger,
    );
    expect(playServices.useFido2ApiClient).toBe(false);
    expect(playServices.android).toEqual({ playServices: { requestId: 7 } });
  });

  it('does not reject a block contradicting the per-call flag and forwards both', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'authentication',
      {
        android: {
          useFido2ApiClient: true,
          credentialManager: { clientDataHash: 'abc' },
        },
      },
      logger,
    );
    expect(config.useFido2ApiClient).toBe(true);
    expect(config.android).toEqual({
      credentialManager: { clientDataHash: 'abc' },
    });
  });

  it('registration prunes playServices with a warning instead of throwing', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'registration',
      { android: { playServices: { transports: ['usb'] } } as never },
      logger,
    );
    expect(config.android).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "FIDO config key 'android.playServices' received an Object; registration uses Credential Manager and this block is ignored",
    );
  });

  it('registration accepts credentialManager without implying useFido2ApiClient', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'registration',
      { android: { credentialManager: { clientDataHash: 'abc' } } },
      logger,
    );
    expect(config.useFido2ApiClient).toBeUndefined();
    expect('useFido2ApiClient' in config).toBe(false);
    expect(config.android).toEqual({
      credentialManager: { clientDataHash: 'abc' },
    });
  });

  it('authentication forwards preferImmediatelyAvailableCredentials with a registration-only registration value', () => {
    setPlatform('android');
    const authConfig = buildNativeConfig(
      {},
      'authentication',
      { preferImmediatelyAvailableCredentials: true },
      logger,
    );
    expect(authConfig.preferImmediatelyAvailableCredentials).toBe(true);
    const regConfig = buildNativeConfig(
      {},
      'registration',
      { preferImmediatelyAvailableCredentials: false },
      logger,
    );
    expect(regConfig.preferImmediatelyAvailableCredentials).toBe(false);
  });
});

describe('buildNativeConfig: per-call android.useFido2ApiClient', () => {
  afterEach(() => {
    setPlatform('ios');
    jest.clearAllMocks();
  });

  it.each([true, false])(
    'forwards the per-call flag %s as the top-level key on Android',
    (flag) => {
      setPlatform('android');
      const config = buildNativeConfig(
        {},
        'authentication',
        { android: { useFido2ApiClient: flag } },
        logger,
      );
      expect(config.useFido2ApiClient).toBe(flag);
      expect(config.android).toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
    },
  );

  it('per-call flag overrides the client-level flag', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      { useFido2ApiClient: true },
      'authentication',
      { android: { useFido2ApiClient: false } },
      logger,
    );
    expect(config.useFido2ApiClient).toBe(false);
  });

  it('client-level flag is forwarded when no per-call flag exists', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      { useFido2ApiClient: false },
      'authentication',
      { android: { credentialManager: { clientDataHash: 'abc' } } },
      logger,
    );
    expect(config.useFido2ApiClient).toBe(false);
  });

  it('omits the key when neither flag exists, even with blocks', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'authentication',
      {
        android: {
          credentialManager: { clientDataHash: 'abc' },
          playServices: { requestId: 7 },
        },
      },
      logger,
    );
    expect('useFido2ApiClient' in config).toBe(false);
  });

  it('keeps the per-call flag from leaking into the next call', () => {
    setPlatform('android');
    const resolvedConfig = { useFido2ApiClient: true };
    const first = buildNativeConfig(
      resolvedConfig,
      'authentication',
      { android: { useFido2ApiClient: false } },
      logger,
    );
    const second = buildNativeConfig(
      resolvedConfig,
      'authentication',
      {},
      logger,
    );
    expect(first.useFido2ApiClient).toBe(false);
    expect(second.useFido2ApiClient).toBe(true);
    expect(resolvedConfig).toEqual({ useFido2ApiClient: true });
  });

  it('does not mutate the caller android block', () => {
    setPlatform('android');
    const android = {
      useFido2ApiClient: false,
      credentialManager: { clientDataHash: 'abc' },
    };
    buildNativeConfig({}, 'authentication', { android }, logger);
    expect(android).toEqual({
      useFido2ApiClient: false,
      credentialManager: { clientDataHash: 'abc' },
    });
  });

  it.each([['true'], [1], [null]])(
    'rejects a non-boolean per-call flag %p with argument_error',
    (flag) => {
      setPlatform('android');
      const call = () =>
        buildNativeConfig(
          {},
          'authentication',
          { android: { useFido2ApiClient: flag as never } },
          logger,
        );
      expect(call).toThrow(FidoError);
      try {
        call();
      } catch (error) {
        expect((error as FidoError).type).toBe('argument_error');
        expect((error as FidoError).code).toBe('FIDO_INVALID_PARAMETER');
        expect((error as FidoError).message).toContain(
          'android.useFido2ApiClient must be a boolean',
        );
      }
    },
  );

  it('prunes the per-call flag on iOS with the android warning and never sends the key', () => {
    setPlatform('ios');
    const config = buildNativeConfig(
      { useFido2ApiClient: true },
      'authentication',
      { android: { useFido2ApiClient: true } },
      logger,
    );
    expect('useFido2ApiClient' in config).toBe(false);
    expect(config.android).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "FIDO config key 'android' received an Object; Android-only options are ignored on iOS",
    );
  });

  it('treats the per-call flag as an unknown key on registration and drops it', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'registration',
      {
        android: {
          useFido2ApiClient: true,
          credentialManager: { clientDataHash: 'abc' },
        } as never,
      },
      logger,
    );
    expect('useFido2ApiClient' in config).toBe(false);
    expect(config.android).toEqual({
      credentialManager: { clientDataHash: 'abc' },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "FIDO config key 'android.useFido2ApiClient' received a Boolean; this key is not recognized and is ignored",
    );
  });
});

describe('buildNativeConfig: argument validation', () => {
  afterEach(() => {
    setPlatform('ios');
    jest.clearAllMocks();
  });

  it('rejects ceremony options that are not an object with argument_error', () => {
    for (const bad of [null, 'yes', 42, ['a']]) {
      let thrown: unknown;
      try {
        buildNativeConfig({}, 'authentication', bad as never, logger);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(FidoError);
      expect(thrown).toMatchObject({
        code: 'FIDO_INVALID_PARAMETER',
        type: 'argument_error',
      });
    }
  });

  it('rejects a non-boolean preferImmediatelyAvailableCredentials', () => {
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        { preferImmediatelyAvailableCredentials: 'yes' as never },
        logger,
      ),
    ).toThrow(FidoError);
  });

  it('warns and ignores a non-object android block (native parity)', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'registration',
      { android: 'nope' as never },
      logger,
    );
    expect(config.android).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "FIDO config key 'android' received a String of length 4",
      ),
    );
  });

  it('rejects a bad base64url clientDataHash', () => {
    setPlatform('android');
    for (const badHash of ['abc+', 'abc/', 'not base64!']) {
      expect(() =>
        buildNativeConfig(
          {},
          'registration',
          { android: { credentialManager: { clientDataHash: badHash } } },
          logger,
        ),
      ).toThrow(FidoError);
    }
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        { android: { credentialManager: { clientDataHash: 'abc$' } } },
        logger,
      ),
    ).toThrow(FidoError);
  });

  it('accepts validly padded and unpadded base64url clientDataHash', () => {
    setPlatform('android');
    for (const hash of ['abc', 'YQ', 'abc=', 'ab==', 'YQ==']) {
      const config = buildNativeConfig(
        {},
        'registration',
        { android: { credentialManager: { clientDataHash: hash } } },
        logger,
      );
      expect(config.android?.credentialManager).toEqual({
        clientDataHash: hash,
      });
    }
    const authConfig = buildNativeConfig(
      {},
      'authentication',
      { android: { credentialManager: { clientDataHash: 'YQ==' } } },
      logger,
    );
    expect(authConfig.android?.credentialManager).toEqual({
      clientDataHash: 'YQ==',
    });
  });

  it('rejects malformed padding in clientDataHash', () => {
    setPlatform('android');
    for (const badHash of ['abc==', 'a=', 'ab=', 'abcd==', 'a', '']) {
      expect(() =>
        buildNativeConfig(
          {},
          'registration',
          { android: { credentialManager: { clientDataHash: badHash } } },
          logger,
        ),
      ).toThrow(FidoError);
    }
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        { android: { credentialManager: { clientDataHash: 'abc==' } } },
        logger,
      ),
    ).toThrow(FidoError);
  });

  it('rejects preferDefaultProvider combined with isConditional=true', () => {
    setPlatform('android');
    expect(() =>
      buildNativeConfig(
        {},
        'registration',
        {
          android: {
            credentialManager: {
              preferDefaultProvider: 'com.example/.Provider',
              isConditional: true,
            },
          },
        },
        logger,
      ),
    ).toThrow(FidoError);
  });

  it('accepts preferDefaultProvider with isConditional=false', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'registration',
      {
        android: {
          credentialManager: {
            preferDefaultProvider: 'com.example/.Provider',
            isConditional: false,
          },
        },
      },
      logger,
    );
    expect(config.android?.credentialManager).toEqual({
      preferDefaultProvider: 'com.example/.Provider',
      isConditional: false,
    });
  });

  it('rejects a bad preferDefaultProvider component name', () => {
    setPlatform('android');
    expect(() =>
      buildNativeConfig(
        {},
        'registration',
        {
          android: {
            credentialManager: {
              preferDefaultProvider: 'com.example.Provider',
            },
          },
        },
        logger,
      ),
    ).toThrow(FidoError);
  });

  it('rejects bad allowedProviders entries', () => {
    setPlatform('android');
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        {
          android: {
            credentialManager: {
              allowedProviders: ['com.example.Provider'],
            } as never,
          },
        },
        logger,
      ),
    ).toThrow(FidoError);
  });

  it('rejects non-string allowedProviders entries', () => {
    setPlatform('android');
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        {
          android: {
            credentialManager: { allowedProviders: [42] } as never,
          },
        },
        logger,
      ),
    ).toThrow(FidoError);
  });

  it('rejects a bad playServices timeoutSeconds and requestId', () => {
    setPlatform('android');
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        { android: { playServices: { timeoutSeconds: 0 } } as never },
        logger,
      ),
    ).toThrow(FidoError);
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        { android: { playServices: { timeoutSeconds: -5 } } as never },
        logger,
      ),
    ).toThrow(FidoError);
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        {
          android: { playServices: { timeoutSeconds: Number.NaN } } as never,
        },
        logger,
      ),
    ).toThrow(FidoError);
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        { android: { playServices: { requestId: 1.5 } } as never },
        logger,
      ),
    ).toThrow(FidoError);
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        {
          android: { playServices: { requestId: 2147483648 } } as never,
        },
        logger,
      ),
    ).toThrow(FidoError);
  });

  it('rejects bad transports shapes', () => {
    setPlatform('android');
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        { android: { playServices: { transports: 'usb' } } as never },
        logger,
      ),
    ).toThrow(FidoError);
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        { android: { playServices: { transports: [42] } } as never },
        logger,
      ),
    ).toThrow(FidoError);
  });

  it('rejects bad authenticationExtensions', () => {
    setPlatform('android');
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        {
          android: {
            playServices: {
              authenticationExtensions: { fidoAppId: 3 },
            } as never,
          },
        },
        logger,
      ),
    ).toThrow(FidoError);
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        {
          android: {
            playServices: {
              authenticationExtensions: { userVerificationMethod: 'yes' },
            } as never,
          },
        },
        logger,
      ),
    ).toThrow(FidoError);
  });

  it('rejects non-boolean registration create-request flags', () => {
    setPlatform('android');
    expect(() =>
      buildNativeConfig(
        {},
        'registration',
        {
          android: {
            credentialManager: { isAutoSelectAllowed: 'yes' } as never,
          },
        },
        logger,
      ),
    ).toThrow(FidoError);
    expect(() =>
      buildNativeConfig(
        {},
        'registration',
        {
          android: {
            credentialManager: { isConditional: 1 } as never,
          },
        },
        logger,
      ),
    ).toThrow(FidoError);
    expect(() =>
      buildNativeConfig(
        {},
        'registration',
        {
          android: {
            credentialManager: {
              preferImmediatelyAvailableCredentials: 0,
            } as never,
          },
        },
        logger,
      ),
    ).toThrow(FidoError);
  });

  it('rejects a non-string origin', () => {
    setPlatform('android');
    expect(() =>
      buildNativeConfig(
        {},
        'registration',
        { android: { credentialManager: { origin: 5 } } as never },
        logger,
      ),
    ).toThrow(FidoError);
  });

  it('rejects a non-object requestJson', () => {
    setPlatform('android');
    expect(() =>
      buildNativeConfig(
        {},
        'registration',
        {
          android: { credentialManager: { requestJson: 'json' } } as never,
        },
        logger,
      ),
    ).toThrow(FidoError);
    expect(() =>
      buildNativeConfig(
        {},
        'authentication',
        {
          android: {
            credentialManager: { requestJson: ['a'] } as never,
          },
        },
        logger,
      ),
    ).toThrow(FidoError);
  });

  it('every argument error carries type argument_error and FIDO_INVALID_PARAMETER code', () => {
    setPlatform('android');
    try {
      buildNativeConfig(
        {},
        'registration',
        { android: { credentialManager: { clientDataHash: 'not valid!' } } },
        logger,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(FidoError);
      expect((error as FidoError).type).toBe('argument_error');
      expect((error as FidoError).code).toBe('FIDO_INVALID_PARAMETER');
    }
  });

  it('validateWorkflowOptionsBag accepts omitted options and empty object', () => {
    expect(() =>
      validateWorkflowOptionsBag('authenticateForJourney', undefined),
    ).not.toThrow();
    expect(() =>
      validateWorkflowOptionsBag('authenticateForJourney', {}),
    ).not.toThrow();
  });

  it('validateWorkflowOptionsBag rejects null, arrays and primitives with argument_error', () => {
    for (const bad of [null, ['a'], 'yes', 42]) {
      let thrown: unknown;
      try {
        validateWorkflowOptionsBag('registerForJourney', bad);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(FidoError);
      expect(thrown).toMatchObject({
        code: 'FIDO_INVALID_PARAMETER',
        type: 'argument_error',
      });
      expect((thrown as FidoError).message).toContain(
        'registerForJourney options must be an object',
      );
    }
  });
});

describe('buildNativeConfig: non-object android sub-blocks', () => {
  afterEach(() => {
    setPlatform('ios');
    jest.clearAllMocks();
  });

  it.each([
    ['null', null, 'null'],
    ['string', 'nope', 'a String of length 4'],
    ['array', ['x'], 'an Array'],
  ] as const)(
    'warns and ignores a %s credentialManager on registration',
    (_label, value, expectedType) => {
      setPlatform('android');
      const config = buildNativeConfig(
        {},
        'registration',
        { android: { credentialManager: value } } as never,
        logger,
      );
      expect(config.android).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        `FIDO config key 'android.credentialManager' received ${expectedType}; an Object is expected and the block is ignored`,
      );
    },
  );

  it.each([
    ['null', null, 'null'],
    ['string', 'nope', 'a String of length 4'],
    ['array', ['x'], 'an Array'],
  ] as const)(
    'warns and ignores a %s credentialManager on authentication',
    (_label, value, expectedType) => {
      setPlatform('android');
      const config = buildNativeConfig(
        {},
        'authentication',
        { android: { credentialManager: value } } as never,
        logger,
      );
      expect(config).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        `FIDO config key 'android.credentialManager' received ${expectedType}; an Object is expected and the block is ignored`,
      );
    },
  );

  it.each([
    ['null', null, 'null'],
    ['string', 'nope', 'a String of length 4'],
    ['array', ['x'], 'an Array'],
  ] as const)(
    'warns and ignores a %s playServices on authentication',
    (_label, value, expectedType) => {
      setPlatform('android');
      const config = buildNativeConfig(
        {},
        'authentication',
        { android: { playServices: value } } as never,
        logger,
      );
      expect(config).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(
        `FIDO config key 'android.playServices' received ${expectedType}; an Object is expected and the block is ignored`,
      );
    },
  );

  it('keeps a valid playServices sibling when credentialManager is not an object', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'authentication',
      { android: { credentialManager: null, playServices: {} } } as never,
      logger,
    );
    expect(config.android).toEqual({ playServices: {} });
    expect('useFido2ApiClient' in config).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      "FIDO config key 'android.credentialManager' received null; an Object is expected and the block is ignored",
    );
  });

  it('registration reports a non-object playServices with the registration consequence', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'registration',
      { android: { playServices: 'nope' } } as never,
      logger,
    );
    expect(config.android).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "FIDO config key 'android.playServices' received a String of length 4; registration uses Credential Manager and this block is ignored",
    );
  });
});

describe('buildNativeConfig: platform pruning', () => {
  afterEach(() => {
    setPlatform('ios');
    jest.clearAllMocks();
  });

  it('prunes the android block on iOS with a warning', () => {
    const config = buildNativeConfig(
      {},
      'authentication',
      {
        android: {
          credentialManager: { clientDataHash: 'abc' },
          playServices: { transports: ['usb'] },
        } as never,
      },
      logger,
    );
    expect(config.android).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("FIDO config key 'android' received an Object"),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Android-only options are ignored on iOS'),
    );
  });

  it('omits an explicit client-level useFido2ApiClient flag on iOS', () => {
    const config = buildNativeConfig(
      { useFido2ApiClient: true },
      'authentication',
      {},
      logger,
    );
    expect(config).toEqual({});
    expect('useFido2ApiClient' in config).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('forwards PIA on iOS authentication (applied natively) and on registration (reported natively)', () => {
    const authConfig = buildNativeConfig(
      {},
      'authentication',
      { preferImmediatelyAvailableCredentials: true },
      logger,
    );
    expect(authConfig.preferImmediatelyAvailableCredentials).toBe(true);
    const regConfig = buildNativeConfig(
      {},
      'registration',
      { preferImmediatelyAvailableCredentials: true },
      logger,
    );
    expect(regConfig.preferImmediatelyAvailableCredentials).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns for unknown keys inside the android block on Android and drops them', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'authentication',
      {
        android: {
          credentialManager: { clientDataHash: 'abc' },
          notAKey: { nested: true },
        } as never,
      },
      logger,
    );
    expect(config.android).toEqual({
      credentialManager: { clientDataHash: 'abc' },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "FIDO config key 'android.notAKey' received an Object",
      ),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not recognized and is ignored'),
    );
  });

  it('warns for unknown top-level ceremony keys and drops them', () => {
    setPlatform('android');
    const config = buildNativeConfig(
      {},
      'authentication',
      {
        preferImmediatelyAvailableCredentials: true,
        iosBlock: { window: 'ignored' },
      } as never,
      logger,
    );
    expect(config).toEqual({ preferImmediatelyAvailableCredentials: true });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "FIDO config key 'iosBlock' received an Object; this key is not recognized and is ignored",
      ),
    );
  });

  it('warnings never contain option values', () => {
    setPlatform('android');
    buildNativeConfig(
      {},
      'registration',
      {
        android: {
          credentialManager: { clientDataHash: 'super-secret-hash-value' },
        },
      },
      logger,
    );
    const warnCalls = (logger.warn as jest.Mock).mock.calls.flat().join('\n');
    expect(warnCalls).not.toContain('super-secret-hash-value');
  });
});

describe('buildNativeConfig: standalone WebAuthn payload regression', () => {
  afterEach(() => {
    setPlatform('ios');
    jest.clearAllMocks();
  });

  it('native config carries only config keys, never WebAuthn options', () => {
    setPlatform('android');
    const webAuthnOptions = {
      challenge: 'xyz',
      rp: { id: 'example.com', name: 'Example' },
      allowCredentials: [],
    };
    const config = buildNativeConfig({}, 'registration', {}, logger);
    expect(config).toEqual({});
    // The options object itself is forwarded unchanged by the facade.
    expect(webAuthnOptions).toEqual({
      challenge: 'xyz',
      rp: { id: 'example.com', name: 'Example' },
      allowCredentials: [],
    });
  });
});

describe('createFidoClient: ceremony wiring', () => {
  const createNativeMock = () => ({
    registerDaVinciSerializer: jest.fn(),
    registerCredential: jest.fn().mockResolvedValue({ ok: true }),
    authenticateCredential: jest.fn().mockResolvedValue({ ok: true }),
    registerCredentialForJourney: jest
      .fn()
      .mockResolvedValue({ type: 'success' }),
    authenticateCredentialForJourney: jest
      .fn()
      .mockResolvedValue({ type: 'success' }),
    registerCredentialForDaVinci: jest
      .fn()
      .mockResolvedValue({ attestationValue: {} }),
    authenticateCredentialForDaVinci: jest
      .fn()
      .mockResolvedValue({ assertionValue: {} }),
  });

  const loadClient = async (platform: 'ios' | 'android') => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: platform } }));
    const native = createNativeMock();
    jest.doMock('../NativeRNPingFido', () => ({
      __esModule: true,
      getNativeModule: jest.fn(() => native),
      toNativeRegistrationOptions: (options: unknown) => options,
      toNativeAuthenticationOptions: (options: unknown) => options,
      fromNativeRegistrationResult: (result: unknown) => result,
      fromNativeAuthenticationResult: (result: unknown) => result,
      toNativeJourneyRegistrationOptions: (options: unknown) => options,
      toNativeJourneyAuthenticationOptions: (options: unknown) => options,
      fromNativeJourneyResult: (result: unknown) => result,
      toNativeDaVinciRegistrationOptions: (options: unknown) => options,
      toNativeDaVinciAuthenticationOptions: (options: unknown) => options,
      fromNativeDaVinciResult: (result: unknown) => result,
    }));
    const { createFidoClient } = await import('../index');
    return { createFidoClient, native };
  };

  afterEach(() => {
    setPlatform('ios');
    jest.clearAllMocks();
  });

  it('standalone register forwards WebAuthn payload unchanged and composes config per call', async () => {
    const { createFidoClient, native } = await loadClient('android');
    const client = createFidoClient();
    const options = { challenge: 'xyz', rp: { id: 'example.com' } };

    await client.register(options, {
      android: { credentialManager: { clientDataHash: 'abc' } },
    });

    expect(native.registerCredential).toHaveBeenCalledWith(options, {
      android: { credentialManager: { clientDataHash: 'abc' } },
    });
    // The caller's object was not mutated.
    expect(options).toEqual({ challenge: 'xyz', rp: { id: 'example.com' } });
  });

  it('Journey registration merges ceremony fields by copy, never onto the caller object', async () => {
    const { createFidoClient, native } = await loadClient('android');
    const client = createFidoClient();
    const journey = { getId: jest.fn().mockResolvedValue('journey-1') };
    const options = {
      index: 1,
      preferImmediatelyAvailableCredentials: true,
      android: {
        credentialManager: { preferImmediatelyAvailableCredentials: false },
      },
    };

    await client.registerForJourney(journey, options);

    expect(native.registerCredentialForJourney).toHaveBeenCalledWith(
      'journey-1',
      {
        index: 1,
      },
      {
        preferImmediatelyAvailableCredentials: true,
        android: {
          credentialManager: { preferImmediatelyAvailableCredentials: false },
        },
      },
    );
    expect(options.android?.credentialManager).toEqual({
      preferImmediatelyAvailableCredentials: false,
    });
  });

  it('Journey authentication with a credentialManager block never adds the routing key and keeps calls independent', async () => {
    const { createFidoClient, native } = await loadClient('android');
    const client = createFidoClient();
    const journey = { getId: jest.fn().mockResolvedValue('journey-2') };

    await client.authenticateForJourney(journey, {
      android: { credentialManager: {} },
    });
    const firstConfig =
      native.authenticateCredentialForJourney.mock.calls[0][2];
    expect('useFido2ApiClient' in firstConfig).toBe(false);
    expect(firstConfig.android).toEqual({ credentialManager: {} });

    await client.authenticateForJourney(journey, { index: 1 });
    const secondConfig =
      native.authenticateCredentialForJourney.mock.calls[1][2];
    expect('useFido2ApiClient' in secondConfig).toBe(false);
    expect('android' in secondConfig).toBe(false);
  });

  it('DaVinci authentication forwards flat transports without per-credential entries', async () => {
    const { createFidoClient, native } = await loadClient('android');
    const client = createFidoClient();
    const daVinci = { getId: jest.fn().mockResolvedValue('davinci-1') };

    await client.authenticateForDaVinci(daVinci, {
      android: {
        playServices: {
          transports: ['usb', 'nfc'],
        },
      },
    });

    const config = native.authenticateCredentialForDaVinci.mock.calls[0][2];
    expect(config.android.playServices.transports).toEqual(['usb', 'nfc']);
    expect(Array.isArray(config.android.playServices.transports)).toBe(true);
    for (const entry of config.android.playServices.transports) {
      expect(typeof entry).toBe('string');
    }
  });

  it('a non-boolean per-call flag rejects pre-native through the client method', async () => {
    const { createFidoClient, native } = await loadClient('android');
    const client = createFidoClient();
    const journey = { getId: jest.fn().mockResolvedValue('journey-3') };

    const error = await client
      .authenticateForJourney(journey, {
        android: { useFido2ApiClient: 'yes' as never },
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as { type?: string }).type).toBe('argument_error');
    expect(native.authenticateCredentialForJourney).not.toHaveBeenCalled();
  });

  it('forwards the per-call flag in standalone, Journey and DaVinci authentication', async () => {
    const { createFidoClient, native } = await loadClient('android');
    const client = createFidoClient();
    const journey = { getId: jest.fn().mockResolvedValue('journey-4') };
    const daVinci = { getId: jest.fn().mockResolvedValue('davinci-2') };
    const ceremony = { android: { useFido2ApiClient: false } };

    await client.authenticate({ challenge: 'abc' }, ceremony);
    await client.authenticateForJourney(journey, ceremony);
    await client.authenticateForDaVinci(daVinci, ceremony);

    expect(native.authenticateCredential.mock.calls[0][1]).toEqual({
      useFido2ApiClient: false,
    });
    expect(native.authenticateCredentialForJourney.mock.calls[0][2]).toEqual({
      useFido2ApiClient: false,
    });
    expect(native.authenticateCredentialForDaVinci.mock.calls[0][2]).toEqual({
      useFido2ApiClient: false,
    });
  });

  it('per-call flag overrides the client flag for one call only', async () => {
    const { createFidoClient, native } = await loadClient('android');
    const client = createFidoClient({ android: { useFido2ApiClient: true } });

    await client.authenticate(
      { challenge: 'abc' },
      { android: { useFido2ApiClient: false } },
    );
    await client.authenticate({ challenge: 'abc' });

    expect(native.authenticateCredential.mock.calls[0][1]).toEqual({
      useFido2ApiClient: false,
    });
    expect(native.authenticateCredential.mock.calls[1][1]).toEqual({
      useFido2ApiClient: true,
    });
  });

  it('caller-supplied nested option objects are not mutated after a call', async () => {
    const { createFidoClient, native } = await loadClient('android');
    const client = createFidoClient();
    const daVinci = { getId: jest.fn().mockResolvedValue('davinci-2') };
    const ceremony: FidoAuthenticationCeremonyOptions = {
      android: {
        playServices: {
          transports: ['usb'],
          authenticationExtensions: { fidoAppId: 'https://example.com' },
        },
      },
    };
    const snapshot = JSON.stringify(ceremony);

    await client.authenticateForDaVinci(daVinci, ceremony);

    expect(JSON.stringify(ceremony)).toBe(snapshot);
    expect(native.authenticateCredentialForDaVinci).toHaveBeenCalledTimes(1);
  });

  it('two createFidoClient calls with different configs do not bleed', async () => {
    const { createFidoClient, native } = await loadClient('android');
    const clientA = createFidoClient({ android: { useFido2ApiClient: true } });
    const clientB = createFidoClient();

    await clientA.authenticate({ challenge: 'a' }, {});
    await clientB.authenticate({ challenge: 'b' }, {});

    expect(native.authenticateCredential).toHaveBeenNthCalledWith(
      1,
      { challenge: 'a' },
      { useFido2ApiClient: true },
    );
    expect(native.authenticateCredential).toHaveBeenNthCalledWith(
      2,
      { challenge: 'b' },
      {},
    );
  });

  it('iOS client prunes android ceremony blocks before native', async () => {
    const { createFidoClient, native } = await loadClient('ios');
    const client = createFidoClient();

    await client.register(
      { challenge: 'a' },
      {
        android: { credentialManager: { clientDataHash: 'abc' } },
      },
    );

    expect(native.registerCredential).toHaveBeenCalledWith(
      { challenge: 'a' },
      {},
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('accepts typed ceremony option objects without loss', async () => {
    const { createFidoClient, native } = await loadClient('android');
    const client = createFidoClient();
    const ceremony: FidoRegistrationCeremonyOptions = {
      preferImmediatelyAvailableCredentials: true,
      android: {
        credentialManager: {
          requestJson: { attestation: 'none' },
          clientDataHash: 'YWJj',
          preferImmediatelyAvailableCredentials: false,
          origin: 'https://example.com',
          isAutoSelectAllowed: true,
          isConditional: false,
          preferDefaultProvider: 'com.example/.Provider',
        },
      },
    };

    await client.register({ challenge: 'a' }, ceremony);

    expect(native.registerCredential).toHaveBeenCalledWith(
      { challenge: 'a' },
      {
        preferImmediatelyAvailableCredentials: true,
        android: {
          credentialManager: {
            requestJson: { attestation: 'none' },
            clientDataHash: 'YWJj',
            preferImmediatelyAvailableCredentials: false,
            origin: 'https://example.com',
            isAutoSelectAllowed: true,
            isConditional: false,
            preferDefaultProvider: 'com.example/.Provider',
          },
        },
      },
    );
  });

  it('noopLogger default keeps buildNativeConfig working without a logger', async () => {
    const { createFidoClient, native } = await loadClient('ios');
    const client = createFidoClient();

    await client.register(
      { challenge: 'a' },
      {
        android: { credentialManager: {} },
      },
    );

    expect(native.registerCredential).toHaveBeenCalledWith(
      { challenge: 'a' },
      {},
    );
  });
});
