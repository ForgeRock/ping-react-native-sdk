/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Push notification type discriminator.
 *
 * @remarks
 * Widened with `| (string & {})` for semver safety — future platform types
 * remain assignable without a breaking change.
 *
 * Values are lowercase strings as emitted by both native SDKs:
 * - `'default'` — standard push approval request
 * - `'challenge'` — numeric challenge selection request
 * - `'biometric'` — biometric authentication request
 */
export type PushType = 'default' | 'challenge' | 'biometric' | (string & {});

/**
 * A push MFA notification received from the server.
 *
 * @remarks
 * Returned by {@link PushClient.processNotification},
 * {@link PushClient.processNotificationFromMessage},
 * {@link PushClient.getNotification}, {@link PushClient.getPendingNotifications},
 * and {@link PushClient.getAllNotifications}.
 *
 * The `numbersChallenge` field is a raw comma-separated string (e.g. `"12,34,56"`).
 * Use {@link getNumbersChallenge} (exported from `@ping-identity/rn-push`) to
 * parse it into `number[]`.
 *
 * @example
 * ```ts
 * const notification = await client.processNotification(messageData);
 * if (notification?.pushType === 'challenge') {
 *   const numbers = getNumbersChallenge(notification);
 * }
 * ```
 */
export type PushNotification = {
  /** Unique notification identifier. */
  id: string;
  /** Identifier of the credential this notification belongs to. */
  credentialId: string;
  /** Time-to-live for the notification in seconds. */
  ttl: number;
  /** Unique message identifier from the push payload. */
  messageId: string;
  /** Optional human-readable message text for display. */
  messageText: string | null;
  /** Optional custom payload string forwarded from the server. */
  customPayload: string | null;
  /** Optional string challenge used for `'challenge'` type notifications. */
  challenge: string | null;
  /**
   * Raw comma-separated numbers challenge string (e.g. `"12,34,56"`).
   *
   * @remarks
   * Only populated for `pushType === 'challenge'` notifications that use
   * the numbers-matching flow. Parse with `getNumbersChallenge(notification)`.
   */
  numbersChallenge: string | null;
  /** Optional load balancer hint sent with the notification payload. */
  loadBalancer: string | null;
  /** Optional serialized context info string from the server payload. */
  contextInfo: string | null;
  /** Push notification type discriminator. */
  pushType: PushType;
  /** Notification creation timestamp in milliseconds since epoch. */
  createdAt: number;
  /** Optional timestamp when the notification was sent, in milliseconds since epoch. */
  sentAt: number | null;
  /** Optional timestamp when the notification was responded to, in milliseconds since epoch. */
  respondedAt: number | null;
  /** Whether the notification was approved by the user. */
  approved: boolean;
  /** Whether the notification is still pending a response. */
  pending: boolean;
};

/**
 * Cleanup strategy for stored push notifications.
 *
 * @remarks
 * - `'NONE'` — no automatic cleanup; notifications accumulate indefinitely.
 * - `'COUNT_BASED'` — remove oldest notifications when count exceeds `maxStoredNotifications`.
 * - `'AGE_BASED'` — remove notifications older than `maxNotificationAgeDays` days.
 * - `'HYBRID'` — apply both count-based and age-based cleanup.
 *
 * Widened with `| (string & {})` for semver safety.
 */
export type PushNotificationCleanupConfig = {
  /**
   * Cleanup mode controlling when stored notifications are purged.
   *
   * @remarks
   * Widened with `| (string & {})` for semver safety.
   */
  cleanupMode: 'NONE' | 'COUNT_BASED' | 'AGE_BASED' | 'HYBRID' | (string & {});
  /**
   * Maximum number of notifications to retain when using `'COUNT_BASED'` or `'HYBRID'` mode.
   *
   * @defaultValue 100
   */
  maxStoredNotifications?: number;
  /**
   * Maximum age in days for retained notifications when using `'AGE_BASED'` or `'HYBRID'` mode.
   *
   * @defaultValue 30
   */
  maxNotificationAgeDays?: number;
};
