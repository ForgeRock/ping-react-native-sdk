import NativeRNPingJourney from './NativeRNPingJourney';
import type {
  JourneyConfig,
  JourneyOptions,
  Node,
  JourneyUserSession,
} from './types';

/**
 * Configure the Journey SDK.
 */
export async function configureJourney(
  config: JourneyConfig
): Promise<boolean> {
  return await NativeRNPingJourney.configureJourney(config);
}

/**
 * Start a Journey by name.
 */
export async function startJourney(
  journeyName: string,
  options?: JourneyOptions
): Promise<Node> {
  return await NativeRNPingJourney.start(journeyName, options);
}

/**
 * Advance to the next node with user input.
 */
export async function nextNode(
  nodeId: string,
  input: Record<string, any>
): Promise<Node> {
  return await NativeRNPingJourney.next(nodeId, input);
}

/**
 * Resume a suspended Journey (e.g., magic link or deep link).
 */
export async function resumeJourney(uri: string): Promise<Node> {
  return await NativeRNPingJourney.resume(uri);
}

/**
 * Retrieve an existing user session if available.
 */
export async function getSession(): Promise<JourneyUserSession | null> {
  const session = await NativeRNPingJourney.getSession();
  return session ? (session as JourneyUserSession) : null;
}

/**
 * Logout and clear the active session.
 */
export async function logout(): Promise<boolean> {
  return await NativeRNPingJourney.logout();
}