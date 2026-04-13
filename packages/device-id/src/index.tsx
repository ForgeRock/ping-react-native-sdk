/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import { getNativeModule } from './NativeRNPingDeviceId';

/**
 * Returns the default secure device identifier as determined by the native platform.
 *
 * The default identifier is platform-specific and provides a high level of
 * cryptographic security:
 * - **Android**: Uses KeyStore-generated RSA key pair, cryptographically secure and hardware-backed when available
 * - **iOS**: Uses Keychain-backed unique identifier with secure enclave when available
 *
 * This is the recommended method for most use cases. The identifier:
 *
 * **Android persistence:**
 * - Generates a new ID when app is reinstalled (KeyStore entries are generally removed on uninstall)
 * - Remains consistent if KeyStore entries persist, but this is not typical
 * - Changes when KeyStore entries are cleared (e.g., via app data clear)
 *
 * **iOS persistence:**
 * - Persists across app uninstalls and reinstalls (Keychain is not cleared when app is deleted)
 * - Persists when device is restored from encrypted iCloud or local backup
 * - Permanently deleted only on factory reset (entire device storage wiped)
 * - Can be shared across apps from the same developer using Keychain Access Groups
 * - Automatically migrates and preserves legacy identifiers from FRAuth, maintaining the original SHA-1 hash
 *
 * - Is unique per app and device
 * - Uses platform-specific secure storage mechanisms
 *
 * @returns A promise that resolves to the default device identifier string
 *
 * @remarks
 * Promise rejections use {@link DeviceIdError}.
 *
 * @example
 * ```typescript
 * import { getDeviceId } from '@ping-identity/rn-device-id';
 *
 * // Get secure device identifier for authentication
 * const deviceId = await getDeviceId();
 * console.log('Device ID:', deviceId);
 * // Output: "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export async function getDeviceId(): Promise<string> {
  return await getNativeModule().getDefaultDeviceId();
}

export type { DeviceIdError, DeviceIdErrorCode } from './types';
