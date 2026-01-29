import React, { useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { commonStyles } from '../src/styles/common';
import { journeyConfig } from '../src/clients';
import {
  CacheStrategy,
  configureOidcStorage,
  OidcStorage,
} from '@react-native-pingidentity/storage';
import { configureLogger, logger } from '@react-native-pingidentity/logger';
import {
  createOidcClient,
  createOidcWebClient,
  OidcAuthorizeResult,
  OidcError,
  OidcWebClient,
} from '@ping-identity/rn-oidc';

export default function OidcScreen() {
  const webClientRef = useRef<OidcWebClient | null>(null);
  const storageRef = useRef<OidcStorage | null>(null);
  const loggerIdRef = useRef<string | null>(null);
  const log = useMemo(() => logger({ level: 'debug' }), []);
  const [result, setResult] = useState<string>('');
  const [tokens, setTokens] = useState<string>('');
  const [userinfo, setUserinfo] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [hasUser, setHasUser] = useState<boolean | null>(null);
  const [checkingSession, setCheckingSession] = useState<boolean>(false);
  const [loading, setLoading] = useState({
    session: false,
    authorize: false,
    token: false,
    refresh: false,
    userinfo: false,
    revoke: false,
    logout: false,
  });
  const [expanded, setExpanded] = useState({
    config: false,
    session: false,
    result: false,
    tokens: false,
    userinfo: false,
    error: false,
  });

  const toggleSection = (key: keyof typeof expanded) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };


  const renderSection = (
    key: keyof typeof expanded,
    title: string,
    content: string,
    isError?: boolean,
    isLoading?: boolean
  ) => (
    <View style={commonStyles.codeBox}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => toggleSection(key)}>
          <Text style={commonStyles.codeTitle}>
            {expanded[key] ? '▼' : '▶'} {title}
          </Text>
        </TouchableOpacity>
        {!expanded[key] && isLoading ? (
          <ActivityIndicator style={{ marginLeft: 8 }} size="small" />
        ) : null}
      </View>
      {expanded[key] ? (
        <Text style={isError ? commonStyles.textError : commonStyles.codeText}>
          {content}
        </Text>
      ) : null}
    </View>
  );

  const formatOidcError = (
    err: unknown,
    fallbackCode: string,
    fallbackMessage: string
  ) => {
    const errorPayload = err as OidcError;
    const errorDetails = {
      type: errorPayload?.type ?? 'unknown_error',
      error: errorPayload?.error ?? fallbackCode,
      message: errorPayload?.message ?? fallbackMessage,
      code: errorPayload?.code,
      status: errorPayload?.status,
    };
    return JSON.stringify(errorDetails, null, 2);
  };

  const setActionResult = (action: string, payload: Record<string, unknown>) => {
    setResult(JSON.stringify({ action, ...payload }, null, 2));
  };

  const getWebClient = () => {
    if (webClientRef.current) {
      return webClientRef.current;
    }
    const { clientId, discoveryEndpoint, redirectUri, scopes } = journeyConfig;
    const loggerId =
      loggerIdRef.current ?? configureLogger({ level: 'debug' });
    loggerIdRef.current = loggerId;
    const storage =
      storageRef.current ??
      configureOidcStorage({
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
    storageRef.current = storage;
    /*
     * OpenID configuration override example.
     *
     * Provide known OpenID endpoints to skip discovery:
     *
     * const openIdOverride = {
     *   authorizationEndpoint: 'https://example.com/oauth2/authorize',
     *   tokenEndpoint: 'https://example.com/oauth2/token',
     *   userinfoEndpoint: 'https://example.com/oauth2/userinfo',
     *   endSessionEndpoint: 'https://example.com/oauth2/signoff',
     *   revocationEndpoint: 'https://example.com/oauth2/revoke',
     * };
     */
    const client = createOidcClient({
      clientId,
      discoveryEndpoint,
      redirectUri,
      scopes,
      storage: storage,
      // openId: openIdOverride,
      signOutRedirectUri: `${redirectUri}/logout`,
      state: 'sample-state',
      nonce: 'sample-nonce',
      uiLocales: 'en-US',
      refreshThreshold: 60,
      logger: { id: loggerId },
    });
    const webClient = createOidcWebClient(client);
    webClientRef.current = webClient;
    return webClient;
  };

  const handleAuthorize = async (withOverrides: boolean) => {
    setError('');
    setResult('');
    setTokens('');
    setUserinfo('');
    setHasUser(null);
    setLoading(prev => ({ ...prev, authorize: true }));

    try {
      const webClient = getWebClient();
      setCheckingSession(true);
      const existingSession = await webClient.hasUser();
      setHasUser(existingSession);
      if (existingSession) {
        const user = await webClient.user();
        const resolvedTokens = await user?.token();
        if (resolvedTokens) {
          setTokens(JSON.stringify(resolvedTokens, null, 2));
        }
        setCheckingSession(false);
        setLoading(prev => ({ ...prev, authorize: false }));
        return;
      }
      setCheckingSession(false);

      const outcome: OidcAuthorizeResult = await webClient.authorize(
        withOverrides
          ? {
              acrValues: 'urn:acr:form',
              state: 'sample-state-override',
              nonce: 'sample-nonce-override',
              uiLocales: 'en-US',
              loginHint: 'user@example.com',
              display: 'page',
              prompt: 'login',
              additionalParameters: {
                foo: 'bar',
              },
            }
          : undefined
      );
      let tokenResult: string | null = null;

      if (outcome.type === 'success') {
        const user = await webClient.user();
        const resolvedTokens = await user?.token();
        if (resolvedTokens) {
          tokenResult = JSON.stringify(resolvedTokens, null, 2);
        }
        setHasUser(true);
      }

      setActionResult('authorize', {
        clientId: journeyConfig.clientId,
        webClientId: webClient.id,
        outcome,
        overrides: withOverrides,
      });
      if (tokenResult) {
        setTokens(tokenResult);
      }
      setLoading(prev => ({ ...prev, authorize: false }));
    } catch (err) {
      setCheckingSession(false);
      setError(formatOidcError(err, 'OIDC_AUTHORIZE_ERROR', 'OIDC authorize failed'));
      setLoading(prev => ({ ...prev, authorize: false }));
    }
  };

  const handleCheckSession = async () => {
    setError('');
    setHasUser(null);
    setTokens('');
    setUserinfo('');
    setCheckingSession(true);
    setLoading(prev => ({ ...prev, session: true }));

    try {
      const webClient = getWebClient();
      const exists = await webClient.hasUser();
      setHasUser(exists);

      if (exists) {
        const user = await webClient.user();
        const resolvedTokens = await user?.token();
        if (resolvedTokens) {
          setTokens(JSON.stringify(resolvedTokens, null, 2));
        }
      }
      setActionResult('hasUser', { hasUser: exists });
      setCheckingSession(false);
      setLoading(prev => ({ ...prev, session: false }));
    } catch (err) {
      setCheckingSession(false);
      setError(formatOidcError(err, 'OIDC_HAS_USER_ERROR', 'OIDC session check failed'));
      setLoading(prev => ({ ...prev, session: false }));
    }
  };

  const handleToken = async () => {
    setError('');
    setCheckingSession(true);
    setLoading(prev => ({ ...prev, token: true }));

    try {
      const webClient = getWebClient();
      const user = await webClient.user();
      if (!user) {
        setHasUser(false);
        setCheckingSession(false);
        return;
      }
      const resolvedTokens = await user.token();
      setTokens(JSON.stringify(resolvedTokens, null, 2));
      setActionResult('token', { webClientId: webClient.id });
      setCheckingSession(false);
      setLoading(prev => ({ ...prev, token: false }));
    } catch (err) {
      setCheckingSession(false);
      setError(formatOidcError(err, 'OIDC_TOKEN_ERROR', 'OIDC token failed'));
      setLoading(prev => ({ ...prev, token: false }));
    }
  };

  const handleRefresh = async () => {
    setError('');
    setCheckingSession(true);
    setLoading(prev => ({ ...prev, refresh: true }));

    try {
      const webClient = getWebClient();
      const user = await webClient.user();
      if (!user) {
        setHasUser(false);
        setCheckingSession(false);
        return;
      }
      const refreshedTokens = await user.refresh();
      setTokens(JSON.stringify(refreshedTokens, null, 2));
      setActionResult('refresh', { webClientId: webClient.id });
      setCheckingSession(false);
      setLoading(prev => ({ ...prev, refresh: false }));
    } catch (err) {
      setCheckingSession(false);
      setError(formatOidcError(err, 'OIDC_REFRESH_ERROR', 'OIDC refresh failed'));
      setLoading(prev => ({ ...prev, refresh: false }));
    }
  };

  const handleUserinfo = async (cache: boolean) => {
    setError('');
    setCheckingSession(true);
    setLoading(prev => ({ ...prev, userinfo: true }));

    try {
      const webClient = getWebClient();
      const user = await webClient.user();
      if (!user) {
        setHasUser(false);
        setCheckingSession(false);
        return;
      }
      const info = await user.userinfo(cache);
      setUserinfo(JSON.stringify(info, null, 2));
      setActionResult('userinfo', { webClientId: webClient.id, cache });
      setCheckingSession(false);
      setLoading(prev => ({ ...prev, userinfo: false }));
    } catch (err) {
      setCheckingSession(false);
      setError(formatOidcError(err, 'OIDC_USERINFO_ERROR', 'OIDC userinfo failed'));
      setLoading(prev => ({ ...prev, userinfo: false }));
    }
  };

  const handleLogout = async () => {
    setError('');
    setCheckingSession(true);
    setLoading(prev => ({ ...prev, logout: true }));

    try {
      log.info('OIDC logout requested');
      const webClient = getWebClient();
      const user = await webClient.user();
      if (!user) {
        log.warn('OIDC logout skipped: no active user');
        setHasUser(false);
        setCheckingSession(false);
        return;
      }
      await user.logout();
      log.info('OIDC logout success');
      setHasUser(false);
      setTokens('');
      setUserinfo('');
      log.info('OIDC logout UI updated');
      setActionResult('logout', {
        webClientId: webClient.id,
        hasUserBefore: true,
      });
      setCheckingSession(false);
      setLoading(prev => ({ ...prev, logout: false }));
    } catch (err) {
      log.error('OIDC logout failed:', err as OidcError);
      setCheckingSession(false);
      setError(formatOidcError(err, 'OIDC_LOGOUT_ERROR', 'OIDC logout failed'));
      setLoading(prev => ({ ...prev, logout: false }));
    }
  };

  const handleRevoke = async () => {
    setError('');
    setCheckingSession(true);
    setLoading(prev => ({ ...prev, revoke: true }));

    try {
      const webClient = getWebClient();
      const user = await webClient.user();
      if (!user) {
        setHasUser(false);
        setCheckingSession(false);
        return;
      }
      await user.revoke();
      setTokens('');
      setUserinfo('');
      setActionResult('revoke', { webClientId: webClient.id });
      setCheckingSession(false);
      setLoading(prev => ({ ...prev, revoke: false }));
    } catch (err) {
      setCheckingSession(false);
      setError(formatOidcError(err, 'OIDC_REVOKE_ERROR', 'OIDC revoke failed'));
      setLoading(prev => ({ ...prev, revoke: false }));
    }
  };

  React.useEffect(() => {
    handleCheckSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.codeTitle}>OIDC Link Test</Text>
        <Text style={commonStyles.codeText}>
          Tap to launch the native authorization flow.
        </Text>

        {!checkingSession && hasUser !== true ? (
          <View>
            <TouchableOpacity
              style={commonStyles.buttonPrimary}
              onPress={() => handleAuthorize(false)}
            >
              <Text style={commonStyles.buttonText}>Authorize (default)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={() => handleAuthorize(true)}
            >
              <Text style={commonStyles.buttonTextSecondary}>
                Authorize (overrides)
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {checkingSession ? (
          <Text style={commonStyles.codeText}>Checking session...</Text>
        ) : null}

        <TouchableOpacity
          style={commonStyles.buttonSecondary}
          onPress={handleCheckSession}
        >
          <Text style={commonStyles.buttonTextSecondary}>Check session</Text>
        </TouchableOpacity>

        {hasUser ? (
          <View>
            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={handleRevoke}
            >
              <Text style={commonStyles.buttonTextSecondary}>Revoke Tokens</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={handleToken}
            >
              <Text style={commonStyles.buttonTextSecondary}>Fetch tokens</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={handleRefresh}
            >
              <Text style={commonStyles.buttonTextSecondary}>Refresh tokens</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={() => handleUserinfo(false)}
            >
              <Text style={commonStyles.buttonTextSecondary}>
                Fetch userinfo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={() => handleUserinfo(true)}
            >
              <Text style={commonStyles.buttonTextSecondary}>
                Fetch userinfo (cached)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={handleLogout}
            >
              <Text style={commonStyles.buttonTextSecondary}>Logout</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {renderSection(
          'config',
          'Client Config',
          JSON.stringify(
            {
              clientId: journeyConfig.clientId,
              discoveryEndpoint: journeyConfig.discoveryEndpoint,
              redirectUri: journeyConfig.redirectUri,
              scopes: journeyConfig.scopes,
              signOutRedirectUri: `${journeyConfig.redirectUri}/logout`,
              state: 'sample-state',
              nonce: 'sample-nonce',
              uiLocales: 'en-US',
              refreshThreshold: 60,
              logger: { level: 'debug' },
            },
            null,
            2
          )
        )}

        {hasUser !== null
          ? renderSection(
              'session',
              'Session Status',
              hasUser ? 'Active session found' : 'No active session',

              false,
              loading.session
            )
          : null}

        {result
          ? renderSection('result', 'Authorize Result', result, false, loading.authorize)
          : null}

        {tokens
          ? renderSection('tokens', 'Tokens', tokens, false, loading.token || loading.refresh)
          : null}

        {userinfo
          ? renderSection('userinfo', 'Userinfo', userinfo, false, loading.userinfo)
          : null}

        {error ? renderSection('error', 'Error', error, true) : null}
      </View>
    </ScrollView>
  );
}
