/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

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
 */
export type DeviceProfileJourneyResult =
  | { type: 'success' }
  | { type: 'error'; code: string; message?: string };

/**
 * TODO: Relocate types package as journey module matures.
 * Minimal Journey instance contract required by device profile collection.
 *
 * @remarks
 * The Journey module owns instance creation; this type enables cross-module coordination.
 */
export type JourneyInstance = {
  /**
   * Returns the native Journey instance identifier.
   */
  getId: () => Promise<string>;
};
