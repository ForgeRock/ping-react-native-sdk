/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { DeviceEventEmitter } from 'react-native';
import {
  registerDeviceClientLogger,
  removeDeviceClientLogger,
} from './deviceOpenVerificationUrl';
import { getNativeModule } from './NativeRNPingOidc';
import type {
  OidcAuthorizeOptions,
  OidcAuthorizeResult,
  OidcClient,
  OidcClientConfig,
  OidcDeviceClient,
  OidcDeviceFlowStatus,
  OidcDeviceUser,
  OidcUser,
  OidcWebClient,
} from './types';
import { OidcError } from './types';
import type { LoggerInstance, Tokens } from '@ping-identity/rn-types';

// TODO(SDKS-separate-ticket): noopLogger is duplicated — blocked on Jest ESM transform issue
// with @forgerock/sdk-types when rn-types is re-imported after jest.resetModules().
const noopLogger = {
  nativeHandle: { id: '' },
  changeLevel: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};
export { OidcProvider, useOidc } from './useOidc';
export type {
  OidcHookActions,
  OidcHookResult,
  OidcHookState,
  OidcProviderProps,
} from './useOidc';
export {
  DeviceAuthGrantProvider,
  useDeviceAuthGrant,
} from './useDeviceAuthGrant';
export type {
  DeviceAuthGrantHookActions,
  DeviceAuthGrantHookResult,
  DeviceAuthGrantHookState,
  DeviceAuthGrantProviderProps,
  OidcDeviceTokenSet,
} from './useDeviceAuthGrant';

/**
 * In-memory registry mapping native client ids to JS logger instances.
 */
const loggerRegistry = new Map<string, LoggerInstance>();

/**
 * Strip internal token expiry fields before returning tokens to consumers.
 */
const sanitizeTokens = (
  tokens: { tokenExpiry?: number } & Omit<Tokens, never>,
): Omit<Tokens, 'tokenExpiry'> => {
  const { tokenExpiry: _tokenExpiry, ...rest } = tokens;
  return rest;
};

/**
 * Create a native-backed OIDC client.
 *
 * @remarks
 * If you configured storage with `configureOidcStorage`, pass the returned
 * configuration in `config.storage` to bind the native token storage.
 *
 * @param config OIDC client configuration payload.
 * @returns OIDC client handle that wraps the native instance.
 * @throws Error when required configuration is missing or invalid.
 */
export function createOidcClient(config: OidcClientConfig): OidcClient {
  if (!config.discoveryEndpoint && !config.openId) {
    throw new OidcError(
      '[@ping-identity/rn-oidc] Missing configuration. Provide discoveryEndpoint or openId.',
      'OIDC_STATE_ERROR',
      'state_error',
    );
  }
  const jsLogger = config.logger ?? noopLogger;
  const rawLoggerId = jsLogger.nativeHandle?.id;
  const loggerId = rawLoggerId?.trim() ? rawLoggerId : undefined;
  jsLogger.debug(
    `OIDC createClient config ${JSON.stringify(
      config,
      (_key, value) => (typeof value === 'function' ? undefined : value),
      2,
    )}`,
  );
  // Ignore legacy signOutRedirectUri values if callers pass them via `any`.
  const { signOutRedirectUri: _ignoredSignOutRedirectUri, ...nativeConfig } =
    config as OidcClientConfig & { signOutRedirectUri?: string };
  const clientId = getNativeModule().createClient({
    ...nativeConfig,
    storageId: resolveStorageId(config.storage),
    loggerId,
  });
  loggerRegistry.set(clientId, jsLogger);
  jsLogger.info('OIDC createClient success');
  return {
    id: clientId,
    token: async () => {
      jsLogger.debug('OIDC client token requested');
      try {
        const tokens = await getNativeModule().clientToken(clientId);
        return sanitizeTokens(tokens as Tokens & { tokenExpiry?: number });
      } catch (error) {
        jsLogger.error('OIDC client token failed');
        throw OidcError.from(error);
      }
    },
    refresh: async () => {
      jsLogger.debug('OIDC client refresh requested');
      try {
        const tokens = await getNativeModule().clientRefresh(clientId);
        return sanitizeTokens(tokens as Tokens & { tokenExpiry?: number });
      } catch (error) {
        jsLogger.error('OIDC client refresh failed');
        throw OidcError.from(error);
      }
    },
    userinfo: async (cache?: boolean) => {
      jsLogger.debug(
        `OIDC client userinfo requested ${JSON.stringify({
          cache: cache ?? false,
        })}`,
      );
      try {
        return await getNativeModule().clientUserinfo(clientId, cache ?? false);
      } catch (error) {
        jsLogger.error('OIDC client userinfo failed');
        throw OidcError.from(error);
      }
    },
    revoke: async () => {
      jsLogger.info('OIDC client revoke requested');
      try {
        return await getNativeModule().clientRevoke(clientId);
      } catch (error) {
        jsLogger.error('OIDC client revoke failed');
        throw OidcError.from(error);
      }
    },
    endSession: async () => {
      jsLogger.info('OIDC client endSession requested');
      try {
        return await getNativeModule().clientEndSession(clientId);
      } catch (error) {
        jsLogger.error('OIDC client endSession failed');
        throw OidcError.from(error);
      }
    },
    dispose: async () => {
      jsLogger.debug('OIDC client dispose requested');
      loggerRegistry.delete(clientId);
      try {
        await getNativeModule().disposeClient(clientId);
      } catch (error) {
        jsLogger.warn(`OIDC client dispose failed: ${error}`);
      }
    },
  };
}

