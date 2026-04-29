/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { LoggerInstance } from '@ping-identity/rn-types';
import type {
  OathDevice,
  PushDevice,
  BoundDevice,
  ProfileDevice,
  WebAuthnDevice,
} from './device.types';

/**
 * Runtime configuration for a Device Client instance.
 *
 * @remarks
 * Passed to {@link createDeviceClient} to create a native-backed client.
 * All fields are required — there are no defaults.
 *
 * @example
 * ```ts
 * const config: DeviceClientConfig = {
 *   serverUrl: 'https://openam.example.com/am',
 *   ssoToken: session.value,
 *   realm: 'alpha',
 *   cookieName: '5421aeddf91aa20',
 * };
 * ```
 */
export interface DeviceClientConfig {
  /**
   * Base URL of the Ping AIC / ForgeRock server.
   *
   * @example `'https://openam.example.com/am'`
   */
  serverUrl: string;
  /**
   * SSO / session token obtained from Journey (`session.value`).
   *
   * @remarks
   * The token must be valid for the duration of the client's lifetime.
   * If the token expires, operations will reject with
   * `DEVICE_CLIENT_INVALID_TOKEN`.
   *
   * The native SDK uses this token as a session cookie against the
   * `/sessions` endpoint. OIDC access tokens are not supported.
   */
  ssoToken: string;
  /**
   * Authentication realm (e.g. `'alpha'`, `'root'`).
   */
  realm: string;
  /**
   * Session cookie header name sent with native HTTP requests
   * (e.g. `'iPlanetDirectoryPro'` or a custom cookie name).
   */
  cookieName: string;
  /**
   * Optional JavaScript logger instance created by `@ping-identity/rn-logger`.
   *
   * @remarks
   * Used for JS-side diagnostics only; native logger forwarding is currently
   * Android-only. Must be created via the `logger(...)` factory from
   * `@ping-identity/rn-logger`.
   */
  logger?: LoggerInstance;
}

/**
 * Repository operations for a single device kind.
 *
 * @remarks
 * Mirrors the native `DeviceRepository<T>` protocol (iOS) / interface (Android).
 * Each {@link DeviceClient} property (`oath`, `push`, `bound`, `profile`, `webAuthn`)
 * exposes a `DeviceRepository` instance parameterised with the appropriate device type.
 *
 * @typeParam T - The concrete device type for this repository
 *   (e.g. {@link OathDevice}, {@link BoundDevice}).
 *
 * @example
 * ```ts
 * const repo: DeviceRepository<OathDevice> = client.oath;
 * const devices = await repo.get();
 * ```
 */
export interface DeviceRepository<T> {
  /**
   * Fetches all devices of this kind for the active user.
   *
   * @returns A promise resolving to an array of devices. Returns an empty
   *   array when the user has no devices of this kind.
   * @throws {@link DeviceClientError} on connectivity failures or expired tokens.
   */
  get(): Promise<T[]>;
  /**
   * Updates a device on the server.
   *
   * @remarks
   * Currently only the `deviceName` property is writable.
   *
   * @param device - The device with the updated field(s).
   * @returns A promise resolving to the server's acknowledged copy of the device.
   * @throws {@link DeviceClientError} on not-found or validation errors.
   */
  update(device: T): Promise<T>;
  /**
   * Deletes a device from the server.
   *
   * @param device - The device to delete. The `id` field is used for lookup.
   * @returns A promise resolving to the deleted device.
   * @throws {@link DeviceClientError} when the device does not exist.
   */
  delete(device: T): Promise<T>;
}

/**
 * Reusable client for device management operations.
 *
 * @remarks
 * Created via {@link createDeviceClient}. Each client is bound to a single
 * SSO session (token) and maintains a native handle on both iOS and Android.
 *
 * The client follows a **handle-based lifecycle**: calling {@link dispose}
 * releases native resources and invalidates the client.
 *
 * @example
 * ```ts
 * const client = createDeviceClient({ ... });
 * try {
 *   const oathDevices = await client.oath.get();
 * } finally {
 *   await client.dispose();
 * }
 * ```
 */
export interface DeviceClient {
  /** Repository for OATH (TOTP / HOTP) authenticator devices. */
  oath: DeviceRepository<OathDevice>;
  /** Repository for push notification devices. */
  push: DeviceRepository<PushDevice>;
  /** Repository for cryptographically bound devices. */
  bound: DeviceRepository<BoundDevice>;
  /** Repository for device profile records (non-MFA). */
  profile: DeviceRepository<ProfileDevice>;
  /** Repository for FIDO2 / WebAuthn credentials. */
  webAuthn: DeviceRepository<WebAuthnDevice>;
  /**
   * Releases native resources associated with this client.
   *
   * @remarks
   * Safe to call multiple times. After `dispose()`, any further operations
   * on this client's repositories will reject.
   */
  dispose(): Promise<void>;
}
