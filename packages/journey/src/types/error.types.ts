/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { PingError } from '@ping-identity/rn-types';

/**
 * Error thrown when Journey operations fail.
 *
 * Extends {@link PingError} to allow per-package `instanceof` narrowing.
 */
export class JourneyError extends PingError {
  constructor(message: string, code: string, type: string, status?: number) {
    super(message, code, type, status);
    this.name = 'JourneyError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static from(raw: unknown): JourneyError {
    return PingError.fromAs(raw, JourneyError);
  }
}

/**
 * Stable Journey error codes surfaced by native and JS guardrails.
 */
export type JourneyErrorCode =
  | 'JOURNEY_CONFIG_ERROR'
  | 'JOURNEY_INIT_ERROR'
  | 'JOURNEY_START_ERROR'
  | 'JOURNEY_NEXT_ERROR'
  | 'JOURNEY_RESUME_ERROR'
  | 'JOURNEY_USER_ERROR'
  | 'JOURNEY_LOGOUT_ERROR'
  | 'JOURNEY_DISPOSE_ERROR'
  | 'JOURNEY_STATE_ERROR'
  | 'JOURNEY_CALLBACK_APPLY_ERROR'
  | 'JOURNEY_UNSUPPORTED_CALLBACK_ERROR'
  | 'JOURNEY_MISSING_INTEGRATION_ERROR';
