/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
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

import { createPushClient, getNumbersChallenge } from '../push';
import { getNativeModule } from '../NativeRNPingPush';
import { PushError } from '../types';
import type { PushCredential, PushNotification } from '../types';

// Opaque client handle returned by initialize() in tests.
const MOCK_CLIENT_ID = 'test-client-handle';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const mockNotification: PushNotification = {
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

const mockCredential: PushCredential = {
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

// ---------------------------------------------------------------------------
// Helper: create a mock logger
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    nativeHandle: { id: 'logger-1' },
    changeLevel: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// createPushClient — initialization
// ---------------------------------------------------------------------------

describe('createPushClient — initialization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls initialize() on native module creation', () => {
    const initializeMock = jest.fn().mockResolvedValue(MOCK_CLIENT_ID);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    createPushClient();

    expect(initializeMock).toHaveBeenCalledTimes(1);
  });

  it('resolves loggerId from logger.nativeHandle.id', () => {
    const initializeMock = jest.fn().mockResolvedValue(MOCK_CLIENT_ID);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });
    const logger = makeLogger();

    createPushClient({ logger });

    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ loggerId: 'logger-1' }),
    );
  });

  it('resolves storageId from storage.id', () => {
    const initializeMock = jest.fn().mockResolvedValue(MOCK_CLIENT_ID);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    createPushClient({ storage: { id: 'store-42' } as never });

    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ storageId: 'store-42' }),
    );
  });

  it('calls initialize() even without a logger', () => {
    const initializeMock = jest.fn().mockResolvedValue(MOCK_CLIENT_ID);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: initializeMock,
    });

    createPushClient();

    expect(initializeMock).toHaveBeenCalledTimes(1);
  });

  it('logs createClient success when logger is provided', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
    });
    const logger = makeLogger();

    await createPushClient({ logger });

    expect(logger.info).toHaveBeenCalledWith('Push createClient success');
  });
});

// ---------------------------------------------------------------------------
// PushClient — addCredentialFromUri
// ---------------------------------------------------------------------------

describe('PushClient.addCredentialFromUri', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native addCredentialFromUri with clientId and uri, returns credential', async () => {
    const nativeFn = jest.fn().mockResolvedValue(mockCredential);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      addCredentialFromUri: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.addCredentialFromUri('pushauth://enroll');

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID, 'pushauth://enroll');
    expect(result).toEqual(mockCredential);
  });

  it('propagates native rejection', async () => {
    const error = new Error('native error');
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      addCredentialFromUri: jest.fn().mockRejectedValue(error),
    });

    const client = await createPushClient();
    await expect(
      client.addCredentialFromUri('pushauth://enroll'),
    ).rejects.toThrow('native error');
  });

  it('logs success', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      addCredentialFromUri: jest.fn().mockResolvedValue(mockCredential),
    });
    const logger = makeLogger();
    const client = await createPushClient({ logger });

    await client.addCredentialFromUri('pushauth://enroll');

    expect(logger.debug).toHaveBeenCalledWith(
      'Push addCredentialFromUri requested',
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Push addCredentialFromUri success',
    );
  });

  it('logs failure and rethrows', async () => {
    const error = new Error('fail');
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      addCredentialFromUri: jest.fn().mockRejectedValue(error),
    });
    const logger = makeLogger();
    const client = await createPushClient({ logger });

    await expect(
      client.addCredentialFromUri('pushauth://enroll'),
    ).rejects.toThrow('fail');
    expect(logger.error).toHaveBeenCalledWith(
      'Push addCredentialFromUri failed',
    );
  });
});

// ---------------------------------------------------------------------------
// PushClient — saveCredential
// ---------------------------------------------------------------------------

