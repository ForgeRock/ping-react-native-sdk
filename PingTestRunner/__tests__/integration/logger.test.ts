/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Integration tests for @ping-identity/rn-logger
 *
 * Validates that the logger package:
 * - Exports the `logger` factory function
 * - Creates logger instances with the correct level API
 * - Delegates log calls through the JS logger API
 * - Handles level changes at runtime
 */

import { logger } from '@ping-identity/rn-logger';

describe('@ping-identity/rn-logger — integration', () => {
  describe('exports', () => {
    it('exports logger factory function', () => {
      expect(typeof logger).toBe('function');
    });
  });

  describe('logger()', () => {
    it('creates a logger instance with all log-level methods', () => {
      const log = logger({ level: 'debug' });
      expect(typeof log.debug).toBe('function');
      expect(typeof log.info).toBe('function');
      expect(typeof log.warn).toBe('function');
      expect(typeof log.error).toBe('function');
    });

    it('exposes a changeLevel method', () => {
      const log = logger({ level: 'info' });
      expect(typeof log.changeLevel).toBe('function');
    });

    it('exposes a nativeHandle', () => {
      const log = logger({ level: 'info' });
      expect(log.nativeHandle).toBeDefined();
      expect(typeof log.nativeHandle.id).toBe('string');
    });

    it('does not throw when calling log methods', () => {
      const log = logger({ level: 'debug' });
      expect(() => log.debug('debug msg')).not.toThrow();
      expect(() => log.info('info msg')).not.toThrow();
      expect(() => log.warn('warn msg')).not.toThrow();
      expect(() => log.error('error msg')).not.toThrow();
    });

    it('does not throw when changing log level', () => {
      const log = logger({ level: 'debug' });
      expect(() => log.changeLevel('error')).not.toThrow();
    });
  });

  describe('type contracts', () => {
    it('logger instance satisfies LoggerInstance shape', () => {
      const log = logger({ level: 'debug' });
      // Validate structural contract at runtime
      const shape: string[] = [
        'debug',
        'info',
        'warn',
        'error',
        'changeLevel',
        'nativeHandle',
      ];
      for (const key of shape) {
        expect(log).toHaveProperty(key);
      }
    });
  });
});
