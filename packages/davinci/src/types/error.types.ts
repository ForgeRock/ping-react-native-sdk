/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { PingError } from '@ping-identity/rn-types';

/**
 * Error thrown when DaVinci operations fail.
 *
 * Extends {@link PingError} to allow per-package `instanceof` narrowing.
 *
 * @example
 * ```ts
 * try {
 *   await client.start();
 * } catch (err) {
 *   if (err instanceof DaVinciError) {
 *     console.error(err.code, err.message);
 *   }
 * }
 * ```
 *
 * @public
 */
export class DaVinciError extends PingError {
  constructor(message: string, code: string, type: string, status?: number) {
    super(message, code, type, status);
    this.name = 'DaVinciError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Converts any thrown value into a `DaVinciError`.
   *
   * @param raw - Thrown value from a native or JS rejection.
   * @returns A `DaVinciError` preserving the original error fields when available.
   */
  static from(raw: unknown): DaVinciError {
    return PingError.fromAs(raw, DaVinciError);
  }
}

/**
 * Stable DaVinci error codes surfaced by native and JS guardrails.
 *
 * @public
 */
export type DaVinciErrorCode =
  | 'DAVINCI_CONFIG_ERROR' // createDaVinciClient: missing/invalid modules.oidc fields
  | 'DAVINCI_START_ERROR' // start()
  | 'DAVINCI_NEXT_ERROR' // next(): flow progression failure
  | 'DAVINCI_COLLECTOR_APPLY_ERROR' // next(): collector value application failure
  | 'DAVINCI_SESSION_ERROR' // user() / refresh() / revoke() / userinfo()
  | 'DAVINCI_LOGOUT_ERROR' // logoutUser()
  | 'DAVINCI_DISPOSE_ERROR' // dispose()
  | 'DAVINCI_ARGUMENT_ERROR' // JS guardrails: invalid argument at call site
  | 'DAVINCI_STATE_ERROR' // operation on invalid state (e.g. no active node)
  | 'DAVINCI_MISSING_INTEGRATION_ERROR' // collector requires additional module integration
  | 'DAVINCI_UNKNOWN_ERROR' // catch-all
  | (string & {});