describe('PushClient.saveCredential', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native saveCredential with clientId and credential, returns saved credential', async () => {
    const nativeFn = jest.fn().mockResolvedValue(mockCredential);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      saveCredential: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.saveCredential(mockCredential);

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID, mockCredential);
    expect(result).toEqual(mockCredential);
  });

  it('propagates native rejection', async () => {
    const error = new Error('save failed');
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      saveCredential: jest.fn().mockRejectedValue(error),
    });

    const client = await createPushClient();
    await expect(client.saveCredential(mockCredential)).rejects.toThrow(
      'save failed',
    );
  });

  it('logs success and failure correctly', async () => {
    const logger = makeLogger();
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      saveCredential: jest.fn().mockResolvedValue(mockCredential),
    });
    const client = await createPushClient({ logger });

    await client.saveCredential(mockCredential);

    expect(logger.debug).toHaveBeenCalledWith('Push saveCredential requested');
    expect(logger.info).toHaveBeenCalledWith('Push saveCredential success');
  });
});

// ---------------------------------------------------------------------------
// PushClient — getCredentials
// ---------------------------------------------------------------------------

describe('PushClient.getCredentials', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native getCredentials with clientId and returns unwrapped list', async () => {
    const nativeFn = jest
      .fn()
      .mockResolvedValue({ credentials: [mockCredential] });
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getCredentials: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.getCredentials();

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID);
    expect(result).toEqual([mockCredential]);
  });

  it('returns empty array when native returns empty credentials', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getCredentials: jest.fn().mockResolvedValue({ credentials: [] }),
    });

    const client = await createPushClient();
    const result = await client.getCredentials();

    expect(result).toEqual([]);
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getCredentials: jest.fn().mockRejectedValue(new Error('not init')),
    });

    const client = await createPushClient();
    await expect(client.getCredentials()).rejects.toThrow('not init');
  });
});

// ---------------------------------------------------------------------------
// PushClient — getCredential
// ---------------------------------------------------------------------------

describe('PushClient.getCredential', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native getCredential with clientId and credentialId, unwraps result', async () => {
    const nativeFn = jest
      .fn()
      .mockResolvedValue({ credential: mockCredential });
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getCredential: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.getCredential('cred-1');

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID, 'cred-1');
    expect(result).toEqual(mockCredential);
  });

  it('returns null when credential not found', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getCredential: jest.fn().mockResolvedValue({ credential: null }),
    });

    const client = await createPushClient();
    const result = await client.getCredential('missing');

    expect(result).toBeNull();
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getCredential: jest.fn().mockRejectedValue(new Error('cred error')),
    });

    const client = await createPushClient();
    await expect(client.getCredential('cred-1')).rejects.toThrow('cred error');
  });
});

// ---------------------------------------------------------------------------
// PushClient — deleteCredential
// ---------------------------------------------------------------------------

describe('PushClient.deleteCredential', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native deleteCredential with clientId and credentialId, returns boolean', async () => {
    const nativeFn = jest.fn().mockResolvedValue(true);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      deleteCredential: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.deleteCredential('cred-1');

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID, 'cred-1');
    expect(result).toBe(true);
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      deleteCredential: jest
        .fn()
        .mockRejectedValue(new Error('storage failure')),
    });

    const client = await createPushClient();
    await expect(client.deleteCredential('cred-1')).rejects.toThrow(
      'storage failure',
    );
  });
});

// ---------------------------------------------------------------------------
// PushClient — setDeviceToken
// ---------------------------------------------------------------------------

describe('PushClient.setDeviceToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native setDeviceToken with clientId, token, and null when credentialId omitted', async () => {
    const nativeFn = jest.fn().mockResolvedValue(true);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      setDeviceToken: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.setDeviceToken('fcm-token-123');

    expect(nativeFn).toHaveBeenCalledWith(
      MOCK_CLIENT_ID,
      'fcm-token-123',
      null,
    );
    expect(result).toBe(true);
  });

  it('calls native setDeviceToken with clientId, token, and credentialId when provided', async () => {
    const nativeFn = jest.fn().mockResolvedValue(true);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      setDeviceToken: nativeFn,
    });

    const client = await createPushClient();
    await client.setDeviceToken('fcm-token-123', 'cred-1');

    expect(nativeFn).toHaveBeenCalledWith(
      MOCK_CLIENT_ID,
      'fcm-token-123',
      'cred-1',
    );
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      setDeviceToken: jest.fn().mockRejectedValue(new Error('token error')),
    });

    const client = await createPushClient();
    await expect(client.setDeviceToken('token')).rejects.toThrow('token error');
  });
});

