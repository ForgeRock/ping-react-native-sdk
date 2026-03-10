/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * @packageDocumentation
 * @module @ping-identity/rn-logger
 * 
 * A React Native logger module that provides unified logging across JavaScript and native platforms.
 * 
 * @remarks
 * This module provides a logger that works seamlessly across React Native's JavaScript layer
 * and native iOS/Android code. It supports different log levels and custom logger implementations.
 * 
 * @example
 * Basic usage:
 * ```typescript
 * import { logger } from '@ping-identity/rn-logger';
 * 
 * const log = logger({ level: 'debug' });
 * log.debug('This is a debug message');
 * log.info('This is an info message');
 * log.warn('This is a warning');
 * log.error('This is an error');
 * 
 * // Change log level dynamically
 * log.changeLevel('error');
 * ```
 */

export { configureLogger, logger } from './logger';
export type * from './types/logger.types';
