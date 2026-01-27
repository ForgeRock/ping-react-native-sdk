import React, { useRef, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { commonStyles } from '../src/styles/common';
import { journeyConfig } from '../src/clients';
import {
  CacheStrategy,
  configureOidcStorage,
  OidcStorage,
} from '@react-native-pingidentity/storage';
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
  const [result, setResult] = useState<string>('');
  const [tokens, setTokens] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [hasUser, setHasUser] = useState<boolean | null>(null);
  const [checkingSession, setCheckingSession] = useState<boolean>(false);

  const getWebClient = () => {
    if (webClientRef.current) {
      return webClientRef.current;
    }
    const { clientId, discoveryEndpoint, redirectUri, scopes } = journeyConfig;
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
    const client = createOidcClient({
      clientId,
      discoveryEndpoint,
      redirectUri,
      scopes,
      storage: storage,
    });
    const webClient = createOidcWebClient(client);
    webClientRef.current = webClient;
    return webClient;
  };

  const handleAuthorize = async () => {
    setError('');
    setResult('');
    setTokens('');
    setHasUser(null);

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
      }

      setResult(
        JSON.stringify(
          { clientId: journeyConfig.clientId, webClientId: webClient.id, outcome },
          null,
          2
        )
      );
      if (tokenResult) {
        setTokens(tokenResult);
      }
    } catch (err) {
      setCheckingSession(false);
      const errorPayload = err as OidcError;
      const errorDetails = {
        type: errorPayload?.type ?? 'unknown_error',
        error: errorPayload?.error ?? 'OIDC_AUTHORIZE_ERROR',
        message: errorPayload?.message ?? 'OIDC authorize failed',
        code: errorPayload?.code,
        status: errorPayload?.status,
      };
      setError(JSON.stringify(errorDetails, null, 2));
    }
  };

  const handleCheckSession = async () => {
    setError('');
    setHasUser(null);
    setTokens('');
    setCheckingSession(true);

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
      setCheckingSession(false);
    } catch (err) {
      setCheckingSession(false);
      const errorPayload = err as OidcError;
      const errorDetails = {
        type: errorPayload?.type ?? 'unknown_error',
        error: errorPayload?.error ?? 'OIDC_HAS_USER_ERROR',
        message: errorPayload?.message ?? 'OIDC session check failed',
        code: errorPayload?.code,
        status: errorPayload?.status,
      };
      setError(JSON.stringify(errorDetails, null, 2));
    }
  };

  const handleLogout = async () => {
    setError('');
    setCheckingSession(true);

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
      setCheckingSession(false);
    } catch (err) {
      setCheckingSession(false);
      const errorPayload = err as OidcError;
      const errorDetails = {
        type: errorPayload?.type ?? 'unknown_error',
        error: errorPayload?.error ?? 'OIDC_LOGOUT_ERROR',
        message: errorPayload?.message ?? 'OIDC logout failed',
        code: errorPayload?.code,
        status: errorPayload?.status,
      };
      setError(JSON.stringify(errorDetails, null, 2));
    }
  };

  const handleRevoke = async () => {
    setError('');
    setCheckingSession(true);

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
      setCheckingSession(false);
    } catch (err) {
      setCheckingSession(false);
      const errorPayload = err as OidcError;
      const errorDetails = {
        type: errorPayload?.type ?? 'unknown_error',
        error: errorPayload?.error ?? 'OIDC_REVOKE_ERROR',
        message: errorPayload?.message ?? 'OIDC revoke failed',
        code: errorPayload?.code,
        status: errorPayload?.status,
      };
      setError(JSON.stringify(errorDetails, null, 2));
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
          <TouchableOpacity
            style={commonStyles.buttonPrimary}
            onPress={handleAuthorize}
          >
            <Text style={commonStyles.buttonText}>Run authorize()</Text>
          </TouchableOpacity>
        ) : null}

        {checkingSession ? (
          <Text style={commonStyles.codeText}>Checking session...</Text>
        ) : null}

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
              onPress={handleLogout}
            >
              <Text style={commonStyles.buttonTextSecondary}>Logout</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {hasUser !== null ? (
          <View style={commonStyles.codeBox}>
            <Text style={commonStyles.codeTitle}>Session Status</Text>
            <Text style={commonStyles.codeText}>
              {hasUser ? 'Active session found' : 'No active session'}
            </Text>
          </View>
        ) : null}

        {result ? (
          <View style={commonStyles.codeBox}>
            <Text style={commonStyles.codeTitle}>Authorize Result</Text>
            <Text style={commonStyles.codeText}>{result}</Text>
          </View>
        ) : null}

        {tokens ? (
          <View style={commonStyles.codeBox}>
            <Text style={commonStyles.codeTitle}>Tokens</Text>
            <Text style={commonStyles.codeText}>{tokens}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={commonStyles.codeBox}>
            <Text style={commonStyles.codeTitle}>Error</Text>
            <Text style={commonStyles.textError}>{error}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