// ---------------------------------------------------------------------------
// PushClient — getDeviceToken
// ---------------------------------------------------------------------------

describe('PushClient.getDeviceToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native getDeviceToken with clientId and unwraps token', async () => {
    const nativeFn = jest.fn().mockResolvedValue({ token: 'my-token' });
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getDeviceToken: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.getDeviceToken();

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID);
    expect(result).toBe('my-token');
  });

  it('returns null when no token is registered', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getDeviceToken: jest.fn().mockResolvedValue({ token: null }),
    });

    const client = await createPushClient();
    const result = await client.getDeviceToken();

    expect(result).toBeNull();
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getDeviceToken: jest.fn().mockRejectedValue(new Error('token error')),
    });

    const client = await createPushClient();
    await expect(client.getDeviceToken()).rejects.toThrow('token error');
  });
});

// ---------------------------------------------------------------------------
// PushClient — processNotification
// ---------------------------------------------------------------------------

describe('PushClient.processNotification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native processNotification with clientId and messageData, unwraps notification', async () => {
    const messageData = { key: 'value' };
    const nativeFn = jest
      .fn()
      .mockResolvedValue({ notification: mockNotification });
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      processNotification: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.processNotification(messageData);

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID, messageData);
    expect(result).toEqual(mockNotification);
  });

  it('returns null for unsupported payloads', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      processNotification: jest.fn().mockResolvedValue({ notification: null }),
    });

    const client = await createPushClient();
    const result = await client.processNotification({});

    expect(result).toBeNull();
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      processNotification: jest
        .fn()
        .mockRejectedValue(new Error('parse error')),
    });

    const client = await createPushClient();
    await expect(client.processNotification({})).rejects.toThrow('parse error');
  });
});

// ---------------------------------------------------------------------------
// PushClient — processNotificationFromMessage
// ---------------------------------------------------------------------------

describe('PushClient.processNotificationFromMessage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native processNotificationFromMessage with clientId and message, unwraps notification', async () => {
    const nativeFn = jest
      .fn()
      .mockResolvedValue({ notification: mockNotification });
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      processNotificationFromMessage: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.processNotificationFromMessage('raw-message');

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID, 'raw-message');
    expect(result).toEqual(mockNotification);
  });

  it('returns null for unsupported message', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      processNotificationFromMessage: jest
        .fn()
        .mockResolvedValue({ notification: null }),
    });

    const client = await createPushClient();
    const result = await client.processNotificationFromMessage('unknown');

    expect(result).toBeNull();
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      processNotificationFromMessage: jest
        .fn()
        .mockRejectedValue(new Error('parse error')),
    });

    const client = await createPushClient();
    await expect(client.processNotificationFromMessage('bad')).rejects.toThrow(
      'parse error',
    );
  });
});

// ---------------------------------------------------------------------------
// PushClient — approveNotification
// ---------------------------------------------------------------------------

describe('PushClient.approveNotification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native approveNotification with clientId and notificationId, returns boolean', async () => {
    const nativeFn = jest.fn().mockResolvedValue(true);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      approveNotification: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.approveNotification('notif-1');

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID, 'notif-1');
    expect(result).toBe(true);
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      approveNotification: jest
        .fn()
        .mockRejectedValue(new Error('approve error')),
    });

    const client = await createPushClient();
    await expect(client.approveNotification('notif-1')).rejects.toThrow(
      'approve error',
    );
  });
});

// ---------------------------------------------------------------------------
// PushClient — approveChallengeNotification
// ---------------------------------------------------------------------------

