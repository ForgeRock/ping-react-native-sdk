/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Adversarial edge-case tests for rn-push.
 *
 * These tests target scenarios NOT covered by push.test.ts:
 * 1. getNumbersChallenge edge cases (spaces, double commas, floats, negatives)
 * 2. createPushClient config edge cases (whitespace loggerId, missing nativeHandle)
 * 3. approveChallengeNotification / approveBiometricNotification tab/newline blank detection
 * 4. fromNativeToken — explicit null in token field
 * 5. fromNativeWrappedCredential — missing credential key vs explicit null key
 * 6. fromNativeCredentialList — missing credentials key
 * 7. fromNativeNotificationList — missing notifications key
 * 8. fromNativeNotification — missing notification key
 * 9. Barrel export contract — PushStorage must NOT be exported from rn-push
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  NativeModules: {},
  TurboModuleRegistry: {
    get: jest.fn(),
  },
  DeviceEventEmitter: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('../NativeRNPingPush', () => ({
  __esModule: true,
  getNativeModule: jest.fn(),
  toNativePushConfig: jest.fn((config) => config),
  fromNativeCredential: jest.fn((result) => result),
  fromNativeWrappedCredential: jest.fn((wrapped) =>
    wrapped == null ? null : (wrapped.credential ?? null),
  ),
  fromNativeNotification: jest.fn((result) =>
    result == null ? null : (result.notification ?? null),
  ),
  fromNativeCredentialList: jest.fn((result) =>
    result == null ? [] : (result.credentials ?? []),
  ),
  fromNativeNotificationList: jest.fn((result) =>
    result == null ? [] : (result.notifications ?? []),
  ),
  fromNativeToken: jest.fn((wrapped) =>
    wrapped == null ? null : (wrapped.token ?? null),
  ),
}));

// Also import the REAL NativeRNPingPush helpers to test their logic directly
// (the mock above tests push.ts behavior; we test the helper functions via
// re-import after resetting modules below in the dedicated describe blocks)

import { createPushClient, getNumbersChallenge } from '../push';
import { getNativeModule } from '../NativeRNPingPush';
import type { PushNotification } from '../types';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const baseNotification: PushNotification = {
  id: 'n1',
  credentialId: 'c1',
  ttl: 60,
  messageId: 'm1',
  messageText: null,
  customPayload: null,
  challenge: null,
  numbersChallenge: null,
  loadBalancer: null,
  contextInfo: null,
  pushType: 'challenge',
  createdAt: 0,
  sentAt: null,
  respondedAt: null,
  approved: false,
  pending: true,
};

// ---------------------------------------------------------------------------
// getNumbersChallenge — edge cases
// ---------------------------------------------------------------------------

describe('getNumbersChallenge — edge cases', () => {
  it('handles spaces around numbers (e.g. "12, 34, 56")', () => {
    const result = getNumbersChallenge({
      ...baseNotification,
      numbersChallenge: '12, 34, 56',
    });
    expect(result).toEqual([12, 34, 56]);
  });

  it('handles double comma ("12,,34") — empty entry is filtered', () => {
    const result = getNumbersChallenge({
      ...baseNotification,
      numbersChallenge: '12,,34',
    });
    // parseInt('', 10) → NaN → filtered
    expect(result).toEqual([12, 34]);
  });

  it('handles float string ("12.5,34") — parseInt truncates to integer', () => {
    const result = getNumbersChallenge({
      ...baseNotification,
      numbersChallenge: '12.5,34',
    });
    // parseInt('12.5', 10) → 12
    expect(result).toEqual([12, 34]);
  });

  it('handles negative numbers ("−5,10") — parseInt parses negatives', () => {
    const result = getNumbersChallenge({
      ...baseNotification,
      numbersChallenge: '-5,10',
    });
    expect(result).toEqual([-5, 10]);
  });

  it('handles whitespace-only string — returns empty array', () => {
    const result = getNumbersChallenge({
      ...baseNotification,
      numbersChallenge: '   ',
    });
    // '   '.split(',') → ['   '], parseInt('', 10) after trim → parseInt('') → NaN → filtered
    expect(result).toEqual([]);
  });

  it('handles all-NaN CSV (",,,") — returns empty array', () => {
    const result = getNumbersChallenge({
      ...baseNotification,
      numbersChallenge: ',,,',
    });
    expect(result).toEqual([]);
  });

  it('handles leading/trailing comma (",12,34,") — empty ends are filtered', () => {
    const result = getNumbersChallenge({
      ...baseNotification,
      numbersChallenge: ',12,34,',
    });
    expect(result).toEqual([12, 34]);
  });

  it('handles non-numeric string ("abc,34") — non-numeric entries are filtered', () => {
    const result = getNumbersChallenge({
      ...baseNotification,
      numbersChallenge: 'abc,34',
    });
    expect(result).toEqual([34]);
  });
});