const DEVICE_FLOW_STATUS_EVENT = 'RNPingOidc_DeviceFlowStatus';

type NativeDeviceFlowEvent = {
  deviceClientId: string;
  subscriptionId: string;
  status: OidcDeviceFlowStatus;
};

/**
 * Create an OIDC device-authorization client.
 *
 * @param config OIDC configuration shared with the regular OIDC client.
 * @returns OIDC device client handle.
 * @throws OidcError when configuration or native setup is invalid.
 * @example
 * ```ts
 * const client = createOidcDeviceClient(config);
 * const stop = await client.authorize(status => {
 *   if (status.type === 'started') console.log(status.response.userCode);
 * });
 * ```
 * @public
 */
export function createOidcDeviceClient(
  config: OidcClientConfig,
): OidcDeviceClient {
  if (!config.discoveryEndpoint && !config.openId) {
    throw new OidcError(
      '[@ping-identity/rn-oidc] Missing configuration. Provide discoveryEndpoint or openId.',
      'OIDC_STATE_ERROR',
      'state_error',
    );
  }

  const jsLogger = config.logger ?? noopLogger;
  const rawLoggerId = jsLogger.nativeHandle?.id;
  const loggerId = rawLoggerId?.trim() ? rawLoggerId : undefined;
  const { signOutRedirectUri: _ignoredSignOutRedirectUri, ...nativeConfig } =
    config as OidcClientConfig & { signOutRedirectUri?: string };
  const native = getNativeModule();
  const deviceClientId = native.createOidcDeviceClient({
    ...nativeConfig,
    storageId: resolveStorageId(config.storage),
    loggerId,
  });
  loggerRegistry.set(deviceClientId, jsLogger);
  registerDeviceClientLogger(deviceClientId, jsLogger);

  let disposed = false;
  let activeStop: (() => void) | undefined;

  const createUser = (): OidcDeviceUser => ({
    token: async () => {
      try {
        return sanitizeTokens(await native.deviceToken(deviceClientId));
      } catch (error) {
        throw OidcError.from(error);
      }
    },
    refresh: async () => {
      try {
        return sanitizeTokens(await native.deviceRefresh(deviceClientId));
      } catch (error) {
        throw OidcError.from(error);
      }
    },
    userinfo: async (cache?: boolean) => {
      try {
        return await native.deviceUserinfo(deviceClientId, cache ?? false);
      } catch (error) {
        throw OidcError.from(error);
      }
    },
    revoke: async () => {
      try {
        await native.deviceRevoke(deviceClientId);
      } catch (error) {
        throw OidcError.from(error);
      }
    },
    logout: async () => {
      try {
        await native.deviceLogout(deviceClientId);
      } catch (error) {
        throw OidcError.from(error);
      }
    },
  });

  return {
    id: deviceClientId,
    authorize: async (onStatus) => {
      if (disposed) {
        throw new OidcError(
          'OIDC device client has been disposed.',
          'OIDC_STATE_ERROR',
          'state_error',
        );
      }
      if (activeStop) {
        throw new OidcError(
          'OIDC device authorization is already active.',
          'OIDC_STATE_ERROR',
          'state_error',
        );
      }

      let nativeSubscriptionId: string | undefined;
      let stopped = false;
      const buffered: NativeDeviceFlowEvent[] = [];
      const listener = DeviceEventEmitter.addListener(
        DEVICE_FLOW_STATUS_EVENT,
        (event: NativeDeviceFlowEvent) => {
          if (event?.deviceClientId !== deviceClientId || stopped) return;
          if (!nativeSubscriptionId) {
            buffered.push(event);
            return;
          }
          if (event.subscriptionId !== nativeSubscriptionId) return;
          onStatus(event.status);
          if (
            event.status.type === 'success' ||
            event.status.type === 'expired' ||
            event.status.type === 'accessDenied' ||
            event.status.type === 'failure'
          ) {
            listener.remove();
            activeStop = undefined;
          }
        },
      );

      const stop = (): void => {
        if (stopped) return;
        stopped = true;
        listener.remove();
        activeStop = undefined;
        if (nativeSubscriptionId) {
          void native.cancelDeviceAuthorization(
            deviceClientId,
            nativeSubscriptionId,
          );
        }
      };
      activeStop = stop;

      try {
        const result = await native.deviceAuthorize(deviceClientId);
        nativeSubscriptionId = result.subscriptionId;
        for (const event of buffered.splice(0)) {
          if (event.subscriptionId === nativeSubscriptionId && !stopped) {
            onStatus(event.status);
            if (
              event.status.type === 'success' ||
              event.status.type === 'expired' ||
              event.status.type === 'accessDenied' ||
              event.status.type === 'failure'
            ) {
              listener.remove();
              activeStop = undefined;
            }
          }
        }
        return stop;
      } catch (error) {
        stop();
        throw OidcError.from(error);
      }
    },
    user: async () => {
      if (disposed) return null;
      try {
        return (await native.deviceHasUser(deviceClientId))
          ? createUser()
          : null;
      } catch (error) {
        throw OidcError.from(error);
      }
    },
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      activeStop?.();
      loggerRegistry.delete(deviceClientId);
      removeDeviceClientLogger(deviceClientId);
      try {
        await native.disposeOidcDeviceClient(deviceClientId);
      } catch (error) {
        throw OidcError.from(error);
      }
    },
  };
}

