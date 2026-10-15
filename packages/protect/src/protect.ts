/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import {
  noopLogger,
  registerIntegrationCollectorType,
} from '@ping-identity/rn-types';
import type {
  DaVinciInstance,
  JourneyInstance,
  LoggerInstance,
} from '@ping-identity/rn-types';
import {
  fromNativeJourneyResult,
  getNativeModule,
  toNativeConfig,
  toNativeProtectConfig,
} from './NativeRNPingProtect';
import type {
  ProtectConfig,
  ProtectJourneyInitializeOptions,
  ProtectJourneyOptions,
  ProtectJourneyResult,
} from './types';
import { ProtectError } from './types/protect.types';

function resolveLoggerId(logger?: LoggerInstance): string | undefined {
  const id = logger?.nativeHandle?.id?.trim();
  return id || undefined;
}

async function withLogging<T>(
  operation: string,
  logger: LoggerInstance,
  fn: () => Promise<T>,
): Promise<T> {
  logger.debug(`Protect ${operation} requested`);
  try {
    const result = await fn();
    logger.info(`Protect ${operation} success`);
    return result;
  } catch (error) {
    logger.error(`Protect ${operation} failed`);
    throw ProtectError.from(error);
  }
}

/**
 * Initializes the Protect SDK and optionally resumes behavioral data collection.
 *
 * @param config - Protect SDK configuration and optional logger.
 * @returns Resolves with `void` on success.
 * @throws {@link ProtectError} when initialization fails.
 *
 * @example
 * ```ts
 * import { startProtect } from '@ping-identity/rn-protect';
 * await startProtect({ envId: 'your-pingone-env-id' });
 * ```
 *
 * @public
 */
export async function startProtect(config: ProtectConfig = {}): Promise<void> {
  const logger = config.logger ?? noopLogger;
  const loggerId = resolveLoggerId(config.logger);
  logger.debug(
    `Protect startProtect config ${JSON.stringify({ hasLogger: Boolean(loggerId) }, null, 2)}`,
  );

  // Register the native DaVinci serializer eagerly so a PROTECT collector on a
  // DaVinci node serializes fully even before the first native call.
  // Fire-and-forget — older native binaries without this method must not fail
  // client creation.
  try {
    void getNativeModule()
      .registerDaVinciSerializer()
      .catch(() => {});
  } catch {
    // Native module unavailable — DaVinci Protect serialization is simply not
    // supported in this build.
  }

  return withLogging('startProtect', logger, async () => {
    await getNativeModule().initialize(
      toNativeProtectConfig(config),
      toNativeConfig({ loggerId }),
    );
    if (config.resumeBehavioralDataOnStart) {
      await getNativeModule().resumeBehavioralData(
        toNativeConfig({ loggerId }),
      );
    }
    // Register only after initialization (and any requested resume) succeed, so
    // a failed startup does not leave PROTECT marked as supported.
    registerIntegrationCollectorType('PROTECT');
  });
}

/**
 * Makes the native Journey module aware of the PingOne Protect callbacks without
 * initializing the Protect SDK.
 *
 * @param options - Optional logger.
 * @returns Resolves with `void` once registration completes.
 * @throws {@link ProtectError} when the native registration call fails.
 *
 * @example
 * ```ts
 * import { startProtectForJourney } from '@ping-identity/rn-protect';
 * await startProtectForJourney();
 * const node = await journey.start();
 * ```
 *
 * @remarks
 * Journey-only. Call this once at app startup, before the first Journey `start()` or
 * `next()`. It does not initialize Protect: the initialize callback in the tree still
 * supplies the configuration through {@link initializeProtectForJourney}. Do not call
 * {@link startProtect} instead, because it initializes the SDK with app configuration
 * and prevents the tree configuration from being applied. On Android the call only
 * resolves.
 *
 * @public
 */
export async function startProtectForJourney(
  options: { logger?: LoggerInstance } = {},
): Promise<void> {
  const logger = options.logger ?? noopLogger;
  return withLogging('startProtectForJourney', logger, async () => {
    await getNativeModule().registerJourneyCallbacks();
  });
}

/**
 * Pauses behavioral data collection.
 *
 * Call this after a successful authentication flow. Requires `startProtect()` first.
 *
 * @param options - Optional logger instance.
 * @returns Resolves with `void` on success.
 * @throws {@link ProtectError} when the SDK is not initialized.
 *
 * @example
 * ```ts
 * import { pauseBehavioralData } from '@ping-identity/rn-protect';
 * await pauseBehavioralData();
 * ```
 *
 * @public
 */
export async function pauseBehavioralData(
  options: { logger?: LoggerInstance } = {},
): Promise<void> {
  const logger = options.logger ?? noopLogger;
  const loggerId = resolveLoggerId(options.logger);
  return withLogging('pauseBehavioralData', logger, () =>
    getNativeModule().pauseBehavioralData(toNativeConfig({ loggerId })),
  );
}

/**
 * Resumes behavioral data collection.
 *
 * Call this at the start of a new authentication flow. Requires `startProtect()` first.
 *
 * @param options - Optional logger instance.
 * @returns Resolves with `void` on success.
 * @throws {@link ProtectError} when the SDK is not initialized.
 *
 * @example
 * ```ts
 * import { resumeBehavioralData } from '@ping-identity/rn-protect';
 * await resumeBehavioralData();
 * ```
 *
 * @public
 */
export async function resumeBehavioralData(
  options: { logger?: LoggerInstance } = {},
): Promise<void> {
  const logger = options.logger ?? noopLogger;
  const loggerId = resolveLoggerId(options.logger);
  return withLogging('resumeBehavioralData', logger, () =>
    getNativeModule().resumeBehavioralData(toNativeConfig({ loggerId })),
  );
}

