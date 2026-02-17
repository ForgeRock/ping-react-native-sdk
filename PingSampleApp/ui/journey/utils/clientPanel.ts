/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { JourneyNormalizedField } from '@ping-identity/rn-journey';

/**
 * Storage key used by the sample app to persist recent Journey names.
 */
export const RECENT_JOURNEYS_STORAGE_KEY = 'recentJourneys';

/**
 * Default polling delay used when `PollingWaitCallback` does not provide a wait time.
 */
export const DEFAULT_AUTO_POLLING_WAIT_MS = 3000;

/**
 * Device profile collectors used by the sample app integration path.
 */
export const DEVICE_PROFILE_COLLECTORS = [
  'platform',
  'hardware',
  'network',
  'location',
] as const;

/**
 * Converts unknown values into display-safe strings.
 *
 * @param value - Arbitrary value.
 * @param fallback - Fallback string.
 * @returns Normalized string.
 */
function readString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

/**
 * Extracts a display name from a Journey session payload.
 *
 * @param session - Session payload returned by `user()`.
 * @returns Given name when available.
 */
export function extractGivenName(session: unknown): string | undefined {
  if (!session || typeof session !== 'object') {
    return undefined;
  }

  const userInfo = (session as Record<string, unknown>).userInfo;
  if (!userInfo || typeof userInfo !== 'object') {
    return undefined;
  }

  const givenName = (userInfo as Record<string, unknown>).given_name;
  const normalized = readString(givenName, '');
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Resolves polling wait time from a normalized polling callback field.
 *
 * @param fields - Normalized callback fields.
 * @returns Polling wait time in milliseconds when available.
 */
export function resolvePollingWaitMs(fields: JourneyNormalizedField[]): number | null {
  const pollingField = fields.find((field) => field.ref.type === 'PollingWaitCallback');
  if (!pollingField) {
    return null;
  }

  const waitTime = pollingField.raw.waitTime;
  if (typeof waitTime === 'number' && Number.isFinite(waitTime) && waitTime > 0) {
    return waitTime;
  }
  if (typeof waitTime === 'string') {
    const parsed = Number(waitTime);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}
