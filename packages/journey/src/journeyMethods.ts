/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import NativeRNPingJourney from './NativeRNPingJourney';
import type {
  JourneySSOToken,
  JourneyNextInput,
  JourneyNode,
  JourneyUserInfo,
  JourneyStartOptions,
  JourneyUserSession,
} from './types';
import { JourneyError } from './types/error.types';
import type { NativeJourneyConfig } from './NativeRNPingJourney';

/**
 * Configure the native Journey instance.
 *
 * @param config - Journey configuration payload.
 * @returns Native Journey instance identifier.
 */
export async function configureJourney(
  config: NativeJourneyConfig,
): Promise<string> {
  try {
    return await NativeRNPingJourney.configureJourney(config);
  } catch (error) {
    throw JourneyError.from(error);
  }
}

/**
 * Start a Journey by name.
 *
 * @param journeyId - Native Journey instance identifier.
 * @param journeyName - Journey/tree name configured on the server.
 * @param options - Optional start flags.
 * @returns First Journey node.
 */
export async function startJourney(
  journeyId: string,
  journeyName: string,
  options?: JourneyStartOptions,
): Promise<JourneyNode> {
  try {
    const node = await NativeRNPingJourney.start(
      journeyId,
      journeyName,
      options,
    );
    return node as unknown as JourneyNode;
  } catch (error) {
    throw JourneyError.from(error);
  }
}

/**
 * Advance the currently active Journey node.
 *
 * @param journeyId - Native Journey instance identifier.
 * @param input - Callback input payload.
 * @returns Next Journey node.
 */
export async function nextNode(
  journeyId: string,
  input: JourneyNextInput = {},
): Promise<JourneyNode> {
  try {
    const node = await NativeRNPingJourney.next(journeyId, '', input);
    return node as unknown as JourneyNode;
  } catch (error) {
    throw JourneyError.from(error);
  }
}

/**
 * Resume a suspended Journey flow.
 *
 * @param journeyId - Native Journey instance identifier.
 * @param uri - Resume URI.
 * @returns Resumed Journey node.
 */
export async function resumeJourney(
  journeyId: string,
  uri: string,
): Promise<JourneyNode> {
  try {
    const node = await NativeRNPingJourney.resume(journeyId, uri);
    return node as unknown as JourneyNode;
  } catch (error) {
    throw JourneyError.from(error);
  }
}

/**
 * Resolve current user/session details for a Journey instance.
 *
 * @param journeyId - Native Journey instance identifier.
 * @returns Session payload, or `null` when unavailable.
 */
export async function getSession(
  journeyId: string,
): Promise<JourneyUserSession | null> {
  try {
    const session = await NativeRNPingJourney.getSession(journeyId);
    return session ? (session as JourneyUserSession) : null;
  } catch (error) {
    throw JourneyError.from(error);
  }
}

/**
 * Refresh current user/session details for a Journey instance.
 *
 * @param journeyId - Native Journey instance identifier.
 * @returns Refreshed session payload, or `null` when unavailable.
 */
export async function refreshSession(
  journeyId: string,
): Promise<JourneyUserSession | null> {
  try {
    const session = await NativeRNPingJourney.refresh(journeyId);
    return session ? (session as JourneyUserSession) : null;
  } catch (error) {
    throw JourneyError.from(error);
  }
}

/**
 * Revoke current Journey user access/refresh tokens.
 *
 * @param journeyId - Native Journey instance identifier.
 * @returns `true` when revoke succeeds.
 */
export async function revokeSession(journeyId: string): Promise<boolean> {
  try {
    return await NativeRNPingJourney.revoke(journeyId);
  } catch (error) {
    throw JourneyError.from(error);
  }
}

/**
 * Resolve current Journey userinfo payload.
 *
 * @param journeyId - Native Journey instance identifier.
 * @returns Userinfo payload, or `null` when unavailable.
 */
export async function getUserInfo(
  journeyId: string,
): Promise<JourneyUserInfo | null> {
  try {
    const userInfo = await NativeRNPingJourney.userinfo(journeyId);
    return userInfo ? (userInfo as JourneyUserInfo) : null;
  } catch (error) {
    throw JourneyError.from(error);
  }
}

/**
 * Resolve current Journey SSO token payload.
 *
 * @param journeyId - Native Journey instance identifier.
 * @returns SSO token payload, or `null` when unavailable.
 */
export async function getSSOToken(
  journeyId: string,
): Promise<JourneySSOToken | null> {
  try {
    const ssoToken = await NativeRNPingJourney.ssoToken(journeyId);
    return ssoToken ? (ssoToken as JourneySSOToken) : null;
  } catch (error) {
    throw JourneyError.from(error);
  }
}

/**
 * Logout active Journey session.
 *
 * @param journeyId - Native Journey instance identifier.
 * @returns `true` when logout succeeds.
 */
export async function logout(journeyId: string): Promise<boolean> {
  try {
    return await NativeRNPingJourney.logout(journeyId);
  } catch (error) {
    throw JourneyError.from(error);
  }
}

/**
 * Dispose native Journey instance and release associated state.
 *
 * @param journeyId - Native Journey instance identifier.
 */
export async function disposeJourney(journeyId: string): Promise<void> {
  try {
    await NativeRNPingJourney.dispose(journeyId);
  } catch (error) {
    throw JourneyError.from(error);
  }
}