describe('PushClient.approveChallengeNotification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native approveChallengeNotification with correct args and returns boolean', async () => {
    const nativeFn = jest.fn().mockResolvedValue(true);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      approveChallengeNotification: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.approveChallengeNotification(
      'notif-1',
      'response-42',
    );

    expect(nativeFn).toHaveBeenCalledWith(
      MOCK_CLIENT_ID,
      'notif-1',
      'response-42',
    );
    expect(result).toBe(true);
  });

  it('throws argument_error for empty challengeResponse WITHOUT calling native', async () => {
    const nativeFn = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      approveChallengeNotification: nativeFn,
    });

    const client = await createPushClient();
    await expect(
      client.approveChallengeNotification('notif-1', ''),
    ).rejects.toMatchObject({
      type: 'argument_error',
      code: 'invalid_parameter_value',
      message: 'challengeResponse must not be empty',
    });
    expect(nativeFn).not.toHaveBeenCalled();
  });

  it('throws argument_error for blank challengeResponse (spaces only) WITHOUT calling native', async () => {
    const nativeFn = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      approveChallengeNotification: nativeFn,
    });

    const client = await createPushClient();
    await expect(
      client.approveChallengeNotification('notif-1', '   '),
    ).rejects.toMatchObject({
      type: 'argument_error',
      code: 'invalid_parameter_value',
      message: 'challengeResponse must not be empty',
    });
    expect(nativeFn).not.toHaveBeenCalled();
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      approveChallengeNotification: jest
        .fn()
        .mockRejectedValue(new Error('challenge error')),
    });

    const client = await createPushClient();
    await expect(
      client.approveChallengeNotification('notif-1', 'valid-response'),
    ).rejects.toThrow('challenge error');
  });
});

// ---------------------------------------------------------------------------
// PushClient — approveBiometricNotification
// ---------------------------------------------------------------------------

describe('PushClient.approveBiometricNotification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native approveBiometricNotification with correct args and returns boolean', async () => {
    const nativeFn = jest.fn().mockResolvedValue(true);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      approveBiometricNotification: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.approveBiometricNotification(
      'notif-1',
      'biometric',
    );

    expect(nativeFn).toHaveBeenCalledWith(
      MOCK_CLIENT_ID,
      'notif-1',
      'biometric',
    );
    expect(result).toBe(true);
  });

  it('throws argument_error for empty authenticationMethod WITHOUT calling native', async () => {
    const nativeFn = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      approveBiometricNotification: nativeFn,
    });

    const client = await createPushClient();
    await expect(
      client.approveBiometricNotification('notif-1', ''),
    ).rejects.toMatchObject({
      type: 'argument_error',
      code: 'invalid_parameter_value',
      message: 'authenticationMethod must not be empty',
    });
    expect(nativeFn).not.toHaveBeenCalled();
  });

  it('throws argument_error for blank authenticationMethod (spaces only) WITHOUT calling native', async () => {
    const nativeFn = jest.fn();
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      approveBiometricNotification: nativeFn,
    });

    const client = await createPushClient();
    await expect(
      client.approveBiometricNotification('notif-1', '   '),
    ).rejects.toMatchObject({
      type: 'argument_error',
      code: 'invalid_parameter_value',
      message: 'authenticationMethod must not be empty',
    });
    expect(nativeFn).not.toHaveBeenCalled();
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      approveBiometricNotification: jest
        .fn()
        .mockRejectedValue(new Error('bio error')),
    });

    const client = await createPushClient();
    await expect(
      client.approveBiometricNotification('notif-1', 'biometric'),
    ).rejects.toThrow('bio error');
  });
});

// ---------------------------------------------------------------------------
// PushClient — denyNotification
// ---------------------------------------------------------------------------

describe('PushClient.denyNotification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native denyNotification with clientId and notificationId, returns boolean', async () => {
    const nativeFn = jest.fn().mockResolvedValue(true);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      denyNotification: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.denyNotification('notif-1');

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID, 'notif-1');
    expect(result).toBe(true);
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      denyNotification: jest.fn().mockRejectedValue(new Error('deny error')),
    });

    const client = await createPushClient();
    await expect(client.denyNotification('notif-1')).rejects.toThrow(
      'deny error',
    );
  });
});

