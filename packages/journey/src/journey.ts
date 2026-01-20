import {
  configureJourney,
  startJourney,
  nextNode,
  resumeJourney,
  getSession,
  logout,
} from './journeyMethods';

import type { JourneyClient, JourneyConfig, JourneyOptions } from './types';

/**
 * Configuration modules for journey initialization
 */
type JourneyModules = {
  /**
   * Session storage configuration
   */
  session?: {
    /**
     * Identifier for the storage instance to use for session persistence
     */
    storageId?: string;
  };
};

/**
 * Creates a Journey client instance for managing authentication flows
 * 
 * This factory function creates a Journey client that handles authentication journeys,
 * including starting flows, processing callbacks, resuming suspended flows, and managing sessions.
 * The configuration is lazily initialized on first use.
 * 
 * @param config - Journey configuration including server URL, OAuth client details, and optional settings
 * @param modules - Optional configuration modules for session storage and other features
 * 
 * @returns A configured JourneyClient instance with methods to interact with authentication flows
 * 
 * @example
 * ```typescript
 * const client = journey({
 *   serverUrl: 'https://auth.example.com',
 *   oauthClientId: 'my-client-id',
 *   oauthRedirectUri: 'myapp://callback',
 *   oauthScope: 'openid profile email'
 * });
 * 
 * // Start an authentication journey
 * const response = await client.start('Login');
 * ```
 */
export function journey(
  config: JourneyConfig,
  modules?: JourneyModules
) : JourneyClient{
  let journeyId: string | null = null;
  let sessionStorageId = modules?.session?.storageId;
  
  /**
   * Ensures the journey instance is configured before use
   * Lazily initializes the configuration on first call
   * 
   * @returns The unique journey instance identifier
   * @internal
   */
  async function ensureConfigured() {
    if (!journeyId) {
      journeyId = await configureJourney(config, sessionStorageId);
      // console.log('[JourneyClient] configured instance:', journeyId);
    }
    return journeyId;
  }

  return {
    /**
     * Explicitly initializes the journey client
     * 
     * This method can be called during app startup to ensure the journey is configured
     * before any authentication flows are needed. While initialization is lazy by default,
     * this allows for eager initialization.
     * 
     * @returns Promise that resolves to the journey instance identifier
     */
    async init() {
      return await ensureConfigured();
    },
    
    /**
     * Returns the native journey instance identifier
     * 
     * @returns Promise that resolves to the unique journey ID
     */
    async getId() {
      return await ensureConfigured();
    },

    /**
     * Starts a new authentication journey
     * 
     * Initiates an authentication flow by journey name. The server will return
     * the first set of callbacks that need to be processed.
     * 
     * @param journeyName - The name of the journey to start (e.g., 'Login', 'Registration')
     * @param options - Optional journey configuration including resume URI and query parameters
     * 
     * @returns Promise that resolves to the journey response containing callbacks or session
     * 
     * @example
     * ```typescript
     * const response = await client.start('Login');
     * if (response.callbacks) {
     *   // Process callbacks
     * }
     * ```
     */
    async start(journeyName: string, options?: JourneyOptions) {
      const id = await ensureConfigured();
      return startJourney(id, journeyName, options);
    },

    /**
     * Continues an active authentication flow by submitting callback responses
     * 
     * After collecting user input for the current callbacks, submit them to receive
     * the next step in the journey or the final result.
     * 
     * @param nodeId - The identifier of the current node in the journey
     * @param input - Key-value pairs of callback responses
     * 
     * @returns Promise that resolves to the next journey response
     * 
     * @example
     * ```typescript
     * const response = await client.next(nodeId, {
     *   'IDToken1': 'username',
     *   'IDToken2': 'password'
     * });
     * ```
     */
    async next(nodeId: string, input: Record<string, any>) {
      const id = await ensureConfigured();
      return nextNode(id, nodeId, input);
    },

    /**
     * Resumes a suspended authentication flow from a URI
     * 
     * When a flow is suspended (e.g., for email verification), it can be resumed
     * using the provided URI.
     * 
     * @param uri - The resume URI provided by the suspended flow
     * 
     * @returns Promise that resolves to the resumed journey response
     * 
     * @example
     * ```typescript
     * const response = await client.resume('https://auth.example.com/resume?token=...');
     * ```
     */
    async resume(uri: string) {
      const id = await ensureConfigured();
      return resumeJourney(id, uri);
    },

    /**
     * Retrieves the current user session
     * 
     * Gets the session information for the authenticated user, including tokens
     * and user profile data.
     * 
     * @returns Promise that resolves to the session data, or null if no active session
     * 
     * @example
     * ```typescript
     * const session = await client.user();
     * if (session) {
     *   console.log('Access token:', session.accessToken);
     * }
     * ```
     */
    async user() {
      const id = await ensureConfigured();
      return getSession(id);
    },

    /**
     * Logs out the current user and ends their session
     * 
     * Terminates the user's session on the server and clears local session data.
     * 
     * @returns Promise that resolves when logout is complete
     * 
     * @example
     * ```typescript
     * await client.logoutUser();
     * ```
     */
    async logoutUser() {
      const id = await ensureConfigured();
      return logout(id);
    },
  };
}
