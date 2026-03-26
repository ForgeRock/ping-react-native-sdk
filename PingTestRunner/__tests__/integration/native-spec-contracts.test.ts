/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Compile-time contract tests for native module mock method names.
 *
 * These tests produce NO runtime assertions. Their purpose is to ensure that
 * the method names used in jest.setup.js and individual test mocks remain in
 * sync with the actual native TurboModule Spec interfaces.
 *
 * HOW IT WORKS
 * Each `Pick<Spec, 'methodName'>` below is a TypeScript indexed access on the
 * Spec interface. If a method is renamed or removed in the Spec, TypeScript
 * will error here — catching mock drift before any test even runs.
 *
 * MAINTENANCE
 * When you add a new method to a native Spec, add it to the corresponding
 * Pick<> below and to the mock in jest.setup.js.
 */

import type { Spec as BrowserSpec } from '../../../packages/browser/src/NativeRNPingBrowser';
import type { Spec as DeviceIdSpec } from '../../../packages/device-id/src/NativeRNPingDeviceId';
import type { Spec as DeviceProfileSpec } from '../../../packages/device-profile/src/NativeRNPingDeviceProfile';
import type { Spec as JourneySpec } from '../../../packages/journey/src/NativeRNPingJourney';
import type { Spec as LoggerSpec } from '../../../packages/logger/src/NativeRNPingLogger';
import type { Spec as OidcSpec } from '../../../packages/oidc/src/NativeRNPingOidc';
import type { Spec as StorageSpec } from '../../../packages/storage/src/NativeRNPingStorage';

// ─── rn-browser ─────────────────────────────────────────────────────────────
// jest.setup.js mocks: configure, reset, open
type _BrowserMockedMethods = Pick<BrowserSpec,
  | 'configure'
  | 'reset'
  | 'open'
>;

// ─── rn-device-id ───────────────────────────────────────────────────────────
// jest.setup.js mocks: getDefaultDeviceId
type _DeviceIdMockedMethods = Pick<DeviceIdSpec,
  | 'getDefaultDeviceId'
>;

// ─── rn-device-profile ──────────────────────────────────────────────────────
// jest.setup.js mocks: collectDeviceProfile, collectDeviceProfileForJourney
type _DeviceProfileMockedMethods = Pick<DeviceProfileSpec,
  | 'collectDeviceProfile'
  | 'collectDeviceProfileForJourney'
>;

// ─── rn-journey ─────────────────────────────────────────────────────────────
// jest.setup.js mocks: configureJourney, start, next, resume, getSession,
//                      refresh, revoke, userinfo, ssoToken, logout, dispose
type _JourneyMockedMethods = Pick<JourneySpec,
  | 'configureJourney'
  | 'start'
  | 'next'
  | 'resume'
  | 'getSession'
  | 'refresh'
  | 'revoke'
  | 'userinfo'
  | 'ssoToken'
  | 'logout'
  | 'dispose'
>;

// ─── rn-logger ──────────────────────────────────────────────────────────────
// jest.setup.js mocks: registerLogger, syncLogger
type _LoggerMockedMethods = Pick<LoggerSpec,
  | 'registerLogger'
  | 'syncLogger'
>;

// ─── rn-oidc ────────────────────────────────────────────────────────────────
// jest.setup.js mocks: createClient, createWebClient, clientToken,
//                      clientRefresh, clientUserinfo, clientRevoke,
//                      clientEndSession, authorize, hasUser, token,
//                      refresh, userinfo, revoke, logout
type _OidcMockedMethods = Pick<OidcSpec,
  | 'createClient'
  | 'createWebClient'
  | 'clientToken'
  | 'clientRefresh'
  | 'clientUserinfo'
  | 'clientRevoke'
  | 'clientEndSession'
  | 'authorize'
  | 'hasUser'
  | 'token'
  | 'refresh'
  | 'userinfo'
  | 'revoke'
  | 'logout'
>;

// ─── rn-storage ─────────────────────────────────────────────────────────────
// jest.setup.js mocks: registerSessionStorage, configureSessionStorage,
//                      registerOidcStorage, configureOidcStorage
type _StorageMockedMethods = Pick<StorageSpec,
  | 'registerSessionStorage'
  | 'configureSessionStorage'
  | 'registerOidcStorage'
  | 'configureOidcStorage'
>;

// ─── runtime placeholder ────────────────────────────────────────────────────
// Jest requires at least one describe/it block to treat this as a test suite.
// The real value is the compile-time checks above — if this file compiles,
// all mocked method names are valid.

describe('native TurboModule Spec contracts', () => {
  it('all mocked method names exist in their respective Spec interfaces (compile-time check)', () => {
    // No runtime assertion needed: compilation of this file IS the test.
    expect(true).toBe(true);
  });
});