// ---------------------------------------------------------------------------
// PushClient — getPendingNotifications
// ---------------------------------------------------------------------------

describe('PushClient.getPendingNotifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native getPendingNotifications with clientId and returns unwrapped list', async () => {
    const nativeFn = jest
      .fn()
      .mockResolvedValue({ notifications: [mockNotification] });
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getPendingNotifications: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.getPendingNotifications();

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID);
    expect(result).toEqual([mockNotification]);
  });

  it('returns empty array when no pending notifications', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getPendingNotifications: jest
        .fn()
        .mockResolvedValue({ notifications: [] }),
    });

    const client = await createPushClient();
    const result = await client.getPendingNotifications();

    expect(result).toEqual([]);
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getPendingNotifications: jest
        .fn()
        .mockRejectedValue(new Error('not init')),
    });

    const client = await createPushClient();
    await expect(client.getPendingNotifications()).rejects.toThrow('not init');
  });
});

// ---------------------------------------------------------------------------
// PushClient — getAllNotifications
// ---------------------------------------------------------------------------

describe('PushClient.getAllNotifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native getAllNotifications with clientId and returns unwrapped list', async () => {
    const nativeFn = jest
      .fn()
      .mockResolvedValue({ notifications: [mockNotification] });
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getAllNotifications: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.getAllNotifications();

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID);
    expect(result).toEqual([mockNotification]);
  });

  it('returns empty array when no notifications stored', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getAllNotifications: jest.fn().mockResolvedValue({ notifications: [] }),
    });

    const client = await createPushClient();
    const result = await client.getAllNotifications();

    expect(result).toEqual([]);
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getAllNotifications: jest.fn().mockRejectedValue(new Error('not init')),
    });

    const client = await createPushClient();
    await expect(client.getAllNotifications()).rejects.toThrow('not init');
  });
});

// ---------------------------------------------------------------------------
// PushClient — getNotification
// ---------------------------------------------------------------------------

describe('PushClient.getNotification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native getNotification with clientId and notificationId, unwraps notification', async () => {
    const nativeFn = jest
      .fn()
      .mockResolvedValue({ notification: mockNotification });
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getNotification: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.getNotification('notif-1');

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID, 'notif-1');
    expect(result).toEqual(mockNotification);
  });

  it('returns null when notification not found', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getNotification: jest.fn().mockResolvedValue({ notification: null }),
    });

    const client = await createPushClient();
    const result = await client.getNotification('missing');

    expect(result).toBeNull();
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getNotification: jest.fn().mockRejectedValue(new Error('notif error')),
    });

    const client = await createPushClient();
    await expect(client.getNotification('notif-1')).rejects.toThrow(
      'notif error',
    );
  });
});

// ---------------------------------------------------------------------------
// PushClient — cleanupNotifications
// ---------------------------------------------------------------------------

describe('PushClient.cleanupNotifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native cleanupNotifications with clientId and null when credentialId omitted, returns count', async () => {
    const nativeFn = jest.fn().mockResolvedValue(5);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      cleanupNotifications: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.cleanupNotifications();

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID, null);
    expect(result).toBe(5);
  });

  it('calls native cleanupNotifications with clientId and credentialId when provided', async () => {
    const nativeFn = jest.fn().mockResolvedValue(3);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      cleanupNotifications: nativeFn,
    });

    const client = await createPushClient();
    const result = await client.cleanupNotifications('cred-1');

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID, 'cred-1');
    expect(result).toBe(3);
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      cleanupNotifications: jest
        .fn()
        .mockRejectedValue(new Error('cleanup error')),
    });

    const client = await createPushClient();
    await expect(client.cleanupNotifications()).rejects.toThrow(
      'cleanup error',
    );
  });
});

// ---------------------------------------------------------------------------
// PushClient — close
// ---------------------------------------------------------------------------

