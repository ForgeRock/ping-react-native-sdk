/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { LoggerInstance } from '@ping-identity/rn-types';
import { getNativeModule } from './NativeRNPingDeviceClient';
import type {
  DeviceClient,
  DeviceClientConfig,
  DeviceKind,
  DeviceOf,
  DeviceRepository,
} from './types';

/**
 * No-op logger used when the caller does not provide a logger instance.
 * Prevents null-checks on every log call inside repository operations.
 */
const noopLogger: LoggerInstance = {
  nativeHandle: { id: '' },
  changeLevel: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

/**
 * Shape of the wrapper object returned by native bridge calls that
 * contain a `result` property.
 */
interface NativePayload {
  result: unknown;
}

/**
 * Extracts a typed array from a native bridge response.
 *
 * @remarks
 * Native `get` calls return `{ result: Device[] }`. This helper safely
 * unwraps the `result` property or returns an empty array when the payload
 * does not match the expected shape.
 *
 * @typeParam T - The expected element type of the result array.
 * @param payload - Raw value returned by the native bridge.
 * @returns The unwrapped array, or an empty array if the payload is malformed.
 */
function extractArray<T>(payload: unknown): T[] {
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as NativePayload).result)
  ) {
    return (payload as { result: T[] }).result;
  }
  return [];
}

/**
 * Extracts a single typed object from a native bridge response.
 *
 * @remarks
 * Native `update` calls return `{ result: Device }`. This helper unwraps the
 * `result` property, falling back to the raw payload when the wrapper shape
 * is absent.
 *
 * @typeParam T - The expected type of the result object.
 * @param payload - Raw value returned by the native bridge.
 * @returns The unwrapped object.
 */
function extractObject<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'result' in payload) {
    return (payload as { result: T }).result;
  }
  return payload as T;
}

/**
 * Creates a reusable Device Client bound to a single SSO session.
 *
 * @param config - Runtime configuration including the server URL and SSO token.
 * @returns A {@link DeviceClient} exposing per-kind repositories.
 * @throws Error when the native module is unavailable, or
 *   `DEVICE_CLIENT_MISSING_CONFIG` when required fields are missing.
 *
 * @example
 * ```ts
 * const client = createDeviceClient({
 *   serverUrl: 'https://openam.example.com/am',
 *   ssoToken: session.value,
 *   realm: 'alpha',
 * });
 * const devices = await client.oath.get();
 * ```
 */
export function createDeviceClient(config: DeviceClientConfig): DeviceClient {
  if (
    !config.serverUrl ||
    !config.ssoToken ||
    !config.realm ||
    !config.cookieName
  ) {
    throw new Error(
      '[@ping-identity/rn-device-client] createDeviceClient requires `serverUrl`, `ssoToken`, `realm`, and `cookieName`.',
    );
  }

  const logger = config.logger ?? noopLogger;
  const nativeConfig = {
    serverUrl: config.serverUrl,
    ssoToken: config.ssoToken,
    realm: config.realm,
    cookieName: config.cookieName,
    loggerId: logger.nativeHandle?.id?.trim() || undefined,
  };

  const native = getNativeModule();

  /** Cached promise for the native handle id. Lazily initialised on first operation. */
  let handlePromise: Promise<string> | null = null;

  /** Guard flag; once `true`, all operations reject immediately. */
  let disposed = false;

  /**
   * Lazily creates the native handle and caches the promise.
   *
   * @returns A promise resolving to the native handle id string.
   * @throws Error when the client has already been disposed.
   * @throws DeviceClientError when native `create` fails (e.g. missing config).
   */
  const ensureHandle = (): Promise<string> => {
    if (disposed) {
      return Promise.reject(
        new Error(
          '[@ping-identity/rn-device-client] This client has been disposed.',
        ),
      );
    }
    if (!handlePromise) {
      handlePromise = native.create(nativeConfig).catch((error) => {
        handlePromise = null;
        throw error;
      });
    }
    return handlePromise;
  };

  /**
   * Builds a {@link DeviceRepository} for the given device kind.
   *
   * @typeParam K - The device kind this repository manages.
   * @param kind - The {@link DeviceKind} string.
   * @returns A repository with `get`, `update`, and `delete` methods.
   */
  const repo = <K extends DeviceKind>(
    kind: K,
  ): DeviceRepository<DeviceOf<K>> => ({
    async get() {
      logger.debug(`DeviceClient.${kind}.get requested`);
      const handle = await ensureHandle();
      const payload = await native.get(handle, kind);
      return extractArray<DeviceOf<K>>(payload);
    },
    async update(device) {
      logger.debug(`DeviceClient.${kind}.update requested`);
      const handle = await ensureHandle();
      const payload = await native.update(
        handle,
        kind,
        device as unknown as object,
      );
      return extractObject<DeviceOf<K>>(payload);
    },
    async delete(device) {
      logger.debug(`DeviceClient.${kind}.delete requested`);
      const handle = await ensureHandle();
      await native.deleteDevice(handle, kind, device as unknown as object);
    },
  });

  return {
    oath: repo('oath'),
    push: repo('push'),
    bound: repo('bound'),
    profile: repo('profile'),
    webAuthn: repo('webAuthn'),
    async dispose() {
      if (disposed || !handlePromise) {
        disposed = true;
        return;
      }
      disposed = true;
      try {
        const handle = await handlePromise;
        await native.dispose(handle);
      } finally {
        handlePromise = null;
      }
    },
  };
}
