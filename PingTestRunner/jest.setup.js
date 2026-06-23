/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Global Jest setup for PingTestRunner integration tests.
 *
 * Native TurboModules are unavailable in the Node test environment, so every
 * package's NativeModule is mocked at the module level here.  Individual test
 * files can override specific methods via jest.doMock / jest.resetModules.
 */

// React Native requires __DEV__ to be defined as a global.
global.__DEV__ = false;

// Provide a minimal react-native mock for the Node test environment.
// Platform.OS and TurboModuleRegistry are not available outside a real RN runtime;
// native modules are mocked individually below so TurboModuleRegistry need not resolve anything.
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (spec) => spec.ios ?? spec.default,
  },
  NativeModules: {},
  TurboModuleRegistry: {
    get: jest.fn(() => null),
    getEnforcing: jest.fn(() => null),
  },
}));

// ---------- rn-binding ----------
jest.mock('../packages/binding/src/NativeRNPingBinding', () => ({
  __esModule: true,
  getNativeModule: jest.fn(() => ({
    bindForJourney: jest.fn(async () => ({ type: 'success' })),
    signForJourney: jest.fn(async () => ({ type: 'success' })),
    resolvePin: jest.fn(),
    cancelPin: jest.fn(),
    selectUserKey: jest.fn(),
    cancelUserKey: jest.fn(),
    getAllKeys: jest.fn(async () => []),
    deleteKey: jest.fn(async () => null),
    deleteAllKeys: jest.fn(async () => null),
  })),
  toNativeBindOptions: jest.fn((options) => options),
  toNativeSignOptions: jest.fn((options) => options),
  toNativeConfigOptions: jest.fn((config) => config),
  fromNativeJourneyResult: jest.fn((result) => result),
  fromNativeUserKeys: jest.fn((result) => result),
}));

// ---------- rn-device-client ----------
jest.mock('../packages/device-client/src/NativeRNPingDeviceClient', () => ({
  __esModule: true,
  getNativeModule: jest.fn(() => ({
    create: jest.fn(async () => 'device-client-handle-mock'),
    get: jest.fn(async () => ({ result: [] })),
    update: jest.fn(async () => ({
      result: { id: 'mock', deviceName: 'Mock' },
    })),
    deleteDevice: jest.fn(async () => ({
      result: { id: 'mock', deviceName: 'Mock' },
    })),
    dispose: jest.fn(async () => undefined),
  })),
}));

// ---------- rn-browser ----------
jest.mock('../packages/browser/src/NativeRNPingBrowser', () => ({
  __esModule: true,
  getNativeModule: jest.fn(() => ({
    configure: jest.fn(),
    reset: jest.fn(),
    open: jest.fn(async () => ({
      type: 'success',
      url: 'com.example://callback',
    })),
  })),
}));

// ---------- rn-davinci ----------
jest.mock('../packages/davinci/src/NativeRNPingDavinci', () => ({
  __esModule: true,
  default: {
    configureDaVinci: jest.fn(async () => 'davinci-id-mock'),
    start: jest.fn(async () => ({ type: 'ContinueNode', collectors: [] })),
    next: jest.fn(async () => ({
      type: 'SuccessNode',
      session: { value: 'session-mock' },
    })),
    getSession: jest.fn(async () => ({ accessToken: 'mock-access-token' })),
    refresh: jest.fn(async () => ({ accessToken: 'mock-refreshed-token' })),
    revoke: jest.fn(async () => true),
    userinfo: jest.fn(async () => ({ sub: 'user-mock' })),
    logout: jest.fn(async () => undefined),
    dispose: jest.fn(async () => undefined),
  },
}));

// ---------- rn-device-id ----------
jest.mock('../packages/device-id/src/NativeRNPingDeviceId', () => ({
  __esModule: true,
  default: {
    getDefaultDeviceId: jest.fn(async () => 'mock-device-id-123'),
  },
  getNativeModule: jest.fn(() => ({
    getDefaultDeviceId: jest.fn(async () => 'mock-device-id-123'),
  })),
}));

// ---------- rn-device-profile ----------
jest.mock('../packages/device-profile/src/NativeRNPingDeviceProfile', () => ({
  __esModule: true,
  getNativeModule: jest.fn(() => ({
    collectDeviceProfile: jest.fn(async () => ({
      platform: 'android',
      version: '13',
    })),
    collectDeviceProfileForJourney: jest.fn(async () => ({
      nodeId: 'node-1',
      profile: {},
    })),
  })),
}));

// ---------- rn-fido ----------
jest.mock('../packages/fido/src/NativeRNPingFido', () => ({
  __esModule: true,
  getNativeModule: jest.fn(() => ({
    registerCredential: jest.fn(async () => ({
      credentialId: 'mock-credential-id',
    })),
    authenticateCredential: jest.fn(async () => ({
      signature: 'mock-signature',
    })),
  })),
  toNativeRegistrationOptions: jest.fn((options) => options),
  toNativeAuthenticationOptions: jest.fn((options) => options),
  fromNativeRegistrationResult: jest.fn((result) => result),
  fromNativeAuthenticationResult: jest.fn((result) => result),
}));

// ---------- rn-journey ----------
jest.mock('../packages/journey/src/NativeRNPingJourney', () => ({
  __esModule: true,
  default: {
    configureJourney: jest.fn(async () => 'journey-id-mock'),
    start: jest.fn(async () => ({
      id: 'n1',
      type: 'ContinueNode',
      callbacks: [],
    })),
    next: jest.fn(async () => ({ id: 'n2', type: 'SuccessNode' })),
    resume: jest.fn(async () => ({
      id: 'n3',
      type: 'ContinueNode',
      callbacks: [],
    })),
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
  },
}));

