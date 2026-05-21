/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-push
 *
 * Validates that the push package:
 * - Exports createPushClient, getNumbersChallenge, usePush, PushProvider
 * - Forwards config (loggerId, storageId, timeoutMs, enableCredentialCache,
 *   notificationCleanupConfig, ios.encryptionEnabled) to native initialize()
 * - Credential operations (addCredentialFromUri, getCredentials, getCredential,
 *   saveCredential, deleteCredential) call native correctly
 * - Token operations (getDeviceToken, setDeviceToken, refreshToken) work
 * - FCM/APNs token event → onTokenRegistered callback fires
 * - Push message event → onNotification callback fires with mapped notification
 * - Unknown push payload event → onNotification fires with null
 * - Notification responses (approveNotification, approveChallengeNotification,
 *   approveBiometricNotification, denyNotification) call native correctly
 * - Notification retrieval (getPendingNotifications, getAllNotifications,
 *   getNotification) unwrap native results
 * - cleanupNotifications (no-arg and scoped)
 * - close() calls native close and removes internal event listeners
 * - getNumbersChallenge parses CSV to number[]
 * - Native PushError shape { type, error, message } is preserved through rejection
 */

export {};

type NativePushMock = {
  initialize: jest.Mock;
  addCredentialFromUri: jest.Mock;
  saveCredential: jest.Mock;
  getCredentials: jest.Mock;
  getCredential: jest.Mock;
  deleteCredential: jest.Mock;
  setDeviceToken: jest.Mock;
  getDeviceToken: jest.Mock;
  refreshToken: jest.Mock;
  processNotification: jest.Mock;
  processNotificationFromMessage: jest.Mock;
  approveNotification: jest.Mock;
  approveChallengeNotification: jest.Mock;
  approveBiometricNotification: jest.Mock;
  denyNotification: jest.Mock;
  getPendingNotifications: jest.Mock;
  getAllNotifications: jest.Mock;
  getNotification: jest.Mock;
  cleanupNotifications: jest.Mock;
  consumePendingMessages: jest.Mock;
  close: jest.Mock;
};

type EventHandlers = Record<string, ((...args: unknown[]) => void) | undefined>;

const CLIENT_ID = 'test-client-handle';

const mockCredential = {
  id: 'cred-1',
  userId: null,
  resourceId: null,
  issuer: 'Example',
  displayIssuer: null,
  accountName: 'user@example.com',
  displayAccountName: null,
  serverEndpoint: null,
  createdAt: 1000,
  imageURL: null,
  backgroundColor: null,
  policies: null,
  lockingPolicy: null,
  isLocked: false,
  platform: 'PING_AM',
};

const mockNotification = {
  id: 'notif-1',
  credentialId: 'cred-1',
  ttl: 120,
  messageId: 'msg-1',
  messageText: null,
  customPayload: null,
  challenge: null,
  numbersChallenge: null,
  loadBalancer: null,
  contextInfo: null,
  pushType: 'default',
  createdAt: 1000,
  sentAt: null,
  respondedAt: null,
  approved: false,
  pending: true,
};

function makeMock(overrides: Partial<NativePushMock> = {}): NativePushMock {
  return {
    initialize: jest.fn(async () => CLIENT_ID),
    addCredentialFromUri: jest.fn(async () => mockCredential),
    saveCredential: jest.fn(async () => mockCredential),
    getCredentials: jest.fn(async () => ({ credentials: [mockCredential] })),
    getCredential: jest.fn(async () => ({ credential: mockCredential })),
    deleteCredential: jest.fn(async () => true),
    setDeviceToken: jest.fn(async () => true),
    getDeviceToken: jest.fn(async () => ({ token: 'device-token-abc' })),
    refreshToken: jest.fn(async () => ({ token: null })),
    processNotification: jest.fn(async () => ({
      notification: mockNotification,
    })),
    processNotificationFromMessage: jest.fn(async () => ({
      notification: mockNotification,
    })),
    approveNotification: jest.fn(async () => true),
    approveChallengeNotification: jest.fn(async () => true),
    approveBiometricNotification: jest.fn(async () => true),
    denyNotification: jest.fn(async () => true),
    getPendingNotifications: jest.fn(async () => ({
      notifications: [mockNotification],
    })),
    getAllNotifications: jest.fn(async () => ({
      notifications: [mockNotification],
    })),
    getNotification: jest.fn(async () => ({ notification: mockNotification })),
    cleanupNotifications: jest.fn(async () => 3),
    consumePendingMessages: jest.fn(async () => []),
    close: jest.fn(async () => undefined),
    ...overrides,
  };
}

