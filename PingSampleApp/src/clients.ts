import { journey } from "@react-native-pingidentity/journey";

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

journey(journeyConfig)

export const loginClient = journey(
  journeyConfig,
);

export const loginClient2 = journey(
  journeyConfig2, 
);