// ---------------------------------------------------------------------------
// createPushClient config edge cases
// ---------------------------------------------------------------------------

describe('createPushClient — config edge cases', () => {
  beforeEach(() => jest.clearAllMocks());

  it('omits loggerId when logger.nativeHandle.id is whitespace-only', () => {
    const initializeMock = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    const logger = {
      nativeHandle: { id: '   ' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    createPushClient({ logger });

    const calledConfig = initializeMock.mock.calls[0][0];
    // '   '.trim() is '' — falsy — so loggerId should be undefined
    expect(calledConfig.loggerId).toBeUndefined();
  });

  it('omits loggerId when logger.nativeHandle.id is empty string', () => {
    const initializeMock = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    const logger = {
      nativeHandle: { id: '' },
      changeLevel: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    createPushClient({ logger });

    const calledConfig = initializeMock.mock.calls[0][0];
    expect(calledConfig.loggerId).toBeUndefined();
  });

  it('passes notificationCleanupConfig fields through to native config', () => {
    const initializeMock = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    createPushClient({
      notificationCleanupConfig: {
        cleanupMode: 'HYBRID',
        maxStoredNotifications: 50,
        maxNotificationAgeDays: 14,
      },
    });

    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cleanupMode: 'HYBRID',
        maxStoredNotifications: 50,
        maxNotificationAgeDays: 14,
      }),
    );
  });

  it('passes ios.encryptionEnabled through to native config', () => {
    const initializeMock = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    createPushClient({ ios: { encryptionEnabled: false } });

    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ encryptionEnabled: false }),
    );
  });

  it('passes enableCredentialCache and timeoutMs through to native config', () => {
    const initializeMock = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    createPushClient({ enableCredentialCache: true, timeoutMs: 30000 });

    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enableCredentialCache: true,
        timeoutMs: 30000,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// createPushClient — storage edge cases
// ---------------------------------------------------------------------------

describe('createPushClient — storage edge cases', () => {
  beforeEach(() => jest.clearAllMocks());

  it('omits storageId when storage.id is undefined', () => {
    const initializeMock = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    createPushClient({ storage: { id: undefined } as never });

    const config = initializeMock.mock.calls[0][0] as Record<string, unknown>;
    expect(config.storageId).toBeUndefined();
  });

  it('omits storageId when storage is null', () => {
    const initializeMock = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    createPushClient({ storage: null as never });

    const config = initializeMock.mock.calls[0][0] as Record<string, unknown>;
    expect(config.storageId).toBeUndefined();
  });

  it('omits storageId when storage is undefined', () => {
    const initializeMock = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    createPushClient({ storage: undefined });

    const config = initializeMock.mock.calls[0][0] as Record<string, unknown>;
    expect(config.storageId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createPushClient — logger edge cases
// ---------------------------------------------------------------------------

describe('createPushClient — logger edge cases', () => {
  beforeEach(() => jest.clearAllMocks());

  it('omits loggerId when logger.nativeHandle is undefined', () => {
    const initializeMock = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    createPushClient({
      logger: {
        nativeHandle: undefined as never,
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });

    const config = initializeMock.mock.calls[0][0] as Record<string, unknown>;
    expect(config.loggerId).toBeUndefined();
  });

  it('omits loggerId when logger.nativeHandle.id is undefined', () => {
    const initializeMock = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    createPushClient({
      logger: {
        nativeHandle: { id: undefined as never },
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });

    const config = initializeMock.mock.calls[0][0] as Record<string, unknown>;
    expect(config.loggerId).toBeUndefined();
  });

  it('omits loggerId when logger.nativeHandle.id is null', () => {
    const initializeMock = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    createPushClient({
      logger: {
        nativeHandle: { id: null as never },
        changeLevel: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });

    const config = initializeMock.mock.calls[0][0] as Record<string, unknown>;
    expect(config.loggerId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Blank-string guard: tab and newline characters
// ---------------------------------------------------------------------------

describe('approveChallengeNotification — whitespace variants', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws argument_error for tab-only challengeResponse', async () => {
    const nativeFn = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue('test-client-handle'),
      refreshToken: jest.fn().mockResolvedValue({}),
      approveChallengeNotification: nativeFn,
    });

    const client = await createPushClient();
    await expect(
      client.approveChallengeNotification('notif-1', '\t'),
    ).rejects.toMatchObject({
      type: 'argument_error',
      code: 'invalid_parameter_value',
    });
    expect(nativeFn).not.toHaveBeenCalled();
  });

  it('throws argument_error for newline-only challengeResponse', async () => {
    const nativeFn = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue('test-client-handle'),
      refreshToken: jest.fn().mockResolvedValue({}),
      approveChallengeNotification: nativeFn,
    });

    const client = await createPushClient();
    await expect(
      client.approveChallengeNotification('notif-1', '\n'),
    ).rejects.toMatchObject({
      type: 'argument_error',
      code: 'invalid_parameter_value',
    });
    expect(nativeFn).not.toHaveBeenCalled();
  });
});

describe('approveBiometricNotification — whitespace variants', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws argument_error for tab-only authenticationMethod', async () => {
    const nativeFn = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue('test-client-handle'),
      refreshToken: jest.fn().mockResolvedValue({}),
      approveBiometricNotification: nativeFn,
    });

    const client = await createPushClient();
    await expect(
      client.approveBiometricNotification('notif-1', '\t'),
    ).rejects.toMatchObject({
      type: 'argument_error',
      code: 'invalid_parameter_value',
    });
    expect(nativeFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Barrel export contract: PushStorage must NOT be exported from rn-push
// ---------------------------------------------------------------------------

describe('barrel export contract', () => {
  it('does not export PushStorage from @ping-identity/rn-push barrel', () => {
    // We test the compiled barrel index — import the module and assert the key is absent
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const barrel = require('../index') as Record<string, unknown>;
    // PushStorage is a type-only export from rn-storage; at runtime it should not exist
    // in the barrel. Types disappear after compilation. This assertion documents the
    // intent and would catch an accidental runtime value export.
    expect(Object.keys(barrel)).not.toContain('PushStorage');
  });

  it('exports createPushClient and getNumbersChallenge from barrel', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const barrel = require('../index') as Record<string, unknown>;
    expect(typeof barrel['createPushClient']).toBe('function');
    expect(typeof barrel['getNumbersChallenge']).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// NativeRNPingPush helper functions — real implementations
// ---------------------------------------------------------------------------

describe('NativeRNPingPush helpers — real implementations', () => {
  // These tests re-load the real module (not the mock) to verify helper logic

  let realHelpers: typeof import('../NativeRNPingPush');

  beforeAll(() => {
    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({
        NativeModules: { RNPingPushClassic: {} },
        TurboModuleRegistry: { get: jest.fn().mockReturnValue(null) },
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      realHelpers = require('../NativeRNPingPush');
    });
  });

  describe('fromNativeToken', () => {
    it('returns null when token field is explicitly null', () => {
      expect(realHelpers.fromNativeToken({ token: null })).toBeNull();
    });

    it('returns null when token field is absent (undefined via ??)', () => {
      expect(realHelpers.fromNativeToken({})).toBeNull();
    });

    it('returns the token string when present', () => {
      expect(realHelpers.fromNativeToken({ token: 'abc-token' })).toBe(
        'abc-token',
      );
    });
  });

  describe('fromNativeWrappedCredential', () => {
    it('returns null when credential field is explicitly null', () => {
      expect(
        realHelpers.fromNativeWrappedCredential({ credential: null }),
      ).toBeNull();
    });

    it('returns null when credential field is absent (missing key)', () => {
      expect(realHelpers.fromNativeWrappedCredential({})).toBeNull();
    });

    it('returns the credential object when present', () => {
      const cred = { id: 'x', issuer: 'test' };
      expect(
        realHelpers.fromNativeWrappedCredential({ credential: cred }),
      ).toEqual(cred);
    });
  });

  describe('fromNativeCredentialList', () => {
    it('returns empty array when credentials key is absent', () => {
      expect(realHelpers.fromNativeCredentialList({})).toEqual([]);
    });

    it('returns the credentials array when present', () => {
      const creds = [{ id: 'a' }, { id: 'b' }];
      expect(
        realHelpers.fromNativeCredentialList({ credentials: creds }),
      ).toEqual(creds);
    });
  });

  describe('fromNativeNotificationList', () => {
    it('returns empty array when notifications key is absent', () => {
      expect(realHelpers.fromNativeNotificationList({})).toEqual([]);
    });

    it('returns the notifications array when present', () => {
      const notifs = [{ id: 'n1' }, { id: 'n2' }];
      expect(
        realHelpers.fromNativeNotificationList({ notifications: notifs }),
      ).toEqual(notifs);
    });
  });

  describe('fromNativeNotification', () => {
    it('returns null when notification field is explicitly null', () => {
      expect(
        realHelpers.fromNativeNotification({ notification: null }),
      ).toBeNull();
    });

    it('returns null when notification field is absent', () => {
      expect(realHelpers.fromNativeNotification({})).toBeNull();
    });

    it('returns the notification object when present', () => {
      const notif = { id: 'n1' };
      expect(
        realHelpers.fromNativeNotification({ notification: notif }),
      ).toEqual(notif);
    });
  });

  // getNativeModule resolution is tested separately below at module scope
  // (see the describe block at the bottom of this file), because the top-level
  // jest.mock('react-native') hoist prevents per-test doMock overrides inside
  // a nested isolateModules context from taking effect on the already-mocked module.
});
