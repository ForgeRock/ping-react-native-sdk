/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { commonStyles } from '../src/styles/common';
import { journeyConfig, pingAdvancedIdentityCloudConfig } from '../src/clients';
import {
  CacheStrategy,
  configureOidcStorage,
  OidcStorage,
} from '@ping-identity/rn-storage';
import { logger } from '@ping-identity/rn-logger';
import {
  createOidcClient,
  createOidcWebClient,
  OidcAuthorizeResult,
  OidcError,
  OidcWebClient,
} from '@ping-identity/rn-oidc';

/**
 * OIDC SDK demonstration screen for authorize, token, refresh, and userinfo flows.
 */
export default function OidcScreen() {
  const webClientDefaultRef = useRef<OidcWebClient | null>(null);
  const storageRef = useRef<OidcStorage | null>(null);
  const loggerInstance = useMemo(() => logger({ level: 'debug' }), []);
  const [result, setResult] = useState<string>('');
  const [tokens, setTokens] = useState<string>('');
  const [userinfo, setUserinfo] = useState<string>('');
  const [userinfoDetails, setUserinfoDetails] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [showRawUserinfo, setShowRawUserinfo] = useState<boolean>(false);
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
    isLoading?: boolean,
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
    fallbackMessage: string,
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

  const fetchUserinfoForWebClient = async (
    webClient: OidcWebClient,
    cache: boolean,
  ) => {
    const user = await webClient.user();
    if (!user) {
      setHasUser(false);
      return;
    }
    const info = await user.userinfo(cache);
    setUserinfo(JSON.stringify(info, null, 2));
    setUserinfoDetails(parseUserinfo(info));
  };

  const setActionResult = (
    action: string,
    payload: Record<string, unknown>,
  ) => {
    setResult(JSON.stringify({ action, ...payload }, null, 2));
  };

  const parseUserinfo = (value: unknown) => {
    if (!value) {
      return null;
    }
    if (typeof value === 'object') {
      return value as Record<string, unknown>;
    }
    try {
      return JSON.parse(String(value)) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const defaultOidcConfig = {
    clientId: pingAdvancedIdentityCloudConfig.clientId,
    discoveryEndpoint: pingAdvancedIdentityCloudConfig.discoveryEndpoint,
    redirectUri: pingAdvancedIdentityCloudConfig.redirectUri,
    scopes: [...pingAdvancedIdentityCloudConfig.scopes],
    signOutRedirectUri: `${pingAdvancedIdentityCloudConfig.redirectUri}/logout`,
    ios: {
      browserType: 'ephemeralAuthSession' as const,
      browserMode: 'login' as const,
    },
  };

  const getWebClient = () => {
    const ref = webClientDefaultRef;
    if (ref.current) {
      return ref.current;
    }
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
      }, {
        logger: loggerInstance,
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
    const baseConfig = defaultOidcConfig;
    const client = createOidcClient({
      ...baseConfig,
      storage: storage,
      logger: loggerInstance,
    });
    const webClient = createOidcWebClient(client);
    ref.current = webClient;
    return webClient;
  };

  const handleAuthorize = async () => {
    setError('');
    setResult('');
    setTokens('');
    setUserinfo('');
    setUserinfoDetails(null);
    setShowRawUserinfo(false);
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
        await fetchUserinfoForWebClient(webClient, true);
        setCheckingSession(false);
        setLoading(prev => ({ ...prev, authorize: false }));
        return;
      }
      setCheckingSession(false);

      const outcome: OidcAuthorizeResult = await webClient.authorize();
      let tokenResult: string | null = null;

      if (outcome.type === 'success') {
        const user = await webClient.user();
        const resolvedTokens = await user?.token();
        if (resolvedTokens) {
          tokenResult = JSON.stringify(resolvedTokens, null, 2);
        }
        setHasUser(true);
        await fetchUserinfoForWebClient(webClient, true);
      }

      setActionResult('authorize', {
        clientId: journeyConfig.clientId,
        webClientId: webClient.id,
        outcome,
        overrides: false,
        mode: 'default',
      });
      if (tokenResult) {
        setTokens(tokenResult);
      }
      setLoading(prev => ({ ...prev, authorize: false }));
    } catch (err) {
      setCheckingSession(false);
      setError(
        formatOidcError(err, 'OIDC_AUTHORIZE_ERROR', 'OIDC authorize failed'),
      );
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
        await fetchUserinfoForWebClient(webClient, true);
      }
      setActionResult('hasUser', { hasUser: exists });
      setCheckingSession(false);
      setLoading(prev => ({ ...prev, session: false }));
    } catch (err) {
      setCheckingSession(false);
      setError(
        formatOidcError(
          err,
          'OIDC_HAS_USER_ERROR',
          'OIDC session check failed',
        ),
      );
      setLoading(prev => ({ ...prev, session: false }));
    }
  };




  const handleLogout = async () => {
    setError('');
    setCheckingSession(true);
    setLoading(prev => ({ ...prev, logout: true }));

    try {
      const webClient = getWebClient();
      const user = await webClient.user();
      if (!user) {
        setHasUser(false);
        setCheckingSession(false);
        return;
      }
      await user.logout();
      setHasUser(false);
      setTokens('');
      setUserinfo('');
      setUserinfoDetails(null);
      setShowRawUserinfo(false);

      setActionResult('logout', {
        webClientId: webClient.id,
        success: true,
        hasUserBefore: true,
      });
      setCheckingSession(false);
      setLoading(prev => ({ ...prev, logout: false }));
    } catch (err) {
      setCheckingSession(false);
      setError(formatOidcError(err, 'OIDC_LOGOUT_ERROR', 'OIDC logout failed'));
      setLoading(prev => ({ ...prev, logout: false }));
    }
  };


  React.useEffect(() => {
    handleCheckSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.codeTitle}>OIDC Actions</Text>
        {hasUser !== true ? (
          <Text style={commonStyles.codeText}>
            Tap to launch the native authorization flow.
          </Text>
        ) : null}

        {!checkingSession && hasUser !== true ? (
          <View>
            <TouchableOpacity
              style={commonStyles.buttonPrimary}
              onPress={handleAuthorize}
            >
              <Text style={commonStyles.buttonText}>Authorize</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {checkingSession ? (
          <Text style={commonStyles.codeText}>Checking session...</Text>
        ) : null}

        {hasUser ? (
          <View>
            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={handleLogout}
            >
              <Text style={commonStyles.buttonTextSecondary}>Logout</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.codeTitle}>Summary</Text>

        {userinfoDetails ? (
          <View style={commonStyles.codeBox}>
            <Text style={commonStyles.codeTitle}>Userinfo Summary</Text>
            <Text style={commonStyles.codeText}>
              {`Name: ${String(userinfoDetails.name ?? '')}`}
            </Text>
            <Text style={commonStyles.codeText}>
              {`Given Name: ${String(userinfoDetails.given_name ?? '')}`}
            </Text>
            <Text style={commonStyles.codeText}>
              {`Family Name: ${String(userinfoDetails.family_name ?? '')}`}
            </Text>
            <Text style={commonStyles.codeText}>
              {`Email: ${String(userinfoDetails.email ?? '')}`}
            </Text>
            <Text style={commonStyles.codeText}>
              {`Preferred Username: ${String(
                userinfoDetails.preferred_username ?? '',
              )}`}
            </Text>
            <Text style={commonStyles.codeText}>
              {`Sub: ${String(userinfoDetails.sub ?? '')}`}
            </Text>
            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={() => setShowRawUserinfo(prev => !prev)}
            >
              <Text style={commonStyles.buttonTextSecondary}>
                {showRawUserinfo ? 'Hide Info' : 'Show Raw User Info'}
              </Text>
            </TouchableOpacity>
            {showRawUserinfo && userinfo ? (
              <Text style={commonStyles.codeText}>{userinfo}</Text>
            ) : null}
          </View>
        ) : null}

        {hasUser === true
          ? renderSection(
              'session',
              'Session Status',
              'Active session found',
              false,
              loading.session,
            )
          : null}

        {result
          ? renderSection(
              'result',
              'Authorize Result',
              result,
              false,
              loading.authorize,
            )
          : null}

        {hasUser === true
          ? renderSection(
              'tokens',
              'Tokens',
              tokens || 'No tokens loaded yet.',
              false,
              loading.token || loading.refresh,
            )
          : null}
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.codeTitle}>Details</Text>

        {renderSection(
          'config',
          'Client Config',
          JSON.stringify(
            {
              default: defaultOidcConfig,
            },
            null,
            2,
          ),
        )}

        {error ? renderSection('error', 'Error', error, true) : null}
      </View>
    </ScrollView>
  );
}
