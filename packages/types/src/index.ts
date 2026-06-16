/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Re-export ForgeRock SDK types to keep a React Native scoped import surface.
 *
 * @remarks
 * These types remain structurally identical to the originals.
 */
export * from '@forgerock/sdk-types';

import { callbackType } from '@forgerock/sdk-types';
import type { GenericError } from '@forgerock/sdk-types';
import type { LoggerInstance } from './handles.types';

/**
 * Explicit exports for core auth flow shapes used across modules.
 */
export type {
  Callback,
  CallbackType,
  Step,
  StepDetail,
  AuthResponse,
  FailureDetail,
  PolicyRequirement,
  PolicyParams,
  ServerConfig,
  AsyncServerConfig,
  LegacyConfigOptions,
  ValidLegacyConfigOptions,
  WellKnownResponse,
  Tokens,
  CustomStorageObject,
  OAuthConfig,
  DavinciOAuthConfig,
  PathsConfig,
  GetAuthorizationUrlOptions,
  GenerateAndStoreAuthUrlValues,
  ResponseType,
} from '@forgerock/sdk-types';

/**
 * Error category used across native-backed RN modules.
 *
 * @remarks
 * Derived from ForgeRock SDK types, with RN-native extensions.
 */
export type ErrorType = GenericError['type'] | 'binding_error';

/**
 * Alias for a Journey node in RN flows.
 *
 * @remarks
 * ForgeRock SDK refers to these as `Step` objects.
 */
export type Node = import('@forgerock/sdk-types').Step;

/**
 * Alias for callback payloads used in RN flows.
 */
export type NodeCallback = import('@forgerock/sdk-types').Callback;

/**
 * React Native native-extension callback type constants not currently present in
 * ForgeRock shared sdk-types.
 */
export const nativeExtensionCallbackType = {
  ConsentMappingCallback: 'ConsentMappingCallback',
  /**
   * Native type string for the external IdP authorization callback.
   *
   * @remarks
   * Some Journey SDK/server combinations surface the callback as `IdPCallback`
   * while others surface `IdpCallback`. Both represent the same external IdP
   * authorization step and should be handled by external-idp integrations.
   */
  IdPCallback: 'IdPCallback',
  IdpCallback: 'IdpCallback',
  /**
   * Native type string for the external IdP provider-selection callback.
   *
   * @remarks
   * The ForgeRock JS SDK types expose this as `callbackType.SelectIdPCallback`
   * (`'SelectIdPCallback'`, capital P), but the native Android and iOS external-idp
   * SDKs register and surface the callback as `'SelectIdpCallback'` (lowercase p).
   * This entry is the authoritative native form used for callback classification.
   */
  SelectIdpCallback: 'SelectIdpCallback',
  FidoRegistrationCallback: 'FidoRegistrationCallback',
  FidoAuthenticationCallback: 'FidoAuthenticationCallback',
  BindingCallback: 'BindingCallback',
  DeviceBindingCallback: 'DeviceBindingCallback',
  DeviceSigningVerifierCallback: 'DeviceSigningVerifierCallback',
} as const;

/**
 * Union of native-extension callback types used by RN Journey integrations.
 */
export type NativeExtensionCallbackType =
  (typeof nativeExtensionCallbackType)[keyof typeof nativeExtensionCallbackType];

/**
 * All Journey callback type strings — ForgeRock standard callbacks and
 * Ping native-extension callbacks merged into a single constant map.
 *
 * @remarks
 * Use this instead of importing `callbackType` and `nativeExtensionCallbackType`
 * separately. Consumers can also import `callbackType` and
 * `nativeExtensionCallbackType` individually if narrower imports are preferred.
 */
export const journeyCallbackType = {
  ...callbackType,
  ...nativeExtensionCallbackType,
} as const;

/**
 * Shared OIDC base configuration contracts used across RN modules.
 */
export type * from './oidc.types';

/**
 * Shared native handle and logger contracts used across RN modules.
 */
export type * from './handles.types';

