/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { PingError, type LoggerInstance } from '@ping-identity/rn-types';

/**
 * Configuration for creating a Protect client.
 *
 * @public
 */
export type ProtectConfig = {
  /**
   * Optional logger instance for SDK debug output.
   *
   * @remarks
   * When omitted, all logging is silently suppressed via a built-in no-op logger.
   */
  logger?: LoggerInstance;

  /** PingOne environment ID for the Protect SDK. */
  envId?: string;

  /**
   * Whether to enable behavioral data collection.
   *
   * @defaultValue `true`
   */
  isBehavioralDataCollection?: boolean;

  /**
   * Whether to use lazy metadata loading.
   *
   * @defaultValue `false`
   */
  isLazyMetadata?: boolean;

  /** Custom host URL for the Protect SDK. */
  customHost?: string;

  /**
   * Whether to enable console logging inside the Protect SDK.
   *
   * @defaultValue `false`
   */
  isConsoleLogEnabled?: boolean;

  /** Device attributes to exclude from signal collection. */
  deviceAttributesToIgnore?: string[];

  /**
   * When `true`, `start()` automatically calls `pauseBehavioralData()` on flow success.
   *
   * @remarks
   * The RN bridge does not have lifecycle hooks into the DaVinci workflow, so this flag
   * is a documentation hint only. Call `pauseBehavioralData()` manually after the flow
   * succeeds if you need this behavior.
   *
   * @defaultValue `false`
   */
  pauseBehavioralDataOnSuccess?: boolean;

  /**
   * When `true`, `start()` automatically calls `resumeBehavioralData()` after initialization.
   *
   * @defaultValue `false`
   */
  resumeBehavioralDataOnStart?: boolean;
};

/**
 * Per-call options for `collectForDaVinci`.
 *
 * @public
 */
export type ProtectCollectOptions = {
  /**
   * Zero-based index of the `ProtectCollector` within the active `ContinueNode`.
   *
   * @remarks
   * Defaults to `0`. Use a non-zero value when a node contains multiple `PROTECT`
   * collectors (uncommon).
   */
  index?: number;
};

/**
 * Per-call bridge configuration forwarded to the native module.
 *
 * @internal
 */
export type ProtectClientConfig = {
  loggerId?: string;
};

/**
 * Error codes emitted by the Protect module.
 *
 * @public
 */
export type ProtectErrorCode =
  | 'PROTECT_COLLECT_ERROR'
  | 'PROTECT_COLLECTOR_NOT_FOUND'
  | 'PROTECT_INITIALIZE_ERROR';

/**
 * Error thrown by `@ping-identity/rn-protect` operations.
 *
 * @public
 */
export class ProtectError extends PingError {
  constructor(message: string, code: string, type: string, status?: number) {
    super(message, code, type, status);
    this.name = 'ProtectError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static from(error: unknown): ProtectError {
    return PingError.fromAs(error, ProtectError);
  }
}
