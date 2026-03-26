/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { GenericError } from '@ping-identity/rn-types';

/**
 * Error payload returned when FIDO operations fail.
 *
 * @remarks
 * Rejections use this shape; success resolves with the identifier string.
 */
export type FidoError = GenericError;

/**
 * Stable error codes emitted by the FIDO module.
 *
 * @remarks
 * Keep these in sync with native error constants.
 */
export type FidoErrorCode = 'FIDO_ERROR';
