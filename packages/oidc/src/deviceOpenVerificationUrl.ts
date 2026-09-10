/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { getNativeModule } from './NativeRNPingOidc';
import type { OidcAuthorizeResult, OidcDeviceClient } from './types';
import { OidcError } from './types';
import type { LoggerInstance } from '@ping-identity/rn-types';

/**
 * Fallback logger for clients created without an explicit logger instance.
 *
 * @remarks
 * Mirrors the shape used by the main facade; kept local so this module does
 * not import the package barrel (which would create a require cycle with
 * `useDeviceAuthGrant`).
 */
const noopLogger = {
  nativeHandle: { id: '' },
  changeLevel: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

/**
 * Registry mapping native client ids to JS logger instances.
 *
 * @remarks
 * Shared with the main facade via `registerClientLogger` so both modules log
 * with the same instance the client was created with.
 */
const loggerRegistry = new Map<string, LoggerInstance>();

/**
 * Associate a JS logger with a device client id for logging in
 * {@link deviceOpenVerificationUrl}.
 *
 * @param id Native device client id.
 * @param logger Logger instance from `createOidcDeviceClient`.
 */
export function registerDeviceClientLogger(
  clientId: string,
  logger: LoggerInstance,
): void {
  loggerRegistry.set(clientId, logger);
}

/**
 * Remove the logger association for a device client id when it is disposed.
 *
 * @param clientId Native device client id.
 */
export function removeDeviceClientLogger(clientId: string): void {
  loggerRegistry.delete(clientId);
}

/**
 * Open a device authorization verification URL in the on-device browser.
 *
 * @remarks
 * Mirrors the native SDK's device-client browser launch: iOS presents the URL
 * in an `SFSafariViewController`, Android launches a Custom Tab / Auth Tab.
 * The device authorization polling loop (started with
 * `OidcDeviceClient.authorize`) keeps running while the browser is open, so
 * completing or dismissing the browser does not stop the flow. Dismissing the
 * browser resolves to `{ type: 'cancel' }`; it does not cancel the underlying
 * authorization.
 *
 * @param client Device client handle returned by `createOidcDeviceClient`.
 * @param verificationUri Verification URI (prefer `verificationUriComplete`
 * from the `started` status so the user code is prefilled).
 * @returns `{ type: 'success' }` when the browser flow completed, or
 * `{ type: 'cancel' }` when the user dismissed the browser.
 * @throws OidcError with `argument_error` when `verificationUri` is blank, or
 * with `state_error` when the client has been disposed.
 * @throws OidcError when the native browser launch fails (for example an
 * invalid URL or a missing `redirectUri` scheme on iOS).
 */
export async function deviceOpenVerificationUrl(
  client: OidcDeviceClient,
  verificationUri: string,
): Promise<OidcAuthorizeResult> {
  const jsLogger = loggerRegistry.get(client.id) ?? noopLogger;
  jsLogger.debug('OIDC device openVerificationUrl requested');
  if (!verificationUri.trim()) {
    throw new OidcError(
      '[@ping-identity/rn-oidc] verificationUri is required to open the device verification URL.',
      'OIDC_ARGUMENT_ERROR',
      'argument_error',
    );
  }
  try {
    const result = await getNativeModule().deviceOpenVerificationUrl(
      client.id,
      verificationUri,
    );
    jsLogger.info(`OIDC device openVerificationUrl ${result.type}`);
    return result;
  } catch (error) {
    jsLogger.error('OIDC device openVerificationUrl failed');
    throw OidcError.from(error);
  }
}
