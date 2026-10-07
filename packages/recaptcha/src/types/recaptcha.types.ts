/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { PingError } from '@ping-identity/rn-types';
import type { JourneyInstance, LoggerInstance } from '@ping-identity/rn-types';

/**
 * JSON-compatible value used by reCAPTCHA bridge payloads (custom risk payload).
 */
export type RecaptchaJsonValue =
  | string
  | number
  | boolean
  | null
  | RecaptchaJsonValue[]
  | { [key: string]: RecaptchaJsonValue };

/**
 * Options for executing an active Journey ReCaptchaEnterpriseCallback.
 *
 * @remarks
 * The reCAPTCHA site key is NOT caller-supplied — the native callback reads it
 * from the server payload (Android `reCaptchaSiteKey`, iOS `recaptchaSiteKey`),
 * mirroring native `verify()` semantics.
 */
export type RecaptchaVerifyOptions = {
  /**
   * Optional callback index when multiple ReCaptchaEnterpriseCallbacks are present.
   */
  index?: number;
  /**
   * reCAPTCHA action name associated with this verification.
   *
   * @remarks
   * Defaults to `'login'` on both platforms. Android maps `'login'` to
   * `RecaptchaAction.LOGIN`, `'signup'` to `RecaptchaAction.SIGNUP`, and any
   * other value to `RecaptchaAction.custom(value)`. iOS passes the string to
   * `RecaptchaAction(customAction:)` directly.
   */
  action?: string;
  /**
   * Verification timeout in milliseconds.
   *
   * @remarks
   * Defaults to 15000 and is always passed explicitly to both platforms so
   * behavior is identical despite the native defaults differing
   * (Android 10000ms, iOS 15000ms).
   */
  timeoutMs?: number;
  /**
   * Optional custom risk-assessment metadata submitted with the verification.
   */
  payload?: RecaptchaJsonValue;
};

/**
 * Runtime configuration for the reCAPTCHA module.
 */
export type RecaptchaConfig = {
  /**
   * Optional JavaScript logger instance created by `@ping-identity/rn-logger`.
   */
  logger?: LoggerInstance;
};

/**
 * Outcome of an active Journey reCAPTCHA Enterprise verification.
 *
 * @remarks
 * Both variants mean the callback inputs were mutated natively (on `failure`
 * the client error was recorded into the callback inputs), so the app may
 * proceed to `next()` in either case and let the server decide. Only
 * bridge-level failures (no active callback, invalid arguments, missing native
 * module) reject the promise with {@link RecaptchaError}.
 */
export type RecaptchaVerifyResult =
  | { type: 'success'; token: string }
  | { type: 'failure'; code: string; message: string };

/**
 * Stable error codes emitted by the reCAPTCHA module.
 *
 * @remarks
 * Keep in sync with native `RecaptchaErrorCodes` (Kotlin) / `RecaptchaErrorCode` (Swift).
 */
export type RecaptchaErrorCode =
  | 'RECAPTCHA_ERROR'
  | 'RECAPTCHA_VERIFY_ERROR'
  | 'RECAPTCHA_CALLBACK_NOT_FOUND'
  | (string & {});

/**
 * Stable error codes emitted by the reCAPTCHA module.
 *
 * @remarks
 * Keep these in sync with native error constants:
 * - Android: `RecaptchaErrorCodes.kt` (Phase 3)
 * - iOS: `RecaptchaErrorCode` Swift enum (Phase 4)
 */
export const recaptchaErrorCodes = {
  /** Generic reCAPTCHA bridge failure. */
  error: 'RECAPTCHA_ERROR',
  /** Native verification could not complete (maps the native rejection). */
  verifyError: 'RECAPTCHA_VERIFY_ERROR',
  /** No active ReCaptchaEnterpriseCallback at the requested index. */
  callbackNotFound: 'RECAPTCHA_CALLBACK_NOT_FOUND',
} as const satisfies Record<string, RecaptchaErrorCode>;

/**
 * Error thrown when reCAPTCHA bridge operations fail at the bridge level.
 *
 * @remarks
 * Extends {@link PingError} for per-package `instanceof` narrowing.
 * Verification failures that the native SDK records into the callback inputs
 * resolve as `{ type: 'failure' }` and do NOT throw.
 */
export class RecaptchaError extends PingError {
  constructor(message: string, code: string, type: string, status?: number) {
    super(message, code, type, status);
    this.name = 'RecaptchaError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static from(raw: unknown): RecaptchaError {
    return PingError.fromAs(raw, RecaptchaError);
  }
}

/**
 * Reusable client for Journey reCAPTCHA Enterprise verification.
 */
export interface RecaptchaClient {
  /**
   * Executes the active Journey ReCaptchaEnterpriseCallback.
   *
   * @param journey - Active Journey instance (from `useJourney`'s client).
   * @param options - Optional verification options (index, action, timeoutMs, payload).
   * @returns Resolves to a discriminated result; see {@link RecaptchaVerifyResult}.
   * @throws RecaptchaError when the journey id is empty, no active
   * ReCaptchaEnterpriseCallback exists at `index`, or the native module is missing.
   */
  verifyForJourney(
    journey: JourneyInstance,
    options?: RecaptchaVerifyOptions,
  ): Promise<RecaptchaVerifyResult>;
}

export type { JourneyInstance, LoggerInstance };