describe('PushClient.close', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls native close with clientId and resolves void', async () => {
    const nativeFn = jest.fn().mockResolvedValue(undefined);
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      close: nativeFn,
    });

    const client = await createPushClient();
    await client.close();

    expect(nativeFn).toHaveBeenCalledWith(MOCK_CLIENT_ID);
  });

  it('propagates native rejection', async () => {
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      close: jest.fn().mockRejectedValue(new Error('close error')),
    });

    const client = await createPushClient();
    await expect(client.close()).rejects.toThrow('close error');
  });

  it('logs success and failure correctly', async () => {
    const logger = makeLogger();
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      close: jest.fn().mockResolvedValue(undefined),
    });
    const client = await createPushClient({ logger });

    await client.close();

    expect(logger.debug).toHaveBeenCalledWith('Push close requested');
    expect(logger.info).toHaveBeenCalledWith('Push close success');
  });

  it('logs error on failure and rethrows', async () => {
    const logger = makeLogger();
    const error = new Error('close fail');
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      close: jest.fn().mockRejectedValue(error),
    });
    const client = await createPushClient({ logger });

    await expect(client.close()).rejects.toThrow('close fail');
    expect(logger.error).toHaveBeenCalledWith('Push close failed');
  });
});

// ---------------------------------------------------------------------------
// getNumbersChallenge
// ---------------------------------------------------------------------------

