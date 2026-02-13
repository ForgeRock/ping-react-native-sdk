import { journey } from '@ping-identity/rn-journey';
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

const journeyConfig2 = { // This config looks wrong. Revisit TBD
  serverUrl: 'https://openam-sdks.forgeblocks.com/am',
  realm: 'alpha',
  cookie: '5421aeddf91aa20',
  clientId: 'test-oidc',
  discoveryEndpoint:
    'https://openam-sdks.forgeblocks.com/am/oauth2/alpha/.well-known/openid-configuration',
  redirectUri: 'org.forgerock.demo://oauth2redirect',
  scopes: ['openid', 'email', 'profile', 'address'],
};

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

const journeySessionStorageClient2 = configureSessionStorage({
  android: {
    fileName: 'journey_client_two_session_store',
    keyAlias: 'journey.client.two.session',
    cacheStrategy: CacheStrategy.NO_CACHE,
  },
  ios: {
    account: 'com.pingidentity.rnsampleapp.journey.client.two',
    encryptor: true,
    cacheable: false,
  },
});

export const loginClient = journey(
  journeyConfig,
  {
    session: {
      storage: journeySessionStorageClient1,
    },
  }
);

export const loginClient2 = journey(
  journeyConfig2,
  {
    session: {
      storage: journeySessionStorageClient2,
    },
  }
);
