/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { logger as createLogger } from '@react-native-pingidentity/logger';
import type { LoggerInstance } from '@react-native-pingidentity/logger';

/**
 * Logger instance for device profile operations.
 *
 * Initializes a logger with 'info' level by default. If initialization fails,
 * falls back to a console-based logger to ensure logging functionality remains available.
 */
export const logger: LoggerInstance  = ((): LoggerInstance => {
  try {
    return createLogger({ level: 'info' });
  } catch (error) {
    console.warn(`Device profile Failed to initialize JS logger`, error);
    return {
      // Sentinel handle for fallback-only logger paths; not used for native sync.
      nativeHandle: { id: 'device-profile-fallback' },
      changeLevel: () => {},
      error: (...args) => console.error(...args),
      warn: (...args) => console.warn(...args),
      info: (...args) => console.info(...args),
      debug: (...args) => console.debug(...args),
    };
  }
})();
