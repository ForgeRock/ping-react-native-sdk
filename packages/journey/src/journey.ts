/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import {
  configureJourney,
  disposeJourney,
  getSession,
  logout,
  nextNode,
  resumeJourney,
  startJourney,
} from './journeyMethods';
import type {
  JourneyClient,
  JourneyConfig,
  JourneyError,
  JourneyModules,
  JourneyNextInput,
  JourneyStartOptions,
} from './types';

/**
 * Creates a native-backed Journey client instance.
 *
 * @param config - Journey configuration payload.
 * @param modules - Optional module composition settings (for example session storage).
 * @returns A `JourneyClient` handle for imperative Journey flows.
 * @throws {Error} When required configuration is missing.
 */
export function journey(
  config: JourneyConfig,
  modules?: JourneyModules
): JourneyClient {
  if (!config.serverUrl?.trim()) {
    throw new Error(
      '[@ping-identity/rn-journey] Missing configuration. Provide a non-empty serverUrl.'
    );
  }

  let journeyId: string | null = null;
  const sessionStorageId = modules?.session?.storage?.id;
  const loggerId =
    config.nativeLogger?.id ??
    config.logger?.nativeHandle?.id;

  const logDebug = (message: string, payload?: Record<string, unknown>): void => {
    if (payload) {
      config.logger?.debug(message, payload);
      return;
    }
    config.logger?.debug(message);
  };

  /**
   * Ensures the native Journey instance has been configured.
   *
   * @returns Native Journey identifier.
   * @throws {JourneyError} When configuration fails.
   */
  const ensureConfigured = async (): Promise<string> => {
    if (!journeyId) {
      logDebug('Journey configure requested');
      journeyId = await configureJourney(config, sessionStorageId, loggerId);
      logDebug('Journey configure succeeded', { journeyId });
    }
    return journeyId;
  };

  return {
    async init(): Promise<string> {
      return await ensureConfigured();
    },

    async getId(): Promise<string> {
      return await ensureConfigured();
    },

    async start(
      journeyName: string,
      options?: JourneyStartOptions
    ) {
      if (!journeyName.trim()) {
        throw {
          type: 'argument_error',
          error: 'JOURNEY_START_ERROR',
          message: 'Journey name must not be empty.',
        } satisfies JourneyError;
      }

      const id = await ensureConfigured();
      logDebug('Journey start requested', { journeyName });
      return await startJourney(id, journeyName, options);
    },

    async next(input: JourneyNextInput = {}) {
      const id = await ensureConfigured();
      logDebug('Journey next requested');
      return await nextNode(id, input);
    },

    async resume(uri: string) {
      if (!uri.trim()) {
        throw {
          type: 'argument_error',
          error: 'JOURNEY_RESUME_ERROR',
          message: 'Resume URI must not be empty.',
        } satisfies JourneyError;
      }

      const id = await ensureConfigured();
      logDebug('Journey resume requested');
      return await resumeJourney(id, uri);
    },

    async user() {
      const id = await ensureConfigured();
      return await getSession(id);
    },

    async logoutUser() {
      const id = await ensureConfigured();
      return await logout(id);
    },

    async dispose() {
      if (!journeyId) {
        return;
      }
      await disposeJourney(journeyId);
      journeyId = null;
    },
  };
}
