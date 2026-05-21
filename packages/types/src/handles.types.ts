/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Shared logging level values used by JavaScript logger contracts.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

/**
 * Shared JavaScript log message payload type.
 */
export type LogMessage = unknown;

/**
 * Shared native logger handle contract.
 *
 * @remarks
 * Accessible via `logger(...).nativeHandle` from `@ping-identity/rn-logger`.
 */
export type NativeLoggerHandle = {
  /**
   * Native logger identifier.
   */
  id: string;
};

/**
 * Shared JavaScript logger instance contract.
 *
 * @remarks
 * Returned by `logger(...)` from `@ping-identity/rn-logger`.
 */
export type LoggerInstance = {
  /**
   * Native logger handle associated with this logger instance.
   */
  nativeHandle: NativeLoggerHandle;
  /**
   * Updates the logger level.
   */
  changeLevel: (level: LogLevel) => void;
  /**
   * Logs an error message.
   */
  error: (...args: LogMessage[]) => void;
  /**
   * Logs a warning message.
   */
  warn: (...args: LogMessage[]) => void;
  /**
   * Logs an informational message.
   */
  info: (...args: LogMessage[]) => void;
  /**
   * Logs a debug message.
   */
  debug: (...args: LogMessage[]) => void;
};

/**
 * Compile-time brand key for session storage handles.
 *
 * @internal
 */
declare const sessionStorageHandleBrand: unique symbol;

/**
 * Compile-time brand key for OIDC storage handles.
 *
 * @internal
 */
declare const oidcStorageHandleBrand: unique symbol;
declare const bindingUserKeyStorageHandleBrand: unique symbol;

/**
 * Shared opaque handle returned by session storage configuration helpers.
 */
export type SessionStorageHandle = Readonly<{
  /**
   * Native identifier for a registered session storage configuration.
   */
  id: string;
  /**
   * Runtime discriminator for session storage handles.
   */
  kind: 'session';
  /**
   * Compile-time brand to keep this handle opaque.
   *
   * @internal
   */
  [sessionStorageHandleBrand]: true;
}>;

/**
 * Shared opaque handle returned by OIDC storage configuration helpers.
 */
export type OidcStorageHandle = Readonly<{
  /**
   * Native identifier for a registered OIDC storage configuration.
   */
  id: string;
  /**
   * Runtime discriminator for OIDC storage handles.
   */
  kind: 'oidc';
  /**
   * Compile-time brand to keep this handle opaque.
   *
   * @internal
   */
  [oidcStorageHandleBrand]: true;
}>;

/**
 * Shared opaque handle returned by binding user-key storage configuration helpers.
 */
export type BindingUserKeyStorageHandle = Readonly<{
  /**
   * Native identifier for a registered binding user-key storage configuration.
   */
  id: string;
  /**
   * Runtime discriminator for binding user-key storage handles.
   */
  kind: 'binding_user_key_storage';
  /**
   * Compile-time brand to keep this handle opaque.
   *
   * @internal
   */
  [bindingUserKeyStorageHandleBrand]: true;
}>;

/**
 * Compile-time brand key for push MFA storage handles.
 *
 * @internal
 */
declare const pushStorageHandleBrand: unique symbol;

/**
 * Shared opaque handle returned by push storage configuration helpers.
 *
 * @remarks
 * Obtained from `configurePushStorage()` in `@ping-identity/rn-storage`.
 * Pass to `createPushClient({ storage })` to use custom storage for push MFA.
 */
export type PushStorageHandle = Readonly<{
  /**
   * Native identifier for a registered push storage configuration.
   */
  id: string;
  /**
   * Runtime discriminator for push storage handles.
   */
  kind: 'push_storage';
  /**
   * Compile-time brand to keep this handle opaque.
   *
   * @internal
   */
  [pushStorageHandleBrand]: true;
}>;
