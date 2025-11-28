import {
  configureJourney,
  startJourney,
  nextNode,
  resumeJourney,
  getSession,
  logout,
} from './journeyMethods';

import type { JourneyClient, JourneyConfig, JourneyOptions } from './types';
import type { StorageInstance } from '@react-native-pingidentity/storage';

export function journey(
  config: JourneyConfig,
  modules?: { // TBD
    session: {
      storage: StorageInstance<any>
    }
  }
) : JourneyClient{
  let journeyId: string | null = null;
  let sessionStorageId = modules?.session.storage.id
  // Lazily configures first time it's actually used
  async function ensureConfigured() {
    if (!journeyId) {
      journeyId = await configureJourney(config, sessionStorageId);
      // console.log('[JourneyClient] configured instance:', journeyId);
    }
    return journeyId;
  }

  return {
    /** Explicit initialization helper for app startup */
    async init() {
      return await ensureConfigured();
    },
    /** Returns the native journeyId */
    async getId() {
      return await ensureConfigured();
    },

    /** Start a journey */
    async start(journeyName: string, options?: JourneyOptions) {
      const id = await ensureConfigured();
      return startJourney(id, journeyName, options);
    },

    /** Continue an active flow */
    async next(nodeId: string, input: Record<string, any>) {
      const id = await ensureConfigured();
      return nextNode(id, nodeId, input);
    },

    /** Resume a suspended flow */
    async resume(uri: string) {
      const id = await ensureConfigured();
      return resumeJourney(id, uri);
    },

    /** Retrieve session */
    async user() {
      const id = await ensureConfigured();
      return getSession(id);
    },

    /** Logout */
    async logoutUser() {
      const id = await ensureConfigured();
      return logout(id);
    },
  };
}
