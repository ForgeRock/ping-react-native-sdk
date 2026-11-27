/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { PingError } from '@ping-identity/rn-types';
import type {
  DaVinciInstance,
  JourneyInstance,
  LoggerInstance,
} from '@ping-identity/rn-types';

/**
 * DaVinci collector type string handled by this integration package.
 *
 * @remarks
 * Must match the type the native Android `CollectorInitializer` registers with
 * the DaVinci `CollectorFactory` (`"RECOGNIZE"`). The native code carries a
 * TODO confirming the value with the DaVinci server team; treat it as
 * provisional until that lands.
 */
export const recognizeCollectorType = 'RECOGNIZE' as const;

/**
 * Options for running the active Journey `PingOneRecognizeCallback`.
 *
 * @remarks
 * All Recognize configuration (API key, host, operation type, liveness,
 * presentation) is server-driven and read natively from the callback payload.
 * Whether the ceremony enrolls or authenticates is decided by the callback's
 * `operationType`, not by the caller.
 */
export type RecognizeRunOptions = {
  /**
   * Optional callback index when multiple `PingOneRecognizeCallback`s are present.
   */
  index?: number;
  /**
   * Whether the native SDK should return the captured selfie.
   *
   * @remarks
   * Defaults to `false`.
   */
  retrieveSelfie?: boolean;
};

/**
 * Runtime configuration for the Recognize module.
 */
export type RecognizeConfig = {
  /**
   * Optional JavaScript logger instance created by `@ping-identity/rn-logger`.
   */
  logger?: LoggerInstance;
};

/**
 * Outcome of an active Journey Recognize ceremony.
 *
 * @remarks
 * Both variants mean the callback inputs were mutated natively (on `failure`
 * the client error and code were recorded into the callback inputs), so the
 * app may proceed to `next()` in either case and let the server decide. Only
 * bridge-level failures (no active callback, invalid arguments, missing native
 * module) reject the promise with {@link RecognizeError}.
 */
export type RecognizeResult =
  | { type: 'success'; recognizeId: string }
  | { type: 'failure'; code: string; message: string };

/**
 * Stable error codes emitted by the Recognize module.
 *
 * @remarks
 * Keep in sync with native Recognize bridge error codes (Kotlin and Swift).
 */
export type RecognizeErrorCode =
  | 'RECOGNIZE_ERROR'
  | 'RECOGNIZE_RUN_ERROR'
  | 'RECOGNIZE_CALLBACK_NOT_FOUND'
  | (string & {});

/**
 * Stable error codes emitted by the Recognize module.
 *
 * @remarks
 * See {@link RecognizeErrorCode} for the code list and the native sync note.
 */
export const recognizeErrorCodes = {
  /** Generic Recognize bridge failure. */
  error: 'RECOGNIZE_ERROR',
  /** Native ceremony could not run (maps the native rejection). */
  runError: 'RECOGNIZE_RUN_ERROR',
  /** No active PingOneRecognizeCallback at the requested index. */
  callbackNotFound: 'RECOGNIZE_CALLBACK_NOT_FOUND',
} as const satisfies Record<string, RecognizeErrorCode>;

/**
 * Error thrown when Recognize bridge operations fail at the bridge level.
 *
 * @remarks
 * Extends {@link PingError} for per-package `instanceof` narrowing.
 * Ceremony failures that the native SDK records into the callback inputs
 * resolve as `{ type: 'failure' }` and do NOT throw.
 */
export class RecognizeError extends PingError {
  constructor(message: string, code: string, type: string, status?: number) {
    super(message, code, type, status);
    this.name = 'RecognizeError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static from(raw: unknown): RecognizeError {
    return PingError.fromAs(raw, RecognizeError);
  }
}

/**
 * Reusable client for Journey Recognize enrollment and authentication.
 */
export interface RecognizeClient {
  /**
   * Runs the active Journey `PingOneRecognizeCallback`.
   *
   * @param journey - Active Journey instance (from `useJourney`'s client).
   * @param options - Optional run options (index, retrieveSelfie).
   * @returns Resolves to a discriminated result; see {@link RecognizeResult}.
   * @throws RecognizeError when the journey id is empty, no active
   * `PingOneRecognizeCallback` exists at `index`, or the native module is missing.
   * @example
   * ```ts
   * const recognize = createRecognizeClient();
   * const result = await recognize.runForJourney(journey, { index: 0 });
   * await journey.next({});
   * ```
   */
  runForJourney(
    journey: JourneyInstance,
    options?: RecognizeRunOptions,
  ): Promise<RecognizeResult>;

  /**
   * Runs the active DaVinci `RECOGNIZE` collector.
   *
   * @param daVinci - Active DaVinci instance.
   * @param options - Optional run options (index).
   * @returns Resolves to a discriminated result; see {@link RecognizeResult}.
   * @throws RecognizeError when the DaVinci id is empty, no active
   * `RECOGNIZE` collector exists at `index`, or the native module is missing.
   * @remarks Android only in this proof of concept. The native collector
   * retains the result payload, so advance the flow with
   * `daVinci.next({ collectors: [] })` afterwards; on ceremony failure the
   * native collector has already recorded `clientError`, and advancing with an
   * empty input lets the flow branch on it.
   * @example
   * ```ts
   * const recognize = createRecognizeClient();
   * await recognize.runForDaVinci(daVinci, { index: 0 });
   * await daVinci.next({ collectors: [] });
   * ```
   */
  runForDaVinci(
    daVinci: DaVinciInstance,
    options?: RecognizeRunOptions,
  ): Promise<RecognizeResult>;
}

export type { DaVinciInstance, JourneyInstance, LoggerInstance };
