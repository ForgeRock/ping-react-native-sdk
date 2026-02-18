/*
* Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
*
* This software may be modified and distributed under the terms
* of the MIT license. See the LICENSE file for details.
*/

import type { GenericError } from '@ping-identity/rn-types';
/**
 * Supported device profile collectors.
 *
 * @remarks
 * Collectors are semantic and platform-agnostic. Native implementations map
 * these identifiers to platform-specific collectors or ignore unsupported ones.
 */
export type DeviceProfileCollector =
  | 'platform'
  | 'hardware'
  | 'network'
  | 'telephony'
  | 'browser'
  | 'bluetooth'
  | 'location';

/**
 * Represents a generic device profile collected outside of Journey flows.
 *
 * @remarks
 * The structure is platform-defined and JSON-compatible.
 */
export type DeviceProfile = {
  [collectorKey: string]: unknown;
};

/**
 * Error payload returned when device profile operations fail.
 *
 * @remarks
 * Rejections use this shape; success resolves with data or `{ type: 'success' }`.
 */
export type DeviceProfileError = GenericError;

/**
 * Stable error codes emitted by the Device Profile module.
 *
 * @remarks
 * Keep these in sync with native error constants.
 */
export type DeviceProfileErrorCode =
  | 'DEVICE_PROFILE_LOCATION_UNAVAILABLE'
  | 'DEVICE_PROFILE_CALLBACK_NOT_FOUND'
  | 'DEVICE_PROFILE_COLLECT_ERROR';

/**
 * Represents a device profile structured for PingOne AIC consumption.
 *
 * @remarks
 * JavaScript must not reshape this payload.
 */
export type DeviceProfileCallbackInputValue = {
  identifier?: string;
  alias?: string;
  metadata?: Record<string, unknown>;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

/**
 * Represents the result of collecting a device profile within a Journey.
 *
 * @remarks
 * The native implementation resolves this payload once the callback has been submitted.
 * Errors reject with {@link DeviceProfileError}.
 */
export type DeviceProfileJourneyResult =
  { type: 'success' };
