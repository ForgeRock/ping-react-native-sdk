import NativeRNPingJourney from './NativeRNPingJourney';
import type {
  JourneyConfig,
  JourneyOptions,
  Node,
  JourneyUserSession,
} from './types';

/**
 * Configure the Journey SDK.
 * Returns a unique journeyId that maps to an instance in native JourneyRegistry.
 */
export async function configureJourney(
  config: JourneyConfig,
  sessionStorageId?: string
): Promise<string> {
  return await NativeRNPingJourney.configureJourney({
    ...config,
    sessionStorageId, // TBD: Storage ID to get instance from Registry
  });
}

/**
 * Start a Journey by name.
 * Now requires journeyId to ensure calls map to the correct native instance.
 */
export async function startJourney(
  journeyId: string,
  journeyName: string,
  options?: JourneyOptions
): Promise<Node> {
  return await NativeRNPingJourney.start(journeyId, journeyName, options);
}

/**
 * Advance to the next node with user input.
 * Now requires journeyId to target the correct instance.
 */
export async function nextNode(
  journeyId: string,
  nodeId: string,
  input: Record<string, any>
): Promise<Node> {
  return await NativeRNPingJourney.next(journeyId, nodeId, input);
}

/**
 * Resume a suspended Journey (e.g., magic link or deep link).
 * Now requires journeyId so suspended flows resume into the correct instance.
 */
export async function resumeJourney(
  journeyId: string,
  uri: string
): Promise<Node> {
  return await NativeRNPingJourney.resume(journeyId, uri);
}

/**
 * Retrieve an existing user session if available.
 * Session is now scoped per journey instance rather than global.
 */
export async function getSession(
  journeyId: string
): Promise<JourneyUserSession | null> {
  const session = await NativeRNPingJourney.getSession(journeyId);
  return session ? (session as JourneyUserSession) : null;
}

/**
 * Logout and clear the active session.
 * Now scoped per-instance to avoid invalidating other journeys.
 */
export async function logout(
  journeyId: string
): Promise<boolean> {
  return await NativeRNPingJourney.logout(journeyId);
}

/*
* POC only to show registered Storages from core
*/
export async function listRegisteredStoragesFromCore(): Promise<string[]> {
  return await NativeRNPingJourney.listRegisteredStoragesFromCore()
}