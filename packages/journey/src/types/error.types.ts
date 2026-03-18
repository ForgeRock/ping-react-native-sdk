/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { GenericError } from '@ping-identity/rn-types';

/**
 * Journey error payload contract.
 *
 * @remarks
 * Mirrors the shared `GenericError` contract to keep error semantics aligned
 * across all native-backed React Native modules.
 */
export type JourneyError = GenericError;

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
