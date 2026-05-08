/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { PingError } from '@ping-identity/rn-types';

/**
 * Error thrown when device ID operations fail.
 *
 * Extends {@link PingError} to allow per-package `instanceof` narrowing.
 */
export class DeviceIdError extends PingError {
  constructor(message: string, code: string, type: string, status?: number) {
    super(message, code, type, status);
    this.name = 'DeviceIdError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static from(raw: unknown): DeviceIdError {
    if (raw instanceof DeviceIdError) return raw;
    const base = PingError.from(raw);
    const err = new DeviceIdError(
      base.message,
      base.code,
      base.type,
      base.status,
    );
    if (raw instanceof Error && raw.stack) err.stack = raw.stack;
    return err;
  }
}

/**
 * Stable error codes emitted by the Device ID module.
 *
 * @remarks
 * Keep these in sync with native error constants.
 */
export type DeviceIdErrorCode = 'DEVICE_ID_ERROR';
