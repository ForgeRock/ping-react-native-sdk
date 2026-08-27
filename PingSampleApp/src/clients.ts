/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { createJourneyClient } from '@ping-identity/rn-journey';
import {
  createOidcClient,
  createOidcWebClient,
  type OidcClientConfig,
  type OidcWebClient,
} from '@ping-identity/rn-oidc';
import type { JourneyClient } from '@ping-identity/rn-journey';
import { createDaVinciClient } from '@ping-identity/rn-davinci';
import type { DaVinciClient, DaVinciConfig } from '@ping-identity/rn-davinci';
import Config from 'react-native-config';

import { logger } from '@ping-identity/rn-logger';
import {
  CacheStrategy,
  configureOidcStorage,
  configureSessionStorage,
} from '@ping-identity/rn-storage';

/**
 * Normalized Journey OAuth scopes sourced from `JOURNEY_SCOPES`.
 */
const journeyScopes = (Config.JOURNEY_SCOPES ?? '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

/**
 * Normalized Advanced Identity Cloud OAuth scopes sourced from `AIC_SCOPES`.
 */
const aicScopes = (Config.AIC_SCOPES ?? '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

/**
 * Normalized PingOne OAuth scopes sourced from `PINGONE_SCOPES`.
 */
const pingOneScopes = (Config.PINGONE_SCOPES ?? '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

/**
 * Base Journey module configuration resolved directly from environment
 * variables.
 */
export const journeyConfig = {
  serverUrl: Config.JOURNEY_SERVER_URL!,
  realm: Config.JOURNEY_REALM!,
  cookie: Config.JOURNEY_COOKIE!,
  clientId: Config.JOURNEY_CLIENT_ID!,
  discoveryEndpoint: Config.JOURNEY_DISCOVERY_ENDPOINT!,
  redirectUri: Config.JOURNEY_REDIRECT_URI!,
  scopes: journeyScopes,
};

/**
 * Base Advanced Identity Cloud configuration resolved from environment
 * variables.
 */
export const pingAdvancedIdentityCloudConfig = {
  // Server
  serverUrl: Config.AIC_SERVER_URL!,
  realm: Config.AIC_REALM!,
  cookie: Config.AIC_COOKIE!,

  // OAuth / OIDC
  clientId: Config.AIC_CLIENT_ID!,
  redirectUri: Config.AIC_REDIRECT_URI!,
  scopes: aicScopes,
  discoveryEndpoint: Config.AIC_DISCOVERY_ENDPOINT!,

  // Journey service names (used by Journey module)
  authServiceName: Config.AIC_AUTH_SERVICE_NAME!,
  registrationServiceName: Config.AIC_REGISTRATION_SERVICE_NAME!,
} as const;

/**
 * Session storage handle used by the Journey client module.
 */
const journeySessionStorageClient1 = configureSessionStorage({
  android: {
    fileName: 'journey_client_one_session_store',
    keyAlias: 'journey.client.one.session',
    cacheStrategy: CacheStrategy.NO_CACHE,
  },
  ios: {
    account: 'com.pingidentity.rnsampleapp.journey.client.one',
    encryptor: true,
    cacheable: false,
  },
});

/**
 * Shared logger instance used by sample clients.
 */
const appLogger = logger({ level: 'debug' });

/**
 * OIDC client used by Journey module wiring.
 *
 * This client is created from Journey-specific env values and is intended for
 * Journey module interoperability scenarios.
 */
export const journeyOidcClient = createOidcClient({
  clientId: journeyConfig.clientId,
  discoveryEndpoint: journeyConfig.discoveryEndpoint,
  redirectUri: journeyConfig.redirectUri,
  scopes: journeyConfig.scopes,
});

/**
 * OIDC web client derived from Journey environment settings.
 */
export const journeyOidcWebClient: OidcWebClient =
  createOidcWebClient(journeyOidcClient);

/**
 * OIDC storage handle dedicated to sample OIDC screens that should stay
 * isolated from Journey-module OIDC state.
 */
const journeyStandaloneOidcStorage = configureOidcStorage({
  android: {
    fileName: 'journey-standalone-oidc',
    keyAlias: 'journey.standalone.oidc',
    strongBoxPreferred: true,
    cacheStrategy: CacheStrategy.CACHE_ON_FAILURE,
  },
  ios: {
    account: 'com.pingidentity.rnsampleapp.journey.standalone.oidc',
    encryptor: true,
    cacheable: true,
  },
});

/**
 * Standalone OIDC client for Forgeblock OIDC demo flows.
 *
 * This client intentionally uses dedicated storage to keep OIDC demo state
 * separate from Journey-module OIDC state.
 */
const journeyStandaloneOidcClient = createOidcClient({
  clientId: journeyConfig.clientId,
  discoveryEndpoint: journeyConfig.discoveryEndpoint,
  redirectUri: journeyConfig.redirectUri,
  scopes: journeyConfig.scopes,
  storage: journeyStandaloneOidcStorage,
  logger: appLogger,
});

/**
 * Web-capable wrapper around the standalone Journey OIDC client.
 */
export const journeyStandaloneOidcWebClient: OidcWebClient =
  createOidcWebClient(journeyStandaloneOidcClient);

/**
 * OIDC client configuration used to create the sample web-capable OIDC client.
 */
export const sampleOidcClientConfig: OidcClientConfig = {
  clientId: pingAdvancedIdentityCloudConfig.clientId,
  discoveryEndpoint: pingAdvancedIdentityCloudConfig.discoveryEndpoint,
  redirectUri: pingAdvancedIdentityCloudConfig.redirectUri,
  scopes: [...pingAdvancedIdentityCloudConfig.scopes],
  ios: {
    browserType: 'authSession',
    browserMode: 'login',
  },
};

/**
 * PingOne OIDC client configuration mirrored from SDK test configuration.
 *
 * @remarks
 * Intended for local interoperability validation against the PingOne test
 * tenant used by SDK tests.
 */
const pingOneOidcClientConfig: OidcClientConfig = {
  clientId: Config.PINGONE_CLIENT_ID!,
  discoveryEndpoint: Config.PINGONE_DISCOVERY_ENDPOINT!,
  redirectUri: Config.PINGONE_REDIRECT_URI!,
  scopes: pingOneScopes,
  acrValues: Config.PINGONE_ACR_VALUES!,
  ios: {
    browserType: 'authSession',
    browserMode: 'login',
  },
};

/**
 * OIDC storage handle used by the sample OIDC client.
 */
const sampleOidcStorage = configureOidcStorage({
  android: {
    fileName: 'ping-oidc',
    keyAlias: 'ping-oidc',
    strongBoxPreferred: true,
    cacheStrategy: CacheStrategy.CACHE_ON_FAILURE,
  },
  ios: {
    account: 'com.pingidentity.rnsampleapp.oidc',
    encryptor: true,
    cacheable: true,
  },
});

/**
 * Internal OIDC client instance used by `sampleOidcWebClient`.
 *
 * This composes config, secure storage, and logger dependencies into a single
 * native-backed client that can be adapted for web-based auth APIs.
 */
const sampleOidcClient = createOidcClient({
  ...sampleOidcClientConfig,
  storage: sampleOidcStorage,
  logger: appLogger,
});

/**
 * Internal OIDC client instance for PingOne test-tenant validation.
 */
const pingOneOidcClient = createOidcClient({
  ...pingOneOidcClientConfig,
  storage: sampleOidcStorage,
  logger: appLogger,
});

/**
 * Web-capable OIDC client used by sample UI flows.
 *
 * This wrapper exposes browser-driven authorization methods while reusing the
 * same underlying OIDC configuration and token storage behavior.
 */
export const sampleOidcWebClient: OidcWebClient =
  createOidcWebClient(sampleOidcClient);

/**
 * Web-capable OIDC client for the PingOne test tenant profile.
 */
export const pingOneOidcWebClient: OidcWebClient =
  createOidcWebClient(pingOneOidcClient);

/**
 * Journey-only client for validating flows without OIDC module composition.
 *
 * This mirrors native Journey setup where only `serverUrl` is configured.
 */
export const journeyOnlyClient = createJourneyClient({
  serverUrl: journeyConfig.serverUrl,
});

/**
 * Primary Journey client used by the sample app login flows.
 *
 * The client is configured with OIDC and session modules so it can handle
 * end-to-end Journey interactions, including token exchange and persisted
 * session continuity across app restarts.
 */
export const loginClient = createJourneyClient({
  timeout: 10000,
  serverUrl: journeyConfig.serverUrl,
  realm: journeyConfig.realm,
  cookie: journeyConfig.cookie,
  logger: appLogger,
  modules: {
    oidc: {
      clientId: journeyConfig.clientId,
      discoveryEndpoint: journeyConfig.discoveryEndpoint,
      redirectUri: journeyConfig.redirectUri,
      scopes: journeyConfig.scopes,
    },
    session: {
      storage: journeySessionStorageClient1,
    },
  },
});

/**
 * DaVinci storage handle dedicated to the sample DaVinci flow.
 */
const davinciOidcStorage = configureOidcStorage({
  android: {
    fileName: 'rn-sample-davinci',
    keyAlias: 'rn.sample.davinci',
    strongBoxPreferred: true,
    cacheStrategy: CacheStrategy.CACHE_ON_FAILURE,
  },
  ios: {
    account: 'com.pingidentity.rnsampleapp.davinci',
    encryptor: true,
    cacheable: true,
  },
});

/**
 * DaVinci client configuration used to drive the sample DaVinci screen.
 *
 * @remarks
 * Reuses the PingOne OIDC environment variables since DaVinci flows are
 * configured by the PingOne tenant's discovery endpoint.
 */
export const sampleDaVinciConfig: DaVinciConfig = {
  logger: appLogger,
  modules: {
    oidc: {
      clientId: Config.PINGONE_CLIENT_ID!,
      discoveryEndpoint: Config.PINGONE_DISCOVERY_ENDPOINT!,
      redirectUri: Config.PINGONE_REDIRECT_URI!,
      scopes: pingOneScopes,
      acrValues: Config.PINGONE_ACR_VALUES || undefined,
      storage: davinciOidcStorage,
    },
  },
};

/**
 * DaVinci client used by the sample app DaVinci screen.
 */
export const sampleDaVinciClient: DaVinciClient =
  createDaVinciClient(sampleDaVinciConfig);

/**
 * Supported sample app configuration groups.
 */
export type SampleConfigGroup = 'Journey' | 'OIDC (Web)' | 'DaVinci';

/**
 * Runtime-selectable sample app client profile.
 */
export type SampleAppClientProfile = {
  /**
   * Stable profile key used by the configuration selector.
   */
  key: string;
  /**
   * UI group heading for this profile.
   */
  group: SampleConfigGroup;
  /**
   * Human readable profile name.
   */
  name: string;
  /**
   * Display-only host label shown in configuration UI.
   */
  host: string;
  /**
   * Display-only journey/service label shown in configuration UI.
   */
  environment: string;
  /**
   * Journey client bound to the profile.
   */
  journeyClient: JourneyClient;
  /**
   * OIDC web client bound to the profile.
   */
  oidcClient: OidcWebClient;
  /**
   * OIDC client configuration displayed by the OIDC demo panel.
   */
  oidcClientConfig: OidcClientConfig;
  /**
   * Redirect URI used by Journey external IdP integrations.
   */
  externalIdpRedirectUri: string;
};

/**
 * Extracts hostname text from URL-like values for concise UI labels.
 *
 * @param value URL string to parse.
 * @returns Hostname when parsable, otherwise original value.
 */
function hostnameFrom(value: string): string {
  const normalized = value.replace(/^https?:\/\//i, '');
  return normalized.split('/')[0] ?? value;
}

/**
 * Runtime-selectable sample app configurations shown in the Configuration screen.
 */
export const sampleAppClientProfiles: readonly SampleAppClientProfile[] = [
  {
    key: 'journey-default',
    group: 'Journey',
    name: 'Journey Test Config',
    host: hostnameFrom(journeyConfig.serverUrl),
    environment: journeyConfig.realm,
    journeyClient: loginClient,
    oidcClient: sampleOidcWebClient,
    oidcClientConfig: sampleOidcClientConfig,
    externalIdpRedirectUri: journeyConfig.redirectUri,
  },
  {
    key: 'journey-only',
    group: 'Journey',
    name: 'Journey Only',
    host: hostnameFrom(journeyConfig.serverUrl),
    environment: journeyConfig.realm,
    journeyClient: journeyOnlyClient,
    oidcClient: sampleOidcWebClient,
    oidcClientConfig: sampleOidcClientConfig,
    externalIdpRedirectUri: journeyConfig.redirectUri,
  },
  {
    key: 'oidc-forgeblock',
    group: 'OIDC (Web)',
    name: 'OIDC Forgeblock',
    host: hostnameFrom(journeyConfig.discoveryEndpoint),
    environment: journeyConfig.realm,
    journeyClient: loginClient,
    oidcClient: journeyStandaloneOidcWebClient,
    oidcClientConfig: {
      clientId: journeyConfig.clientId,
      discoveryEndpoint: journeyConfig.discoveryEndpoint,
      redirectUri: journeyConfig.redirectUri,
      scopes: [...journeyConfig.scopes],
      ios: {
        browserType: 'authSession',
        browserMode: 'login',
      },
    },
    externalIdpRedirectUri: journeyConfig.redirectUri,
  },
  {
    key: 'oidc-pingone',
    group: 'OIDC (Web)',
    name: 'OIDC PingOne',
    host: hostnameFrom(pingOneOidcClientConfig.discoveryEndpoint ?? ''),
    environment: Config.PINGONE_ENVIRONMENT_LABEL ?? 'PingOne',
    journeyClient: loginClient,
    oidcClient: pingOneOidcWebClient,
    oidcClientConfig: pingOneOidcClientConfig,
    externalIdpRedirectUri: journeyConfig.redirectUri,
  },
];

/**
 * Default selected profile key for sample app boot.
 */
export const DEFAULT_SAMPLE_APP_CLIENT_PROFILE_KEY =
  sampleAppClientProfiles[0].key;