/**
 * Open a device authorization verification URL in the on-device browser.
 *
 * @remarks
 * Mirrors the native SDK's device-client browser launch: iOS presents the URL
 * in an `SFSafariViewController`, Android launches a Custom/Auth Tab. The
 * device authorization polling loop (started with
 * {@link OidcDeviceClient.authorize}) keeps running while the browser is
 * open, so completing or dismissing the browser does not stop the flow.
 * Dismissing the browser resolves to `{ type: 'cancel' }`; it does not
 * cancel the underlying authorization.
 *
 * @param client Device client handle returned by {@link createOidcDeviceClient}.
 * @param verificationUri Verification URI (prefer `verificationUriComplete`
 * from the `started` status so the user code is prefilled).
 * @returns `{ type: 'success' }` when the browser flow completed, or
 * `{ type: 'cancel' }` when the user dismissed the browser.
 * @throws OidcError with `state_error` when the client has been disposed, or
 * with `argument_error` when `verificationUri` is blank.
 * @throws OidcError when the native browser launch fails (for example an
 * invalid URL or a missing `redirectUri` scheme on iOS).
 * @example
 * ```ts
 * const client = createOidcDeviceClient(config);
 * const stop = await client.authorize(status => {
 *   if (status.type === 'started' && status.response.verificationUriComplete) {
 *     void deviceOpenVerificationUrl(client, status.response.verificationUriComplete);
 *   }
 * });
 * ```
 */
export { deviceOpenVerificationUrl } from './deviceOpenVerificationUrl';

/**
 * Resolve a storage id from a configured storage handle.
 *
 * @throws Error when a storage object is provided without a valid OIDC handle.
 */
function resolveStorageId(
  value?: OidcClientConfig['storage'],
): string | undefined {
  if (!value) {
    return undefined;
  }
  const handle = value as {
    id?: unknown;
    kind?: unknown;
  };

  if (
    typeof handle.id !== 'string' ||
    !handle.id.trim() ||
    handle.kind !== 'oidc'
  ) {
    throw new OidcError(
      '[@ping-identity/rn-oidc] Invalid storage handle. ' +
        'Use configureOidcStorage(...) from @ping-identity/rn-storage.',
      'OIDC_STATE_ERROR',
      'state_error',
    );
  }
  return handle.id;
}