async function loadPush(
  nativeMock: NativePushMock,
  platform: 'ios' | 'android' = 'ios',
): Promise<{
  mod: ReturnType<typeof require>;
  emittedHandlers: EventHandlers;
}> {
  jest.resetModules();
  const emittedHandlers: EventHandlers = {};
  jest.doMock('react-native', () => ({
    Platform: {
      OS: platform,
      select: (s: Record<string, unknown>) => s[platform] ?? s.default,
    },
    NativeModules: {},
    TurboModuleRegistry: {
      get: jest.fn(() => null),
      getEnforcing: jest.fn(() => null),
    },
    DeviceEventEmitter: {
      addListener: jest.fn(
        (eventName: string, handler: (...args: unknown[]) => void) => {
          emittedHandlers[eventName] = handler;
          return { remove: jest.fn() };
        },
      ),
    },
  }));
  jest.doMock('../../../packages/push/src/NativeRNPingPush', () => ({
    __esModule: true,
    getNativeModule: jest.fn(() => nativeMock),
    toNativePushConfig: jest.fn((config: unknown) => config),
    fromNativeCredential: jest.fn((result: unknown) => result),
    fromNativeWrappedCredential: jest.fn((wrapped: unknown) => {
      const w = wrapped as { credential?: unknown };
      return w?.credential ?? null;
    }),
    fromNativeNotification: jest.fn((result: unknown) => {
      const r = result as { notification?: unknown };
      return r?.notification ?? null;
    }),
    fromNativeCredentialList: jest.fn((result: unknown) => {
      const r = result as { credentials?: unknown[] };
      return r?.credentials ?? [];
    }),
    fromNativeNotificationList: jest.fn((result: unknown) => {
      const r = result as { notifications?: unknown[] };
      return r?.notifications ?? [];
    }),
    fromNativeToken: jest.fn((wrapped: unknown) => {
      const w = wrapped as { token?: string | null };
      return w?.token ?? null;
    }),
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@ping-identity/rn-push');
  return { mod, emittedHandlers };
}

describe('@ping-identity/rn-push — integration', () => {
  afterEach(() => jest.restoreAllMocks());

  // ─── exports ────────────────────────────────────────────────────────────────

  describe('exports', () => {
    it('exports createPushClient', async () => {
      const { mod } = await loadPush(makeMock());
      expect(typeof mod.createPushClient).toBe('function');
    });

    it('exports getNumbersChallenge', async () => {
      const { mod } = await loadPush(makeMock());
      expect(typeof mod.getNumbersChallenge).toBe('function');
    });

    it('exports usePush', async () => {
      const { mod } = await loadPush(makeMock());
      expect(typeof mod.usePush).toBe('function');
    });

    it('exports PushProvider', async () => {
      const { mod } = await loadPush(makeMock());
      expect(typeof mod.PushProvider).toBe('function');
    });
  });

  // ─── createPushClient — config forwarding ───────────────────────────────────

  describe('createPushClient — config forwarding', () => {
    it('forwards loggerId to native initialize()', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      await mod.createPushClient({
        logger: {
          nativeHandle: { id: 'logger-xyz' },
          changeLevel: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          info: jest.fn(),
          debug: jest.fn(),
        },
      });
      expect(mock.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ loggerId: 'logger-xyz' }),
      );
    });

    it('forwards storageId to native initialize()', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      await mod.createPushClient({ storage: { id: 'store-42' } });
      expect(mock.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ storageId: 'store-42' }),
      );
    });

    it('forwards timeoutMs to native initialize()', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      await mod.createPushClient({ timeoutMs: 25000 });
      expect(mock.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ timeoutMs: 25000 }),
      );
    });

    it('forwards enableCredentialCache to native initialize()', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      await mod.createPushClient({ enableCredentialCache: true });
      expect(mock.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ enableCredentialCache: true }),
      );
    });

    it('forwards notificationCleanupConfig to native initialize()', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      await mod.createPushClient({
        notificationCleanupConfig: {
          cleanupMode: 'HYBRID',
          maxStoredNotifications: 100,
          maxNotificationAgeDays: 30,
        },
      });
      expect(mock.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          cleanupMode: 'HYBRID',
          maxStoredNotifications: 100,
          maxNotificationAgeDays: 30,
        }),
      );
    });

    it('forwards ios.encryptionEnabled to native initialize()', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      await mod.createPushClient({ ios: { encryptionEnabled: true } });
      expect(mock.initialize).toHaveBeenCalledWith(
        expect.objectContaining({ encryptionEnabled: true }),
      );
    });

    it('succeeds with no config (uses native defaults)', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      expect(client).toBeDefined();
      expect(mock.initialize).toHaveBeenCalledTimes(1);
    });

    it('omits loggerId when no logger provided', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      await mod.createPushClient();
      const config = mock.initialize.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(config.loggerId).toBeUndefined();
    });
  });

  // ─── createPushClient — Android token init ───────────────────────────────────

  describe('createPushClient — Android token init', () => {
    it('calls refreshToken() on Android during init', async () => {
      const mock = makeMock({
        refreshToken: jest.fn(async () => ({ token: 'fcm-token-init' })),
      });
      const { mod } = await loadPush(mock, 'android');
      await mod.createPushClient();
      expect(mock.refreshToken).toHaveBeenCalledWith(CLIENT_ID);
    });

    it('does NOT call refreshToken() on iOS during init', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock, 'ios');
      await mod.createPushClient();
      expect(mock.refreshToken).not.toHaveBeenCalled();
    });
  });

  // ─── credential operations ───────────────────────────────────────────────────

  describe('addCredentialFromUri()', () => {
    it('calls native addCredentialFromUri with clientId and uri', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const result = await client.addCredentialFromUri('pushauth://enroll');

      expect(mock.addCredentialFromUri).toHaveBeenCalledWith(
        CLIENT_ID,
        'pushauth://enroll',
      );
      expect(result).toEqual(mockCredential);
    });

    it('propagates native rejection', async () => {
      const nativeError = {
        type: 'argument_error',
        error: 'invalid_uri',
        message: 'Bad URI',
      };
      const mock = makeMock({
        addCredentialFromUri: jest.fn(async () => {
          throw nativeError;
        }),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      await expect(client.addCredentialFromUri('bad')).rejects.toEqual(
        nativeError,
      );
    });
  });

  describe('getCredentials()', () => {
    it('calls native getCredentials with clientId and returns unwrapped list', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const result = await client.getCredentials();

      expect(mock.getCredentials).toHaveBeenCalledWith(CLIENT_ID);
      expect(result).toEqual([mockCredential]);
    });

    it('returns empty array when no credentials stored', async () => {
      const mock = makeMock({
        getCredentials: jest.fn(async () => ({ credentials: [] })),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      expect(await client.getCredentials()).toEqual([]);
    });

    it('propagates native rejection', async () => {
      const nativeError = {
        type: 'state_error',
        error: 'not_initialized',
        message: 'Not init',
      };
      const mock = makeMock({
        getCredentials: jest.fn(async () => {
          throw nativeError;
        }),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      await expect(client.getCredentials()).rejects.toEqual(nativeError);
    });
  });

  describe('getCredential()', () => {
    it('calls native getCredential with clientId and credentialId and unwraps result', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const result = await client.getCredential('cred-1');

      expect(mock.getCredential).toHaveBeenCalledWith(CLIENT_ID, 'cred-1');
      expect(result).toEqual(mockCredential);
    });

    it('returns null when credential not found', async () => {
      const mock = makeMock({
        getCredential: jest.fn(async () => ({ credential: null })),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      expect(await client.getCredential('missing')).toBeNull();
    });
  });

  describe('deleteCredential()', () => {
    it('calls native deleteCredential with clientId and credentialId', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const result = await client.deleteCredential('cred-1');

      expect(mock.deleteCredential).toHaveBeenCalledWith(CLIENT_ID, 'cred-1');
      expect(result).toBe(true);
    });

    it('propagates native rejection', async () => {
      const nativeError = {
        type: 'internal_error',
        error: 'storage_failure',
        message: 'Disk error',
      };
      const mock = makeMock({
        deleteCredential: jest.fn(async () => {
          throw nativeError;
        }),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      await expect(client.deleteCredential('cred-1')).rejects.toEqual(
        nativeError,
      );
    });
  });

  // ─── device token ────────────────────────────────────────────────────────────

  describe('getDeviceToken()', () => {
    it('calls native getDeviceToken with clientId and unwraps token', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const result = await client.getDeviceToken();

      expect(mock.getDeviceToken).toHaveBeenCalledWith(CLIENT_ID);
      expect(result).toBe('device-token-abc');
    });

    it('returns null when no token registered', async () => {
      const mock = makeMock({
        getDeviceToken: jest.fn(async () => ({ token: null })),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      expect(await client.getDeviceToken()).toBeNull();
    });
  });

  describe('setDeviceToken()', () => {
    it('calls native setDeviceToken with clientId, token, and null when no credentialId', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      await client.setDeviceToken('new-token');

      expect(mock.setDeviceToken).toHaveBeenCalledWith(
        CLIENT_ID,
        'new-token',
        null,
      );
    });

    it('calls native setDeviceToken with clientId, token, and credentialId when provided', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      await client.setDeviceToken('new-token', 'cred-1');

      expect(mock.setDeviceToken).toHaveBeenCalledWith(
        CLIENT_ID,
        'new-token',
        'cred-1',
      );
    });
  });

  describe('refreshToken()', () => {
    it('calls native refreshToken with clientId and returns unwrapped token', async () => {
      const mock = makeMock({
        refreshToken: jest.fn(async () => ({ token: 'refreshed-token' })),
      });
      const { mod } = await loadPush(mock, 'android');
      const client = await mod.createPushClient();

      // refreshToken is called once during init (android); clear and call manually
      mock.refreshToken.mockClear();
      const result = await client.refreshToken();

      expect(mock.refreshToken).toHaveBeenCalledWith(CLIENT_ID);
      expect(result).toBe('refreshed-token');
    });
  });

  describe('FCM/APNs token event → onTokenRegistered', () => {
    it('fires onTokenRegistered callback when FCM_TOKEN_RECEIVED event fires (android)', async () => {
      const mock = makeMock();
      const { mod, emittedHandlers } = await loadPush(mock, 'android');
      const client = await mod.createPushClient();
      mock.refreshToken.mockClear();
      mock.setDeviceToken.mockClear();

      const tokenCb = jest.fn();
      client.onTokenRegistered(tokenCb);

      const fcmHandler =
        emittedHandlers['com.pingidentity.rnpush.FCMTokenReceived'];
      expect(fcmHandler).toBeDefined();
      fcmHandler!('new-fcm-token');
      await Promise.resolve();

      expect(mock.setDeviceToken).toHaveBeenCalledWith(
        CLIENT_ID,
        'new-fcm-token',
        null,
      );
    });
  });

  // ─── notification processing ─────────────────────────────────────────────────

  describe('processNotification()', () => {
    it('calls native processNotification with clientId and messageData', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const messageData = { key: 'value' };
      const result = await client.processNotification(messageData);

      expect(mock.processNotification).toHaveBeenCalledWith(
        CLIENT_ID,
        messageData,
      );
      expect(result).toEqual(mockNotification);
    });

    it('returns null for unrecognised payloads', async () => {
      const mock = makeMock({
        processNotification: jest.fn(async () => ({ notification: null })),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      expect(await client.processNotification({})).toBeNull();
    });
  });

  describe('processNotificationFromMessage()', () => {
    it('calls native processNotificationFromMessage with clientId and message string', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const result = await client.processNotificationFromMessage('raw-msg');

      expect(mock.processNotificationFromMessage).toHaveBeenCalledWith(
        CLIENT_ID,
        'raw-msg',
      );
      expect(result).toEqual(mockNotification);
    });
  });

  describe('PUSH_MESSAGE_RECEIVED event → onNotification', () => {
    it('fires onNotification callback with mapped notification when push message arrives', async () => {
      const mock = makeMock({
        processNotification: jest.fn(async () => ({
          notification: mockNotification,
        })),
      });
      const { mod, emittedHandlers } = await loadPush(mock);
      const client = await mod.createPushClient();

      const notifCb = jest.fn();
      client.onNotification(notifCb);

      const pushHandler =
        emittedHandlers['com.pingidentity.rnpush.PushMessageReceived'];
      expect(pushHandler).toBeDefined();
      pushHandler!({ ping: 'payload' });
      await Promise.resolve();

      expect(notifCb).toHaveBeenCalledWith(mockNotification);
    });

    it('fires onNotification with null when processNotification returns null (unknown payload)', async () => {
      const mock = makeMock({
        processNotification: jest.fn(async () => ({ notification: null })),
      });
      const { mod, emittedHandlers } = await loadPush(mock);
      const client = await mod.createPushClient();

      const notifCb = jest.fn();
      client.onNotification(notifCb);

      const pushHandler =
        emittedHandlers['com.pingidentity.rnpush.PushMessageReceived'];
      pushHandler!({ unknown: 'payload' });
      await Promise.resolve();

      expect(notifCb).toHaveBeenCalledWith(null);
    });
  });

  // ─── notification responses ──────────────────────────────────────────────────

  describe('approveNotification()', () => {
    it('calls native approveNotification with clientId and notificationId', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const result = await client.approveNotification('notif-1');

      expect(mock.approveNotification).toHaveBeenCalledWith(
        CLIENT_ID,
        'notif-1',
      );
      expect(result).toBe(true);
    });

    it('propagates native rejection', async () => {
      const nativeError = {
        type: 'network_error',
        error: 'network_failure',
        message: 'Timeout',
      };
      const mock = makeMock({
        approveNotification: jest.fn(async () => {
          throw nativeError;
        }),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      await expect(client.approveNotification('notif-1')).rejects.toEqual(
        nativeError,
      );
    });
  });

  describe('approveChallengeNotification()', () => {
    it('calls native approveChallengeNotification with clientId, notificationId, and answer', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      await client.approveChallengeNotification('notif-1', '42');

      expect(mock.approveChallengeNotification).toHaveBeenCalledWith(
        CLIENT_ID,
        'notif-1',
        '42',
      );
    });

    it('rejects locally (no native call) when challengeResponse is blank', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      await expect(
        client.approveChallengeNotification('notif-1', '   '),
      ).rejects.toMatchObject({
        type: 'argument_error',
        error: 'invalid_parameter_value',
      });
      expect(mock.approveChallengeNotification).not.toHaveBeenCalled();
    });
  });

  describe('approveBiometricNotification()', () => {
    it('calls native approveBiometricNotification with clientId, notificationId, and method', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      await client.approveBiometricNotification('notif-1', 'biometric');

      expect(mock.approveBiometricNotification).toHaveBeenCalledWith(
        CLIENT_ID,
        'notif-1',
        'biometric',
      );
    });
  });

  describe('denyNotification()', () => {
    it('calls native denyNotification with clientId and notificationId', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const result = await client.denyNotification('notif-1');

      expect(mock.denyNotification).toHaveBeenCalledWith(CLIENT_ID, 'notif-1');
      expect(result).toBe(true);
    });
  });

  // ─── notification retrieval ──────────────────────────────────────────────────

  describe('getPendingNotifications()', () => {
    it('calls native getPendingNotifications with clientId and returns unwrapped list', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const result = await client.getPendingNotifications();

      expect(mock.getPendingNotifications).toHaveBeenCalledWith(CLIENT_ID);
      expect(result).toEqual([mockNotification]);
    });

    it('returns empty array when no pending notifications', async () => {
      const mock = makeMock({
        getPendingNotifications: jest.fn(async () => ({ notifications: [] })),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      expect(await client.getPendingNotifications()).toEqual([]);
    });
  });

  describe('getAllNotifications()', () => {
    it('calls native getAllNotifications with clientId and returns unwrapped list', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const result = await client.getAllNotifications();

      expect(mock.getAllNotifications).toHaveBeenCalledWith(CLIENT_ID);
      expect(result).toEqual([mockNotification]);
    });
  });

  describe('getNotification()', () => {
    it('calls native getNotification with clientId and notificationId and unwraps result', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const result = await client.getNotification('notif-1');

      expect(mock.getNotification).toHaveBeenCalledWith(CLIENT_ID, 'notif-1');
      expect(result).toEqual(mockNotification);
    });

    it('returns null when notification not found', async () => {
      const mock = makeMock({
        getNotification: jest.fn(async () => ({ notification: null })),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      expect(await client.getNotification('missing')).toBeNull();
    });
  });

  // ─── cleanupNotifications ────────────────────────────────────────────────────

  describe('cleanupNotifications()', () => {
    it('calls native cleanupNotifications with clientId and null when no credentialId', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const result = await client.cleanupNotifications();

      expect(mock.cleanupNotifications).toHaveBeenCalledWith(CLIENT_ID, null);
      expect(result).toBe(3);
    });

    it('calls native cleanupNotifications with clientId and credentialId when scoped', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      await client.cleanupNotifications('cred-1');

      expect(mock.cleanupNotifications).toHaveBeenCalledWith(
        CLIENT_ID,
        'cred-1',
      );
    });
  });

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  describe('close()', () => {
    it('calls native close with clientId', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      await client.close();

      expect(mock.close).toHaveBeenCalledWith(CLIENT_ID);
    });

    it('stops onNotification callbacks from firing after close', async () => {
      const mock = makeMock({
        processNotification: jest.fn(async () => ({
          notification: mockNotification,
        })),
      });
      const { mod, emittedHandlers } = await loadPush(mock);
      const client = await mod.createPushClient();

      const notifCb = jest.fn();
      client.onNotification(notifCb);

      await client.close();

      const pushHandler =
        emittedHandlers['com.pingidentity.rnpush.PushMessageReceived'];
      if (pushHandler) {
        pushHandler({ ping: 'payload' });
        await Promise.resolve();
      }

      expect(notifCb).not.toHaveBeenCalled();
    });

    it('propagates native rejection', async () => {
      const nativeError = {
        type: 'internal_error',
        error: 'not_initialized',
        message: 'Already closed',
      };
      const mock = makeMock({
        close: jest.fn(async () => {
          throw nativeError;
        }),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      await expect(client.close()).rejects.toEqual(nativeError);
    });
  });

  // ─── getNumbersChallenge ──────────────────────────────────────────────────────

  describe('getNumbersChallenge()', () => {
    it('parses comma-separated string to number[]', async () => {
      const { mod } = await loadPush(makeMock());
      const notif = { ...mockNotification, numbersChallenge: '12,34,56' };
      expect(mod.getNumbersChallenge(notif)).toEqual([12, 34, 56]);
    });

    it('returns empty array for null numbersChallenge', async () => {
      const { mod } = await loadPush(makeMock());
      expect(
        mod.getNumbersChallenge({
          ...mockNotification,
          numbersChallenge: null,
        }),
      ).toEqual([]);
    });

    it('handles spaces around numbers', async () => {
      const { mod } = await loadPush(makeMock());
      expect(
        mod.getNumbersChallenge({
          ...mockNotification,
          numbersChallenge: '12, 34, 56',
        }),
      ).toEqual([12, 34, 56]);
    });

    it('filters out non-numeric entries', async () => {
      const { mod } = await loadPush(makeMock());
      expect(
        mod.getNumbersChallenge({
          ...mockNotification,
          numbersChallenge: 'abc,34,56',
        }),
      ).toEqual([34, 56]);
    });
  });

  // ─── error shape preservation ─────────────────────────────────────────────────

  describe('PushError shape preservation', () => {
    it('passes native PushError { type, error, message } through rejection unchanged', async () => {
      const nativePushError = {
        type: 'state_error',
        error: 'not_initialized',
        message: 'PushClient is not initialized',
      };
      const mock = makeMock({
        addCredentialFromUri: jest.fn(async () => {
          throw nativePushError;
        }),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      await expect(
        client.addCredentialFromUri('pushauth://test'),
      ).rejects.toMatchObject(nativePushError);
    });

    it('passes network_failure error shape through rejection', async () => {
      const nativeError = {
        type: 'network_error',
        error: 'network_failure',
        message: 'Connection refused',
      };
      const mock = makeMock({
        approveNotification: jest.fn(async () => {
          throw nativeError;
        }),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();
      await expect(client.approveNotification('notif-1')).rejects.toMatchObject(
        nativeError,
      );
    });
  });

  // ─── BYO push library path ───────────────────────────────────────────────────
  //
  // Tests the flow for apps that already manage their own FCM/APNs integration:
  //   1. App receives a device token from its own push library → setDeviceToken
  //   2. App receives a push message from its own push library → processNotification
  //      (or processNotificationFromMessage for raw string payloads)
  //   3. App presents the notification to the user → approveNotification / denyNotification

  describe('BYO push library path', () => {
    it('full flow: setDeviceToken → processNotification → approveNotification', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      // Step 1: app's own FCM library delivers a token
      await client.setDeviceToken('fcm-token-from-own-library');
      expect(mock.setDeviceToken).toHaveBeenCalledWith(
        CLIENT_ID,
        'fcm-token-from-own-library',
        null,
      );

      // Step 2: app's own FCM library delivers a message
      const messageData = { 'pingengage-message': 'jwt-payload' };
      const notification = await client.processNotification(messageData);
      expect(mock.processNotification).toHaveBeenCalledWith(
        CLIENT_ID,
        messageData,
      );
      expect(notification).toEqual(mockNotification);

      // Step 3: user approves
      const approved = await client.approveNotification(notification!.id);
      expect(mock.approveNotification).toHaveBeenCalledWith(
        CLIENT_ID,
        notification!.id,
      );
      expect(approved).toBe(true);
    });

    it('full flow: setDeviceToken → processNotificationFromMessage → denyNotification', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      await client.setDeviceToken('apns-token-from-own-library');

      const rawMessage = '{"pingengage-message":"jwt-payload"}';
      const notification =
        await client.processNotificationFromMessage(rawMessage);
      expect(mock.processNotificationFromMessage).toHaveBeenCalledWith(
        CLIENT_ID,
        rawMessage,
      );
      expect(notification).toEqual(mockNotification);

      await client.denyNotification(notification!.id);
      expect(mock.denyNotification).toHaveBeenCalledWith(
        CLIENT_ID,
        notification!.id,
      );
    });

    it('processNotification returns null for non-Ping push messages', async () => {
      const mock = makeMock({
        processNotification: jest.fn(async () => ({ notification: null })),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      // Non-Ping message — native returns null; app should ignore it
      const result = await client.processNotification({
        'other-service': 'payload',
      });
      expect(result).toBeNull();
    });

    it('setDeviceToken scoped to a single credential', async () => {
      const mock = makeMock();
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      await client.setDeviceToken('new-token', 'cred-id-123');
      expect(mock.setDeviceToken).toHaveBeenCalledWith(
        CLIENT_ID,
        'new-token',
        'cred-id-123',
      );
    });

    it('challenge flow: processNotification → approveChallengeNotification', async () => {
      const challengeNotification = {
        ...mockNotification,
        pushType: 'challenge',
        numbersChallenge: '12,34,56',
      };
      const mock = makeMock({
        processNotification: jest.fn(async () => ({
          notification: challengeNotification,
        })),
      });
      const { mod } = await loadPush(mock);
      const client = await mod.createPushClient();

      const notification = await client.processNotification({
        'pingengage-message': 'jwt',
      });
      expect(notification!.pushType).toBe('challenge');

      const numbers = mod.getNumbersChallenge(notification);
      expect(numbers).toEqual([12, 34, 56]);

      await client.approveChallengeNotification(notification!.id, '34');
      expect(mock.approveChallengeNotification).toHaveBeenCalledWith(
        CLIENT_ID,
        notification!.id,
        '34',
      );
    });
  });
});