// ---------- rn-logger ----------
jest.mock('../packages/logger/src/NativeRNPingLogger', () => ({
  __esModule: true,
  default: {
    registerLogger: jest.fn(() => 'logger-id-mock'),
    syncLogger: jest.fn(),
  },
  getNativeModule: jest.fn(() => ({
    registerLogger: jest.fn(() => 'logger-id-mock'),
    syncLogger: jest.fn(),
  })),
}));

// ---------- rn-oidc ----------
jest.mock('../packages/oidc/src/NativeRNPingOidc', () => ({
  __esModule: true,
  getNativeModule: jest.fn(() => ({
    createClient: jest.fn(() => 'oidc-client-id-mock'),
    createWebClient: jest.fn(() => 'oidc-web-client-id-mock'),
    clientToken: jest.fn(async () => ({
      accessToken: 'mock-access-token',
      idToken: 'mock-id-token',
    })),
    clientRefresh: jest.fn(async () => ({
      accessToken: 'mock-refreshed-access-token',
      idToken: 'mock-refreshed-id-token',
    })),
    clientUserinfo: jest.fn(async () => ({
      sub: 'user-mock',
      email: 'user@example.com',
    })),
    clientRevoke: jest.fn(async () => undefined),
    clientEndSession: jest.fn(async () => undefined),
    authorize: jest.fn(async () => ({
      code: 'auth-code-mock',
      state: 'state-mock',
    })),
    hasUser: jest.fn(async () => true),
    token: jest.fn(async () => ({
      accessToken: 'mock-web-access-token',
      idToken: 'mock-web-id-token',
    })),
    refresh: jest.fn(async () => ({
      accessToken: 'mock-web-refreshed-token',
      idToken: 'mock-web-refreshed-id-token',
    })),
    userinfo: jest.fn(async () => ({ sub: 'web-user-mock' })),
    revoke: jest.fn(async () => undefined),
    logout: jest.fn(async () => undefined),
  })),
}));

// ---------- rn-external-idp ----------
jest.mock('../packages/external-idp/src/NativeRNPingExternalIdp', () => ({
  __esModule: true,
  getNativeModule: jest.fn(() => ({
    authorizeForJourney: jest.fn(async () => ({
      token: 'mock-token',
      additionalParameters: {},
    })),
    selectProviderForJourney: jest.fn(async () => undefined),
  })),
  toNativeAuthorizeOptions: jest.fn((options) => options),
  toNativeSelectOptions: jest.fn((options) => options),
  toNativeConfig: jest.fn((config) => config),
  fromNativeAuthorizeResult: jest.fn((result) => result),
}));

// ---------- rn-push ----------
jest.mock('../packages/push/src/NativeRNPingPush', () => ({
  __esModule: true,
  getNativeModule: jest.fn(() => ({
    initialize: jest.fn(async () => 'push-client-handle-mock'),
    addCredentialFromUri: jest.fn(async () => ({})),
    getCredential: jest.fn(async () => ({ credential: null })),
    getCredentials: jest.fn(async () => ({ credentials: [] })),
    saveCredential: jest.fn(async () => ({})),
    deleteCredential: jest.fn(async () => true),
    setDeviceToken: jest.fn(async () => true),
    getDeviceToken: jest.fn(async () => ({ token: null })),
    processNotification: jest.fn(async () => ({ notification: null })),
    processNotificationFromMessage: jest.fn(async () => ({
      notification: null,
    })),
    approveNotification: jest.fn(async () => true),
    approveChallengeNotification: jest.fn(async () => true),
    approveBiometricNotification: jest.fn(async () => true),
    denyNotification: jest.fn(async () => true),
    getPendingNotifications: jest.fn(async () => ({ notifications: [] })),
    getAllNotifications: jest.fn(async () => ({ notifications: [] })),
    getNotification: jest.fn(async () => ({ notification: null })),
    cleanupNotifications: jest.fn(async () => 0),
    close: jest.fn(async () => undefined),
    consumePendingMessages: jest.fn(async () => []),
    refreshToken: jest.fn(async () => ({ token: null })),
  })),
  toNativePushConfig: jest.fn((config) => config),
  fromNativeCredential: jest.fn((result) => result),
  fromNativeWrappedCredential: jest.fn((w) => w?.credential ?? null),
  fromNativeNotification: jest.fn((r) => r?.notification ?? null),
  fromNativeCredentialList: jest.fn((r) => r?.credentials ?? []),
  fromNativeNotificationList: jest.fn((r) => r?.notifications ?? []),
  fromNativeToken: jest.fn((w) => w?.token ?? null),
}));

// ---------- rn-storage ----------
jest.mock('../packages/storage/src/NativeRNPingStorage', () => ({
  __esModule: true,
  CacheStrategy: {
    CACHE: 'cache',
    NO_CACHE: 'no_cache',
    CACHE_ON_FAILURE: 'cache_on_failure',
  },
  getNativeModule: jest.fn(() => ({
    registerSessionStorage: jest.fn(() => 'session-storage-id-mock'),
    configureSessionStorage: jest.fn(() => ({
      android: { keyAlias: 'test-key', fileName: 'test-file' },
    })),
    registerOidcStorage: jest.fn(() => 'oidc-storage-id-mock'),
    configureOidcStorage: jest.fn(() => ({
      ios: { account: 'test-account' },
    })),
  })),
}));