/*
 * Minimal Journey instance contract for cross-module coordination.
 *
 * @remarks
 * The Journey module owns instance creation; this type enables other modules
 * to invoke Journey operations without introducing package coupling.
 * TODO: Change this contract as needed to support additional Journey interactions.
 */
export type JourneyInstance = {
  /**
   * Returns the native Journey instance identifier.
   */
  getId: () => Promise<string>;
};

/**
 * No-op logger that satisfies the {@link LoggerInstance} contract without
 * emitting output. Used as the default when no logger is provided.
 */
export const noopLogger: LoggerInstance = {
  nativeHandle: { id: '' },
  changeLevel: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

/**
 * Typed error class for all Ping SDK public API rejections.
 *
 * Native bridge rejections arrive as plain objects, not Error instances.
 * Use `PingError.from(raw)` at every catch site to normalise them so that
 * `err instanceof Error` and `err instanceof PingError` are always true.
 */
export class PingError extends Error {
  readonly code: string;
  readonly type: string;
  readonly status?: number;

  constructor(message: string, code: string, type: string, status?: number) {
    super(message);
    this.name = 'PingError';
    this.code = code;
    this.type = type;
    if (status !== undefined) this.status = status;
    // Required for correct instanceof checks when targeting older JS runtimes
    // (Hermes transpiles built-in subclassing and breaks the prototype chain).
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Normalise any caught value into a PingError.
   *
   * - If the value is already a PingError it is returned as-is.
   * - Native bridge objects carry `{ error, type, message?, status? }` where:
   *   - `message` is preferred for display; falls back to `error` when absent.
   *   - `error` becomes `code`; defaults to `'UNKNOWN_ERROR'` when absent.
   *   - `status` is only captured when it is a number (bridge always sends numeric codes).
   * - Plain Error instances use `.message` as the display string; `code` is `'UNKNOWN_ERROR'`.
   */
  static from(raw: unknown): PingError {
    if (raw instanceof PingError) return raw;

    const r = raw as Record<string, unknown>;
    // React Native wraps native rejections differently per platform:
    // - Android: GenericError fields (error, type, message) are inside `userInfo`;
    //   the top-level object also carries `nativeStackAndroid` and `code`.
    // - iOS: `userInfo` is empty; the error code is in the top-level `code` field
    //   (the first argument passed to RCTPromiseRejectBlock).
    // Resolution order: r.error → userInfo.error → r.code → 'UNKNOWN_ERROR'.
    const u =
      r?.userInfo && typeof r.userInfo === 'object'
        ? (r.userInfo as Record<string, unknown>)
        : null;
    const message =
      typeof r?.message === 'string'
        ? r.message
        : typeof r?.error === 'string'
          ? r.error
          : typeof u?.message === 'string'
            ? u.message
            : typeof u?.error === 'string'
              ? u.error
              : String(raw);
    const code =
      typeof r?.error === 'string'
        ? r.error
        : typeof u?.error === 'string'
          ? u.error
          : // iOS bridge puts the error code in `r.code` when userInfo is empty
            typeof r?.code === 'string'
            ? r.code
            : 'UNKNOWN_ERROR';
    const type =
      typeof r?.type === 'string'
        ? r.type
        : typeof u?.type === 'string'
          ? u.type
          : 'unknown_error';
    const status = typeof r?.status === 'number' ? r.status : undefined;

    const err = new PingError(message, code, type, status);
    if (raw instanceof Error && raw.stack) err.stack = raw.stack;
    return err;
  }

  /**
   * Normalise any caught value into a specific PingError subclass.
   *
   * Convenience wrapper around `PingError.from()` for subclasses — eliminates
   * the repeated boilerplate pattern in each package's error class.
   */
  static fromAs<T extends PingError>(
    raw: unknown,
    Ctor: new (m: string, c: string, t: string, s?: number) => T,
  ): T {
    if (raw instanceof Ctor) return raw;
    const base = PingError.from(raw);
    const err = new Ctor(base.message, base.code, base.type, base.status);
    if (raw instanceof Error && raw.stack) err.stack = raw.stack;
    return err;
  }
}
