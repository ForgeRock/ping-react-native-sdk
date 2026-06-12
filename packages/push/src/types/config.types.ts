/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  LoggerInstance,
  PushStorageHandle,
} from '@ping-identity/rn-types';
import type { PushNotificationCleanupConfig } from './notification.types';

/**
 * Runtime configuration for {@link createPushClient}.
 *
 * @remarks
 * All fields are optional; the client uses platform-default values when omitted.
 * The `ios` sub-object holds options that are only meaningful on iOS.
 *
 * @example
 * ```ts
 * import { createPushClient } from '@ping-identity/rn-push';
 * import { configurePushStorage } from '@ping-identity/rn-storage';
 *
 * const storage = configurePushStorage({ android: { keyAlias: 'push_key' } });
 * const client = createPushClient({ storage, timeoutMs: 20000 });
 * ```
 */
export type PushConfig = {
  /**
   * Optional JavaScript logger instance.
   *
   * @remarks
   * Must be created by `@ping-identity/rn-logger` (`logger(...)`).
   * Both JavaScript-side and native logs are forwarded through this logger.
   */
  logger?: LoggerInstance;
  /**
   * Optional custom push storage handle.
   *
   * @remarks
   * Obtained from `configurePushStorage()` in `@ping-identity/rn-storage`.
   * When omitted, the native default SQLite/Keychain storage is used.
   */
  storage?: PushStorageHandle;
  /**
   * Optional notification cleanup configuration controlling when stored
   * notifications are purged from the local database.
   */
  notificationCleanupConfig?: PushNotificationCleanupConfig;
  /**
   * Whether to enable credential caching.
   *
   * @defaultValue false
   */
  enableCredentialCache?: boolean;
  /**
   * Network operation timeout in milliseconds.
   *
   * @defaultValue 15000
   */
  timeoutMs?: number;
  /**
   * iOS-specific configuration options.
   */
  ios?: {
    /**
     * Whether to encrypt the local push credential database on iOS.
     *
     * @remarks
     * iOS only. Android uses `SQLPushStorage` with `KeyStorePassphraseProvider`
     * by default and ignores this option.
     *
     * @defaultValue true
     */
    encryptionEnabled?: boolean;
  };
};

/**
 * Resolved flat configuration shape sent over the native bridge during initialization.
 *
 * @remarks
 * This is the internal wire format passed to the native `initialize()` call.
 * Callers should use {@link PushConfig} instead and let {@link createPushClient}
 * flatten the config into this shape.
 */
export type PushClientConfig = {
  /** Native logger handle id resolved from `logger.nativeHandle.id`. */
  loggerId?: string;
  /** Storage handle id resolved from `PushConfig.storage.id`. */
  storageId?: string;
  /** Whether to enable credential caching. */
  enableCredentialCache?: boolean;
  /** Network operation timeout in milliseconds. */
  timeoutMs?: number;
  /** Cleanup mode string resolved from `notificationCleanupConfig.cleanupMode`. */
  cleanupMode?: string;
  /** Maximum number of stored notifications. */
  maxStoredNotifications?: number;
  /** Maximum notification age in days. */
  maxNotificationAgeDays?: number;
  /**
   * Whether to encrypt the local push credential database.
   *
   * @remarks
   * iOS only — Android ignores this field.
   */
  encryptionEnabled?: boolean;
};
