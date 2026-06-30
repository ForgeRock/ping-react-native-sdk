/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import NativeRNPingDavinci from './NativeRNPingDavinci';
import type { NativeDaVinciConfig } from './NativeRNPingDavinci';
import type {
  DaVinciNextInput,
  DaVinciNode,
  DaVinciUserSession,
} from './types';
import { DaVinciError } from './types/error.types';

/**
 * Configure a native DaVinci workflow instance.
 *
 * @param config - Serialised DaVinci configuration payload.
 * @returns Native DaVinci instance identifier (davinciId handle).
 * @throws {DaVinciError} When configuration fails.
 */
export async function configureDaVinci(
  config: NativeDaVinciConfig,
): Promise<string> {
  try {
    return await NativeRNPingDavinci.configureDaVinci(config);
  } catch (error) {
    throw DaVinciError.from(error);
  }
}

/**
 * Start the DaVinci flow.
 *
 * @param davinciId - Native DaVinci instance identifier.
 * @returns First flow node.
 * @throws {DaVinciError} When start fails.
 */
export async function startDaVinci(davinciId: string): Promise<DaVinciNode> {
  try {
    const node = await NativeRNPingDavinci.start(davinciId);
    return node as unknown as DaVinciNode;
  } catch (error) {
    throw DaVinciError.from(error);
  }
}

/**
 * Advance the active DaVinci flow node.
 *
 * @param davinciId - Native DaVinci instance identifier.
 * @param input - Key-indexed collector values to apply before advancing.
 * @returns Next flow node.
 * @throws {DaVinciError} When value application or flow progression fails.
 */
export async function nextDaVinci(
  davinciId: string,
  input: DaVinciNextInput,
): Promise<DaVinciNode> {
  try {
    const node = await NativeRNPingDavinci.next(davinciId, input);
    return node as unknown as DaVinciNode;
  } catch (error) {
    throw DaVinciError.from(error);
  }
}

/**
 * Resolve the active DaVinci user session.
 *
 * @param davinciId - Native DaVinci instance identifier.
 * @returns Session payload, or `null` when no active session.
 * @throws {DaVinciError} When session retrieval fails.
 */
export async function getDaVinciSession(
  davinciId: string,
): Promise<DaVinciUserSession | null> {
  try {
    const session = await NativeRNPingDavinci.getSession(davinciId);
    return session ? (session as DaVinciUserSession) : null;
  } catch (error) {
    throw DaVinciError.from(error);
  }
}

/**
 * Refresh the active DaVinci user session tokens.
 *
 * @param davinciId - Native DaVinci instance identifier.
 * @returns Refreshed session payload, or `null` when no active session.
 * @throws {DaVinciError} When refresh fails.
 */
export async function refreshDaVinciSession(
  davinciId: string,
): Promise<DaVinciUserSession | null> {
  try {
    const session = await NativeRNPingDavinci.refresh(davinciId);
    return session ? (session as DaVinciUserSession) : null;
  } catch (error) {
    throw DaVinciError.from(error);
  }
}

/**
 * Revoke the active DaVinci user access and refresh tokens.
 *
 * @param davinciId - Native DaVinci instance identifier.
 * @returns `true` when revocation completes.
 * @throws {DaVinciError} When revocation fails.
 */
export async function revokeDaVinciSession(
  davinciId: string,
): Promise<boolean> {
  try {
    return await NativeRNPingDavinci.revoke(davinciId);
  } catch (error) {
    throw DaVinciError.from(error);
  }
}

/**
 * Resolve userinfo claims for the active DaVinci session.
 *
 * @param davinciId - Native DaVinci instance identifier.
 * @returns Userinfo payload, or `null` when no active session.
 * @throws {DaVinciError} When userinfo retrieval fails.
 */
export async function getDaVinciUserInfo(
  davinciId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const info = await NativeRNPingDavinci.userinfo(davinciId);
    return info ? (info as Record<string, unknown>) : null;
  } catch (error) {
    throw DaVinciError.from(error);
  }
}

/**
 * Log out the active DaVinci user and clear the session.
 *
 * @param davinciId - Native DaVinci instance identifier.
 * @throws {DaVinciError} When logout fails.
 */
export async function logoutDaVinci(davinciId: string): Promise<void> {
  try {
    await NativeRNPingDavinci.logout(davinciId);
  } catch (error) {
    throw DaVinciError.from(error);
  }
}

/**
 * Dispose the native DaVinci instance and release runtime state.
 *
 * @param davinciId - Native DaVinci instance identifier.
 * @throws {DaVinciError} When disposal fails.
 */
export async function disposeDaVinci(davinciId: string): Promise<void> {
  try {
    await NativeRNPingDavinci.dispose(davinciId);
  } catch (error) {
    throw DaVinciError.from(error);
  }
}
