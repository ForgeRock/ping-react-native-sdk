import { createJourneyClient } from '@ping-identity/rn-journey';
import { createOidcClient } from '@ping-identity/rn-oidc';
import { logger } from '@react-native-pingidentity/logger';
import { CacheStrategy, configureSessionStorage } from '@react-native-pingidentity/storage';

export const journeyConfig = {
  serverUrl: 'https://openam-sdks.forgeblocks.com/am',
  realm: 'alpha',
  cookie: '5421aeddf91aa20',
  clientId: 'sdkPublicClient',
  discoveryEndpoint:
    'https://openam-sdks.forgeblocks.com/am/oauth2/alpha/.well-known/openid-configuration',
  redirectUri: 'org.forgerock.demo://oauth2redirect',
  scopes: ['openid', 'email', 'profile', 'address'],
};

// PingAdvancedIdentityCloud example config
export const pingAdvancedIdentityCloudConfig = {
  // Server
  serverUrl: 'https://openam-sdks.forgeblocks.com/am',
  realm: 'alpha',
  cookie: '5421aeddf91aa20',

  // OAuth / OIDC
  clientId: 'gaurav-oidc',
  redirectUri: 'org.forgerock.demo://oauth2redirect',
  scopes: ['openid', 'profile', 'email', 'address', 'phone'],
  discoveryEndpoint:
    'https://openam-sdks.forgeblocks.com/am/oauth2/alpha/.well-known/openid-configuration',

  // Journey service names (used by Journey module)
  authServiceName: 'Login',
  registrationServiceName: 'Registration',
} as const;

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

const appLogger = logger({ level: 'none' });

export const journeyOidcClient = createOidcClient({
  clientId: journeyConfig.clientId,
  discoveryEndpoint: journeyConfig.discoveryEndpoint,
  redirectUri: journeyConfig.redirectUri,
  scopes: journeyConfig.scopes,
});

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
