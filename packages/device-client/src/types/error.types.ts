/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { PingError } from '@ping-identity/rn-types';

/**
 * Error thrown when Device Client operations fail.
 *
 * Extends {@link PingError} to allow per-package `instanceof` narrowing.
 *
 * @example
 * ```ts
 * try {
 *   await client.oath.get();
 * } catch (err) {
 *   if (err instanceof DeviceClientError && err.code === 'DEVICE_CLIENT_INVALID_TOKEN') {
 *     // trigger re-authentication
 *   }
 * }
 * ```
 */
export class DeviceClientError extends PingError {
  constructor(message: string, code: string, type: string, status?: number) {
    super(message, code, type, status);
    this.name = 'DeviceClientError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static from(raw: unknown): DeviceClientError {
    return PingError.fromAs(raw, DeviceClientError);
  }
}

/**
 * Stable error codes emitted by the Device Client module.
 *
 * @remarks
 * Keep these in sync with native error constants on both iOS and Android.
 *
 * | Code | Meaning |
 * |------|---------|
 * | `DEVICE_CLIENT_ERROR` | Generic / unknown error. |
 * | `DEVICE_CLIENT_NETWORK_ERROR` | Network connectivity failure. |
 * | `DEVICE_CLIENT_REQUEST_FAILED` | Server returned a non-success HTTP status. |
 * | `DEVICE_CLIENT_INVALID_TOKEN` | SSO token is missing, expired, or rejected. |
 * | `DEVICE_CLIENT_DECODING_FAILED` | Native bridge could not parse the server response. |
 * | `DEVICE_CLIENT_MISSING_CONFIG` | Required configuration fields were not provided. |
 * | `DEVICE_CLIENT_NOT_FOUND` | The requested device does not exist on the server. |
 * | `DEVICE_CLIENT_HANDLE_NOT_FOUND` | The native handle id does not correspond to a live client. |
 */
export type DeviceClientErrorCode =
  | 'DEVICE_CLIENT_ERROR'
  | 'DEVICE_CLIENT_NETWORK_ERROR'
  | 'DEVICE_CLIENT_REQUEST_FAILED'
  | 'DEVICE_CLIENT_INVALID_TOKEN'
  | 'DEVICE_CLIENT_DECODING_FAILED'
  | 'DEVICE_CLIENT_MISSING_CONFIG'
  | 'DEVICE_CLIENT_NOT_FOUND'
  | 'DEVICE_CLIENT_HANDLE_NOT_FOUND'
  | (string & {});