describe('getNumbersChallenge', () => {
  it('parses a CSV string into an array of numbers', () => {
    const result = getNumbersChallenge({
      ...mockNotification,
      numbersChallenge: '12,34,56',
    });
    expect(result).toEqual([12, 34, 56]);
  });

  it('returns empty array when numbersChallenge is null', () => {
    const result = getNumbersChallenge({
      ...mockNotification,
      numbersChallenge: null,
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when numbersChallenge is empty string', () => {
    const result = getNumbersChallenge({
      ...mockNotification,
      numbersChallenge: '',
    });
    expect(result).toEqual([]);
  });

  it('returns single-element array for single number', () => {
    const result = getNumbersChallenge({
      ...mockNotification,
      numbersChallenge: '42',
    });
    expect(result).toEqual([42]);
  });

  it('returns empty array when numbersChallenge is undefined', () => {
    const result = getNumbersChallenge({
      ...mockNotification,
      numbersChallenge: undefined as unknown as null,
    });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PushClient — error logging coverage
// ---------------------------------------------------------------------------

describe('PushClient — error logging', () => {
  beforeEach(() => jest.clearAllMocks());

  const errorLoggingCases: Array<{
    method: string;
    setup: (nativeMock: Record<string, jest.Mock>) => void;
    call: (
      client: Awaited<ReturnType<typeof createPushClient>>,
    ) => Promise<unknown>;
  }> = [
    {
      method: 'deleteCredential',
      setup: (m) => {
        m.deleteCredential = jest.fn().mockRejectedValue(new Error('fail'));
      },
      call: (c) => c.deleteCredential('cred-1'),
    },
    {
      method: 'setDeviceToken',
      setup: (m) => {
        m.setDeviceToken = jest.fn().mockRejectedValue(new Error('fail'));
      },
      call: (c) => c.setDeviceToken('token'),
    },
    {
      method: 'getDeviceToken',
      setup: (m) => {
        m.getDeviceToken = jest.fn().mockRejectedValue(new Error('fail'));
      },
      call: (c) => c.getDeviceToken(),
    },
    {
      method: 'processNotification',
      setup: (m) => {
        m.processNotification = jest.fn().mockRejectedValue(new Error('fail'));
      },
      call: (c) => c.processNotification({}),
    },
    {
      method: 'processNotificationFromMessage',
      setup: (m) => {
        m.processNotificationFromMessage = jest
          .fn()
          .mockRejectedValue(new Error('fail'));
      },
      call: (c) => c.processNotificationFromMessage('raw'),
    },
    {
      method: 'approveNotification',
      setup: (m) => {
        m.approveNotification = jest.fn().mockRejectedValue(new Error('fail'));
      },
      call: (c) => c.approveNotification('notif-1'),
    },
    {
      method: 'denyNotification',
      setup: (m) => {
        m.denyNotification = jest.fn().mockRejectedValue(new Error('fail'));
      },
      call: (c) => c.denyNotification('notif-1'),
    },
    {
      method: 'getPendingNotifications',
      setup: (m) => {
        m.getPendingNotifications = jest
          .fn()
          .mockRejectedValue(new Error('fail'));
      },
      call: (c) => c.getPendingNotifications(),
    },
    {
      method: 'getAllNotifications',
      setup: (m) => {
        m.getAllNotifications = jest.fn().mockRejectedValue(new Error('fail'));
      },
      call: (c) => c.getAllNotifications(),
    },
    {
      method: 'getNotification',
      setup: (m) => {
        m.getNotification = jest.fn().mockRejectedValue(new Error('fail'));
      },
      call: (c) => c.getNotification('notif-1'),
    },
    {
      method: 'cleanupNotifications',
      setup: (m) => {
        m.cleanupNotifications = jest.fn().mockRejectedValue(new Error('fail'));
      },
      call: (c) => c.cleanupNotifications(),
    },
  ];

  it.each(errorLoggingCases)(
    'logs error on $method failure and rethrows',
    async ({ setup, call }) => {
      const nativeMethods: Record<string, jest.Mock> = {
        initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      };
      setup(nativeMethods);
      (getNativeModule as jest.Mock).mockReturnValue(nativeMethods);
      const logger = makeLogger();
      const client = await createPushClient({ logger });
      await expect(call(client)).rejects.toThrow('fail');
      expect(logger.error).toHaveBeenCalled();
    },
  );
});

// ---------------------------------------------------------------------------
// PushError shape preservation
// ---------------------------------------------------------------------------

describe('PushError shape preservation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('wraps native rejection in PushError for addCredentialFromUri', async () => {
    const nativePushError = {
      type: 'push_error',
      error: 'not_initialized',
      message: 'PushClient is not initialized',
    };
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      addCredentialFromUri: jest.fn().mockRejectedValue(nativePushError),
    });

    const client = await createPushClient();

    expect.assertions(4);
    try {
      await client.addCredentialFromUri('pushauth://test');
    } catch (err) {
      expect(err).toBeInstanceOf(PushError);
      expect((err as PushError).code).toBe('not_initialized');
      expect((err as PushError).type).toBe('push_error');
      expect((err as PushError).message).toBe('PushClient is not initialized');
    }
  });

  it('wraps native rejection in PushError for getCredentials', async () => {
    const nativePushError = {
      type: 'push_error',
      error: 'storage_error',
      message: 'Failed to read credentials',
    };
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      getCredentials: jest.fn().mockRejectedValue(nativePushError),
    });

    const client = await createPushClient();

    expect.assertions(4);
    try {
      await client.getCredentials();
    } catch (err) {
      expect(err).toBeInstanceOf(PushError);
      expect((err as PushError).code).toBe('storage_error');
      expect((err as PushError).type).toBe('push_error');
      expect((err as PushError).message).toBe('Failed to read credentials');
    }
  });

  it('wraps native rejection in PushError for approveNotification', async () => {
    const nativePushError = {
      type: 'push_error',
      error: 'network_error',
      message: 'Network request failed',
    };
    (getNativeModule as jest.Mock).mockReturnValue({
      initialize: jest.fn().mockResolvedValue(MOCK_CLIENT_ID),
      approveNotification: jest.fn().mockRejectedValue(nativePushError),
    });

    const client = await createPushClient();

    expect.assertions(4);
    try {
      await client.approveNotification('notif-1');
    } catch (err) {
      expect(err).toBeInstanceOf(PushError);
      expect((err as PushError).code).toBe('network_error');
      expect((err as PushError).type).toBe('push_error');
      expect((err as PushError).message).toBe('Network request failed');
    }
  });
});