/**
 * Runs PingOne Protect data collection for the active PROTECT collector in a DaVinci flow.
 *
 * Call this before `daVinci.next({})` when the current node contains a PROTECT collector.
 * The collected payload is set internally on the native collector so that `next` picks it
 * up automatically.
 *
 * @param daVinci - Active DaVinci instance.
 * @returns Resolves with `void` on successful Protect data collection.
 * @throws {@link ProtectError} when collection fails or the collector is not found.
 *
 * @example
 * ```ts
 * import { collectProtect } from '@ping-identity/rn-protect';
 * await collectProtect(daVinci);
 * await daVinci.next({});
 * ```
 *
 * @public
 */
export async function collectProtect(daVinci: DaVinciInstance): Promise<void> {
  const davinciId = await daVinci.getId();
  try {
    await getNativeModule().collectForDaVinci(
      davinciId,
      {},
      toNativeConfig({}),
    );
  } catch (error) {
    throw ProtectError.from(error);
  }
}

/**
 * Executes a Journey `PingOneProtectInitializeCallback`.
 *
 * This is the only Journey initialize path: the native initialize callback carries its
 * own server-driven configuration, parsed from the direct `output[]` form or the
 * MetadataCallback-derived form used by Marketplace and legacy trees, so this function
 * deliberately takes no `ProtectConfig` argument. A tree whose initialize callback
 * carries no parseable configuration fails natively as `PROTECT_INITIALIZE_ERROR`
 * rather than falling back to app-supplied configuration.
 *
 * @param journey - Active Journey instance holding the Protect initialize callback.
 * @param options - Optional logger.
 * @returns Resolves with `{ type: 'success' }` when initialization completes.
 * @throws {@link ProtectError} with codes `PROTECT_CALLBACK_NOT_FOUND` or
 * `PROTECT_INITIALIZE_ERROR` on native failure.
 *
 * @example
 * ```ts
 * import { initializeProtectForJourney } from '@ping-identity/rn-protect';
 * await initializeProtectForJourney(journey);
 * ```
 *
 * @remarks
 * Journey-only: use {@link startProtect} for DaVinci flows and pre-flow initialization.
 * Native initialization is once-only, so whichever initialize path succeeds first wins;
 * a subsequent initialize applies only its behavioral-data resume/pause, not its
 * identity configuration. Declare the Protect callback types in `handledCallbackTypes`
 * when calling `journey.next` so the Journey module leaves the callback state untouched.
 *
 * @public
 */
export async function initializeProtectForJourney(
  journey: JourneyInstance,
  options: ProtectJourneyInitializeOptions = {},
): Promise<ProtectJourneyResult> {
  const logger = options.logger ?? noopLogger;
  const loggerId = resolveLoggerId(options.logger);

  return withLogging('initializeProtectForJourney', logger, async () => {
    const journeyId = await journey.getId();
    const result = await getNativeModule().initializeForJourney(
      journeyId,
      toNativeConfig({ loggerId }),
    );
    return fromNativeJourneyResult(result);
  });
}

/**
 * Runs PingOne Protect risk evaluation for a Journey `PingOneProtectEvaluationCallback`.
 *
 * This is the Journey equivalent of {@link collectProtect}: it does not depend on a
 * DaVinci flow or a `ProtectCollector`. The collected risk signal is written natively
 * into the resolved Journey callback (or its sibling hidden-value fields) and is never
 * returned to JavaScript; advance the flow with `journey.next(...)` afterwards.
 *
 * @param journey - Active Journey instance holding the Protect evaluation callback.
 * @param options - Optional callback index and logger.
 * @returns Resolves with `{ type: 'success' }` when collection completes.
 * @throws {@link ProtectError} with code `PROTECT_ARGUMENT_ERROR` and type
 * `argument_error` when `options.index` is negative or not an integer; the native
 * module is not called in that case.
 * @throws {@link ProtectError} with codes `PROTECT_NOT_INITIALIZED`,
 * `PROTECT_CALLBACK_NOT_FOUND`, or `PROTECT_COLLECT_ERROR` on native failure.
 *
 * @example
 * ```ts
 * import { collectProtectForJourney } from '@ping-identity/rn-protect';
 * await collectProtectForJourney(journey);
 * await journey.next(buildNextInput(node, values, handledCallbackTypes).input);
 * ```
 *
 * @remarks
 * Journey-only: use {@link collectProtect} for DaVinci flows. Initialize Protect first
 * with {@link initializeProtectForJourney} (or `startProtect()` for DaVinci and
 * pre-flow initialization) or the native module rejects with `PROTECT_NOT_INITIALIZED`.
 * Declare the Protect callback types in `handledCallbackTypes` when calling
 * `journey.next` so the Journey module leaves the natively written signal untouched.
 *
 * @public
 */
export async function collectProtectForJourney(
  journey: JourneyInstance,
  options: ProtectJourneyOptions = {},
): Promise<ProtectJourneyResult> {
  const logger = options.logger ?? noopLogger;
  const loggerId = resolveLoggerId(options.logger);

  return withLogging('collectProtectForJourney', logger, async () => {
    const index = options.index ?? 0;
    if (!Number.isInteger(index) || index < 0) {
      throw new ProtectError(
        `[@ping-identity/rn-protect] Invalid index ${String(index)}. Provide a non-negative integer.`,
        'PROTECT_ARGUMENT_ERROR',
        'argument_error',
      );
    }

    const journeyId = await journey.getId();
    const result = await getNativeModule().collectForJourney(
      journeyId,
      { index },
      toNativeConfig({ loggerId }),
    );
    return fromNativeJourneyResult(result);
  });
}
