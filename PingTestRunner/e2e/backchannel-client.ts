/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Gateway simulation for AM/AIC transactional backchannel E2E tests.
 *
 * Mirrors the native QA harness (ping-android-sdk
 * `BackchannelAuthenticationE2ETest.initializeBackchannelTransaction`):
 * 1. Obtain a gateway access token via the OAuth2 client-credentials grant
 *    (client `backchannelClientId` / `backchannelClientSecret`, scope
 *    `back_channel_authentication`).
 * 2. Call AM's `/authenticate/backchannel/initialize` with that token to get
 *    a `redirectUri`.
 * 3. The caller hands that `redirectUri` to `client.startBackchannel(...)`,
 *    exactly as an app would after receiving it from a real gateway.
 */

/** Credentials + endpoint config for the gateway simulation. */
export type BackchannelConfig = {
  /** Tenant base URL, e.g. `https://openam-sdks.forgeblocks.com/am`. */
  serverUrl: string;
  /** Realm path without leading slash, e.g. `alpha`. */
  realm: string;
  /** OAuth2 client with the `back_channel_authentication` scope. */
  clientId: string;
  /** Client secret for `clientId`. */
  clientSecret: string;
  /** Journey/tree name to run transactionally. */
  journeyName: string;
  /** Username the transaction is bound to. */
  username: string;
};

/** Reads backchannel gateway config from the environment. */
export function backchannelConfigFromEnv(): BackchannelConfig | null {
  const serverUrl = process.env['PING_SERVER_URL'] ?? '';
  const realm = (process.env['PING_REALM_PATH'] ?? 'alpha').replace(/^\//, '');
  const clientId = process.env['PING_BACKCHANNEL_CLIENT_ID'] ?? '';
  const clientSecret = process.env['PING_BACKCHANNEL_CLIENT_SECRET'] ?? '';
  const journeyName =
    process.env['PING_BACKCHANNEL_JOURNEY_NAME'] ??
    'back-channel-authentication';
  const username = process.env['PING_TEST_USERNAME'] ?? '';

  if (!serverUrl || !clientId || !clientSecret || !username) {
    return null;
  }
  return { serverUrl, realm, clientId, clientSecret, journeyName, username };
}

/**
 * Result of a backchannel initialize call.
 *
 * - nodeType: AM-side classification of the response (informational).
 * - redirectUri: the gateway-provided URI for `startBackchannel`.
 */
export type InitializedTransaction = {
  redirectUri: string;
};

/**
 * Obtains a gateway access token via the client-credentials grant.
 *
 * - Parameters:
 *   - config: Backchannel gateway config.
 * - Returns: OAuth2 access token with the `back_channel_authentication` scope.
 */
async function obtainGatewayAccessToken(
  config: BackchannelConfig,
): Promise<string> {
  const url = `${config.serverUrl}/oauth2/${config.realm}/access_token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'back_channel_authentication',
  });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const payload = (await response.json()) as {
    access_token?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(
      `access_token call failed: HTTP ${response.status} (no access_token in response)`,
    );
  }
  return payload.access_token;
}

/**
 * Simulates the federation gateway: gets a client-credentials access token,
 * then calls `/authenticate/backchannel/initialize` for the configured tree
 * and username, returning the `redirectUri` from the response.
 *
 * - Parameters:
 *   - config: Backchannel gateway config.
 *   - allowRetry: Forwarded to AM as-is (default `true`); `false` makes the
 *     first failed attempt deny the transaction.
 * - Returns: The gateway-provided `redirectUri`.
 */
export async function initializeBackchannelTransaction(
  config: BackchannelConfig,
  allowRetry = true,
): Promise<InitializedTransaction> {
  const accessToken = await obtainGatewayAccessToken(config);

  const url =
    `${config.serverUrl}/json/realms/root/realms/${config.realm}` +
    `/authenticate/backchannel/initialize`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Accept-API-Version': 'resource=1, protocol=2.0',
    },
    body: JSON.stringify({
      type: 'service',
      value: config.journeyName,
      data: { username: config.username },
      allowRetry,
    }),
  });
  const payload = (await response.json()) as { redirectUri?: string };
  if (!response.ok || !payload.redirectUri) {
    throw new Error(
      `backchannel/initialize call failed: HTTP ${response.status} (response missing 'redirectUri')`,
    );
  }
  return { redirectUri: payload.redirectUri };
}
