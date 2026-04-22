/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Supported device kinds exposed by the native Ping DeviceClient SDKs.
 *
 * @remarks
 * Order matches the native repository property order on both platforms.
 * Each kind maps 1:1 to a REST endpoint under `/json/realms/{realm}/users/{user}/devices/{kind}`.
 *
 * - `'oath'`     - OATH (TOTP / HOTP) authenticator app devices.
 * - `'push'`     - Push notification devices.
 * - `'bound'`    - Cryptographically bound devices used for device-binding MFA.
 * - `'profile'`  - Device profile records (non-MFA).
 * - `'webAuthn'` - FIDO2 / WebAuthn credentials.
 *
 * @example
 * ```ts
 * const kind: DeviceKind = 'oath';
 * const devices = await client[kind].get();
 * ```
 */
export type DeviceKind = 'oath' | 'push' | 'bound' | 'profile' | 'webAuthn';

/**
 * Common fields shared by every device kind.
 *
 * @remarks
 * Timestamps are normalized to **milliseconds since epoch** on both platforms
 * so consumers can pass them directly into `new Date(...)`.
 *
 * All MFA device types ({@link OathDevice}, {@link PushDevice},
 * {@link BoundDevice}, {@link WebAuthnDevice}) extend this base interface.
 * {@link ProfileDevice} does **not** extend `DeviceBase` because the profile
 * endpoint returns a different shape.
 *
 * Both platforms emit milliseconds in their JSON encoding.
 */
export interface DeviceBase {
  /** Server-assigned unique identifier for the device record. */
  id: string;
  /** User-visible display name of the device. This is the only writable field via update. */
  deviceName: string;
  /** Platform UUID of the physical device. */
  uuid: string;
  /** Timestamp (milliseconds since epoch) when the device was first registered. */
  createdDate: number;
  /** Timestamp (milliseconds since epoch) of the most recent authentication or access event. */
  lastAccessDate: number;
}

/**
 * OATH (TOTP / HOTP) authenticator app device.
 *
 * @remarks
 * Represents a time-based or counter-based one-time-password device registered
 * with the Ping Identity server. Inherits all common fields from {@link DeviceBase}.
 */
export type OathDevice = DeviceBase;

/**
 * Push notification device.
 *
 * @remarks
 * Represents a device registered for push-based MFA approval flows.
 * Inherits all common fields from {@link DeviceBase}.
 */
export type PushDevice = DeviceBase;

/**
 * Cryptographically bound device used for device-binding MFA.
 *
 * @remarks
 * Extends {@link DeviceBase} with an additional `deviceId` that identifies
 * the physical device assigned during the binding ceremony.
 */
export interface BoundDevice extends DeviceBase {
  /**
   * Physical device identifier assigned at binding time.
   *
   * @remarks
   * Distinct from {@link DeviceBase.id} (the server record id) and
   * {@link DeviceBase.uuid} (the platform UUID). This value is set by the
   * native SDK during the device-binding ceremony and cannot be changed.
   */
  deviceId: string;
}

/**
 * FIDO2 / WebAuthn credential.
 *
 * @remarks
 * Extends {@link DeviceBase} with a `credentialId` that uniquely identifies the
 * WebAuthn credential on the relying party.
 */
export interface WebAuthnDevice extends DeviceBase {
  /**
   * Base64url-encoded credential identifier returned by the authenticator
   * during the WebAuthn registration ceremony.
   */
  credentialId: string;
}

/**
 * Optional physical location captured alongside a profile device.
 *
 * @remarks
 * Coordinates use the WGS 84 datum (standard GPS). The server stores these
 * as part of the device profile metadata.
 */
export interface DeviceLocation {
  /** Latitude in decimal degrees (WGS 84). */
  latitude: number;
  /** Longitude in decimal degrees (WGS 84). */
  longitude: number;
}

/**
 * Device profile record (non-MFA).
 *
 * @remarks
 * Unlike MFA device types, profile devices do **not** extend {@link DeviceBase}.
 * The server returns a different shape for `/devices/profile` that includes
 * free-form metadata and an optional location.
 */
export interface ProfileDevice {
  /** Server-assigned unique identifier for the profile record. */
  id: string;
  /**
   * User-visible name of the device.
   *
   * @remarks
   * On Android this corresponds to the `alias` field in the native SDK.
   */
  deviceName: string;
  /** Backend identifier used by the server to correlate the profile. */
  identifier: string;
  /**
   * Raw metadata map returned by the server.
   *
   * @remarks
   * The shape depends on server configuration; consumers should treat this
   * as an opaque bag unless they control the server's device-profile schema.
   */
  metadata: Record<string, unknown>;
  /**
   * Physical location of the device at the time the profile was captured.
   * `null` when location was not available or not collected.
   */
  location: DeviceLocation | null;
  /** Timestamp (milliseconds since epoch) when this profile was last selected by the user. */
  lastSelectedDate: number;
}

/**
 * Discriminated mapping between a {@link DeviceKind} key and its strongly-typed device interface.
 *
 * @remarks
 * Used as a lookup table by the {@link DeviceOf} utility type.
 *
 * @example
 * ```ts
 * type Oath = DeviceByKind['oath']; // OathDevice
 * ```
 */
export interface DeviceByKind {
  /** @see {@link OathDevice} */
  oath: OathDevice;
  /** @see {@link PushDevice} */
  push: PushDevice;
  /** @see {@link BoundDevice} */
  bound: BoundDevice;
  /** @see {@link ProfileDevice} */
  profile: ProfileDevice;
  /** @see {@link WebAuthnDevice} */
  webAuthn: WebAuthnDevice;
}

/**
 * Resolves the concrete device type for a given {@link DeviceKind}.
 *
 * @typeParam K - One of the supported {@link DeviceKind} literals.
 *
 * @example
 * ```ts
 * type T = DeviceOf<'bound'>; // BoundDevice
 * ```
 */
export type DeviceOf<K extends DeviceKind> = DeviceByKind[K];
