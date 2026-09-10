/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { OidcDeviceClient } from '@ping-identity/rn-oidc';

let activeDeviceClient: OidcDeviceClient | null = null;
let activeDeviceStorageKey: string | null = null;
let restoreInFlight: Promise<OidcDeviceClient | null> | null = null;

/** Stores the authenticated device client for the sample app session. */
export function setActiveDeviceClient(
  client: OidcDeviceClient,
  storageKey?: string,
): void {
  activeDeviceClient = client;
  activeDeviceStorageKey = storageKey ?? null;
}

/** Returns the authenticated device client, when Device Authorization succeeded. */
export function getActiveDeviceClient(): OidcDeviceClient | null {
  return activeDeviceClient;
}

/**
 * Recreates the device client and restores a persisted native session.
 *
 * The client handle is process-local, while the device-flow token is stored by
 * the native OIDC SDK. Rebuilding the handle with the same storage-backed
 * configuration allows the SDK to resolve that token after an app restart.
 *
 * @param createClient Factory for a device client with stable configuration and storage.
 * @returns The restored client, or null when no persisted user exists.
 * @throws Any error raised while creating or checking the restored client.
 */
export async function restoreActiveDeviceClient(
  createClient: () => OidcDeviceClient,
  storageKey?: string,
): Promise<OidcDeviceClient | null> {
  if (activeDeviceClient && activeDeviceStorageKey === (storageKey ?? null)) {
    return activeDeviceClient;
  }
  if (activeDeviceClient) {
    await clearActiveDeviceClient();
  }
  if (restoreInFlight) {
    return restoreInFlight;
  }

  restoreInFlight = (async () => {
    const candidate = createClient();
    try {
      const user = await candidate.user();
      if (!user) {
        await candidate.dispose();
        return null;
      }
      activeDeviceClient = candidate;
      activeDeviceStorageKey = storageKey ?? null;
      return candidate;
    } catch (error) {
      await candidate.dispose();
      throw error;
    }
  })().finally(() => {
    restoreInFlight = null;
  });

  return restoreInFlight;
}

/** Clears and disposes the active device client. */
export async function clearActiveDeviceClient(): Promise<void> {
  const client = activeDeviceClient;
  activeDeviceClient = null;
  activeDeviceStorageKey = null;
  await client?.dispose();
}
