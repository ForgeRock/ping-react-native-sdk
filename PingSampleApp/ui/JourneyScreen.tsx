import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useJourney,
  JourneyUserSession,
  listRegisteredStoragesFromCore,
} from '@react-native-pingidentity/journey';
import { colors } from '../src/styles/colors';
import { commonStyles } from '../src/styles/common';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../App';

type JourneyRouteProp = RouteProp<RootStackParamList, 'Journey'>;

export default function JourneyScreen() {
  const route = useRoute<JourneyRouteProp>();
  const { journeyClient } = route.params;
  const [node, { start, next, resume, user, logoutUser, loading, error }] =
    useJourney(journeyClient);
  const [nativeStorageIds, setNativeStorageIds] = useState<string[]>([]);

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [session, setSession] = useState<any>(null);
  const [givenName, setGivenName] = useState<string>();
  const [journeyName, setJourneyName] = useState('');
  const [suggestedJourneys, setSuggestedJourneys] = useState<string[]>([]);
  const [showJourneyInput, setShowJourneyInput] = useState(true);
  const [resumeUrl, setResumeUrl] = useState('');

  // Load journey suggestions
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('recentJourneys');
        if (stored) setSuggestedJourneys(JSON.parse(stored));
        const ids = await listRegisteredStoragesFromCore();
        setNativeStorageIds(ids);
      } catch (e) {
        console.warn('⚠️ Failed to load recent journeys', e);
      }
    })();
  }, []);

  const saveSuggestion = async (name: string) => {
    try {
      const updated = [
        name,
        ...suggestedJourneys.filter(j => j !== name),
      ].slice(0, 5);
      setSuggestedJourneys(updated);
      await AsyncStorage.setItem('recentJourneys', JSON.stringify(updated));
    } catch (e) {
      console.warn('⚠️ Failed to save journey name', e);
    }
  };

  // Fetch user info after success
  useEffect(() => {
    const getUserDetails = async () => {
      try {
        const journeyUser = (await user()) as JourneyUserSession | null;
        if (!journeyUser) return;
        const gn = journeyUser.userInfo?.given_name as string | undefined;
        if (gn) setGivenName(gn);
      } catch (err) {
        console.error('❌ Error fetching user details:', err);
      }
    };
    if (node?.type === 'SuccessNode') getUserDetails();
  }, [node, user]);

  const onStart = async () => {
    if (!journeyName.trim()) {
      Alert.alert('Enter a journey name first');
      return;
    }
    await saveSuggestion(journeyName.trim());
    try {
      await start(journeyName.trim());
      setShowJourneyInput(false);
    } catch (err) {
      Alert.alert('⚠️ Failed to start journey', String(err));
    }
  };

  const onSubmit = async () => {
    if (!node?.callbacks) return;
    const callbacks = node.callbacks.map((cb: any) => ({
      type: cb.type,
      value: inputs[cb.type] || '',
    }));
    await next({ callbacks });
  };

  const onResume = async () => {
    if (!resumeUrl.trim()) {
      Alert.alert('Paste the resume URL from your email first.');
      return;
    }
    try {
      await resume(resumeUrl.trim());
      setResumeUrl('');
    } catch (err) {
      Alert.alert('⚠️ Resume failed', String(err));
    }
  };

  const onLogout = async () => {
    try {
      await logoutUser();
      setSession(null);
      setInputs({});
      setJourneyName('');
      setShowJourneyInput(true);
      Alert.alert('Logged out');
    } catch (err: any) {
      Alert.alert('⚠️ Logout failed', err.message);
    }
  };

  const renderCallbacks = () => {
    if (!node?.callbacks) return null;
    let hasSuspended = false;

    const callbackViews = node.callbacks.map((cb: any, index: number) => {
      const key = `${cb.type}-${index}`;

      if (cb.type === 'SuspendedTextOutputCallback') {
        hasSuspended = true;
        const message =
          cb.prompt ??
          'An email has been sent. Please check your inbox to continue.';

        return (
          <View key={key} style={commonStyles.suspendedBox}>
            <Text style={commonStyles.suspendedMessage}>{message}</Text>

            <View>
              <TextInput
                style={commonStyles.input}
                placeholder="Paste resume URL from email"
                placeholderTextColor={colors.gray}
                value={resumeUrl}
                onChangeText={setResumeUrl}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[
                  commonStyles.buttonPrimary,
                  { backgroundColor: colors.blue },
                ]}
                onPress={onResume}
                disabled={loading}
              >
                <Text style={commonStyles.buttonText}>Resume Journey</Text>
              </TouchableOpacity>

              <Text style={commonStyles.helperNote}>
                In a production app, this step would be handled automatically
                through deep linking when the user clicks the magic-link email.
              </Text>
            </View>
          </View>
        );
      }

      // Default callback handling
      const label =
        cb.prompt ||
        (cb.type === 'NameCallback'
          ? 'Username'
          : cb.type === 'PasswordCallback'
          ? 'Password'
          : cb.type);
      const secure = cb.type === 'PasswordCallback';

      return (
        <View key={key} style={commonStyles.inputGroup}>
          <Text style={commonStyles.inputLabel}>{label}</Text>
          <TextInput
            style={commonStyles.input}
            secureTextEntry={secure}
            autoCapitalize="none"
            value={inputs[cb.type] || ''}
            onChangeText={(text: any) =>
              setInputs(prev => ({ ...prev, [cb.type]: text }))
            }
            placeholder={label}
            placeholderTextColor={colors.gray}
          />
        </View>
      );
    });

    return (
      <>
        {callbackViews}
        {!hasSuspended && (
          <TouchableOpacity
            style={commonStyles.buttonPrimary}
            onPress={onSubmit}
            disabled={loading}
          >
            <Text style={commonStyles.buttonText}>Continue</Text>
          </TouchableOpacity>
        )}
      </>
    );
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.textSmall}>Journey UUID:{`\n\n`}{journeyClient.getId()}</Text>
      </View>
      <View style={commonStyles.card}>
        {showJourneyInput && (
          <>
            <TextInput
              style={commonStyles.input}
              placeholder="Enter journey name"
              placeholderTextColor={colors.gray}
              value={journeyName}
              onChangeText={setJourneyName}
            />
            <View style={commonStyles.suggestionContainer}>
              {suggestedJourneys.map(name => (
                <TouchableOpacity
                  key={name}
                  onPress={() => setJourneyName(name)}
                  style={commonStyles.suggestionChip}
                >
                  <Text style={commonStyles.suggestionText}>☁️ {name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {loading && <ActivityIndicator size="large" color={colors.primary} />}

        {!node && (
          <TouchableOpacity
            style={[commonStyles.buttonPrimary]}
            onPress={onStart}
            disabled={loading}
          >
            <Text style={commonStyles.buttonText}>Start Journey</Text>
          </TouchableOpacity>
        )}

        {node?.type === 'ContinueNode' && renderCallbacks()}

        {node?.type === 'SuccessNode' && (
          <>
            <Text style={commonStyles.textSuccess}>
              Welcome {givenName ?? 'User'}!
            </Text>
            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              onPress={async () => {
                const journeyUser = (await user()) as JourneyUserSession;
                setSession(journeyUser?.accessToken);
              }}
            >
              <Text style={commonStyles.buttonTextSecondary}>
                Get User Info
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={commonStyles.buttonPrimary}
              onPress={onLogout}
            >
              <Text style={commonStyles.buttonText}>Logout</Text>
            </TouchableOpacity>
          </>
        )}

        {node?.type === 'ErrorNode' && (
          <Text style={commonStyles.textError}>
            ⚠️ {node.message || 'Error occurred'}
          </Text>
        )}

        {error && (
          <Text style={commonStyles.textError}>
            {error.message ?? String(error)}
          </Text>
        )}
      </View>

      {session && (
        <View style={commonStyles.codeBox}>
          <Text style={commonStyles.codeTitle}>Access Token</Text>
          <Text style={commonStyles.codeText}>
            {JSON.stringify(session, null, 2)}
          </Text>
        </View>
      )}

      <View style={commonStyles.card}>
        <Text style={commonStyles.journeySectionTitle}>
          📦 Registered Native Storages from Core
        </Text>

        {nativeStorageIds.length === 0 ? (
          <Text style={commonStyles.textSmall}>
            No storages registered yet.
          </Text>
        ) : (
          nativeStorageIds.map(id => (
            <Text key={id} style={commonStyles.textSmall}>
              • {id}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}
