/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Push MFA platform identifier.
 *
 * @remarks
 * Widened with `| (string & {})` for semver safety.
 *
 * Values are uppercase strings as emitted by both native SDKs:
 * - `'PING_AM'` — PingAM (formerly ForgeRock AM) push platform
 * - `'PING_ONE'` — PingOne MFA push platform
 */
export type PushPlatform = 'PING_AM' | 'PING_ONE' | (string & {});

/**
 * A registered push MFA credential stored on the device.
 *
 * @remarks
 * Returned by {@link PushClient.addCredentialFromUri},
 * {@link PushClient.getCredential}, {@link PushClient.getCredentials},
 * and {@link PushClient.saveCredential}.
 *
 * The `sharedSecret` field is intentionally omitted — it is kept native-side
 * only and never crosses the bridge.
 *
 * @example
 * ```ts
 * const credential = await client.addCredentialFromUri('pushauth://...');
 * console.log(credential.issuer, credential.accountName);
 * ```
 */
export type PushCredential = {
  /** Unique credential identifier. */
  id: string;
  /** Optional user identifier associated with the credential. */
  userId: string | null;
  /**
   * Resource identifier for the protected resource.
   *
   * @remarks
   * `null` on Android — the Android `PushCredential` SDK class does not expose this field.
   * Non-null on iOS.
   */
  resourceId: string | null;
  /** Issuer name (e.g. service or application name). */
  issuer: string;
  /**
   * Display name for the issuer, may override `issuer` in UI.
   *
   * @remarks
   * `null` when not set by the server. Both platforms may return `null` for this field.
   */
  displayIssuer: string | null;
  /** Account name (e.g. username or email address). */
  accountName: string;
  /**
   * Display name for the account, may override `accountName` in UI.
   *
   * @remarks
   * `null` when not set by the server. Both platforms may return `null` for this field.
   */
  displayAccountName: string | null;
  /**
   * Server endpoint URL used to communicate with the push service.
   *
   * @remarks
   * `null` on Android — the Android `PushCredential` SDK class does not expose this field.
   * Non-null on iOS.
   */
  serverEndpoint: string | null;
  /** Credential creation timestamp in milliseconds since epoch. */
  createdAt: number;
  /** Optional credential image URL for display purposes. */
  imageURL: string | null;
  /** Optional background color hint for display (CSS hex or named color). */
  backgroundColor: string | null;
  /** Serialized policy string, if any, associated with this credential. */
  policies: string | null;
  /** Serialized locking policy string, if any, for this credential. */
  lockingPolicy: string | null;
  /** Whether the credential is currently locked. */
  isLocked: boolean;
  /** Push platform identifier. */
  platform: PushPlatform;
};