/**
 * Create a web-capable OIDC client from an existing OIDC client handle.
 *
 * @param client Native OIDC client handle returned by {@link createOidcClient}.
 * @returns Web client handle for browser-based authorization.
 */
export function createOidcWebClient(client: OidcClient): OidcWebClient {
  const loggerInstance = loggerRegistry.get(client.id) ?? noopLogger;
  loggerInstance.debug('OIDC createWebClient requested');
  const webClientId = getNativeModule().createWebClient(client.id);
  loggerInstance.info('OIDC createWebClient success');

  const user: OidcUser = {
    token: async () => {
      loggerInstance.debug('OIDC user token requested');
      try {
        const tokens = await getNativeModule().token(webClientId);
        return sanitizeTokens(tokens as Tokens & { tokenExpiry?: number });
      } catch (error) {
        loggerInstance.error('OIDC user token failed');
        throw OidcError.from(error);
      }
    },
    refresh: async () => {
      loggerInstance.debug('OIDC user refresh requested');
      try {
        const tokens = await getNativeModule().refresh(webClientId);
        return sanitizeTokens(tokens as Tokens & { tokenExpiry?: number });
      } catch (error) {
        loggerInstance.error('OIDC user refresh failed');
        throw OidcError.from(error);
      }
    },
    userinfo: async (cache?: boolean) => {
      loggerInstance.debug(
        `OIDC user userinfo requested ${JSON.stringify({
          cache: cache ?? false,
        })}`,
      );
      try {
        return await getNativeModule().userinfo(webClientId, cache ?? false);
      } catch (error) {
        loggerInstance.error('OIDC user userinfo failed');
        throw OidcError.from(error);
      }
    },
    revoke: async () => {
      loggerInstance.info('OIDC user revoke requested');
      try {
        return await getNativeModule().revoke(webClientId);
      } catch (error) {
        loggerInstance.error('OIDC user revoke failed');
        throw OidcError.from(error);
      }
    },
    logout: async () => {
      loggerInstance.info('OIDC user logout requested');
      try {
        return await getNativeModule().logout(webClientId);
      } catch (error) {
        loggerInstance.error('OIDC user logout failed');
        throw OidcError.from(error);
      }
    },
  };

  return {
    id: webClientId,
    authorize: async (
      options?: OidcAuthorizeOptions,
    ): Promise<OidcAuthorizeResult> => {
      loggerInstance.info('OIDC authorize requested');
      loggerInstance.debug(
        `OIDC authorize options ${JSON.stringify(options ?? {})}`,
      );
      try {
        return await getNativeModule().authorize(webClientId, options ?? {});
      } catch (error) {
        loggerInstance.error('OIDC authorize failed');
        throw OidcError.from(error);
      }
    },
    user: async () => {
      loggerInstance.debug('OIDC user resolve requested');
      let hasUser: boolean;
      try {
        hasUser = await getNativeModule().hasUser(webClientId);
      } catch (error) {
        loggerInstance.error('OIDC hasUser failed');
        throw OidcError.from(error);
      }
      if (hasUser) {
        loggerInstance.debug('OIDC hasUser true');
        return user;
      }
      loggerInstance.debug('OIDC hasUser false');
      return null;
    },
    dispose: async () => {
      loggerInstance.debug('OIDC web client dispose requested');
      // loggerRegistry is intentionally not cleaned up here — the logger belongs to the
      // base OidcClient, not the web client. Call OidcClient.dispose() to release it.
      try {
        await getNativeModule().disposeWebClient(webClientId);
      } catch (error) {
        loggerInstance.warn(`OIDC web client dispose failed: ${error}`);
      }
    },
  };
}

export { OidcError } from './types';
export type {
  OidcAuthorizeOptions,
  OidcAuthorizeResult,
  OidcClient,
  OidcClientConfig,
  OidcOpenIdConfiguration,
  OidcErrorCode,
  OidcDeviceAuthorizationResponse,
  OidcDeviceClient,
  OidcDeviceFlowStatus,
  OidcDeviceUser,
  OidcUser,
  OidcWebClient,
} from './types';
