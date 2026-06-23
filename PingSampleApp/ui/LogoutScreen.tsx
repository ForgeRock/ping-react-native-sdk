/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useJourney } from '@ping-identity/rn-journey';
import { useOidc } from '@ping-identity/rn-oidc';
import { useDaVinci } from '@ping-identity/rn-davinci';
import { formatError } from './utils/formatError';
import { commonStyles } from '../src/styles/common';
import AsyncActionButton from './components/molecules/AsyncActionButton';
import CardSection from './components/molecules/CardSection';
import EmptyStateCard from './components/molecules/EmptyStateCard';

/**
 * Renders session logout controls for Journey and OIDC sessions.
 *
 * @returns Logout screen element.
 */
export default function LogoutScreen(): React.ReactElement {
  const [busyAll, setBusyAll] = useState<boolean>(false);
  const [busyJourney, setBusyJourney] = useState<boolean>(false);
  const [busyOidc, setBusyOidc] = useState<boolean>(false);
  const [busyDaVinci, setBusyDaVinci] = useState<boolean>(false);
  const [journeyActive, setJourneyActive] = useState<boolean>(false);
  const [oidcActive, setOidcActive] = useState<boolean>(false);
  const [davinciActive, setDavinciActive] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [, journeyActions] = useJourney();
  const [oidcState, oidcActions] = useOidc();
  const davinciActions = useDaVinci();

  const refreshSessionState = useCallback(async (): Promise<void> => {
    try {
      const journeySession = await journeyActions.user();
      setJourneyActive(Boolean(journeySession));
    } catch {
      setJourneyActive(false);
    }

    try {
      const oidcUser = await oidcActions.restore();
      setOidcActive(Boolean(oidcUser));
    } catch {
      setOidcActive(false);
    }

    try {
      const davinciSession = await davinciActions.user();
      setDavinciActive(Boolean(davinciSession));
    } catch {
      setDavinciActive(false);
    }
  }, [davinciActions, journeyActions, oidcActions]);

  useFocusEffect(
    useCallback(() => {
      void refreshSessionState();
      return undefined;
    }, [refreshSessionState]),
  );

  const handleLogoutAll = useCallback(async (): Promise<void> => {
    setBusyAll(true);
    setErrorMessage(null);
    setStatusMessage(null);
    const errors: string[] = [];

    try {
      await journeyActions.logoutUser();
    } catch (error) {
      errors.push(formatError(error));
    }

    try {
      await oidcActions.logout();
    } catch (error) {
      errors.push(formatError(error));
    }

    try {
      await davinciActions.logoutUser();
    } catch (error) {
      errors.push(formatError(error));
    }

    await refreshSessionState();
    setBusyAll(false);

    if (errors.length > 0) {
      setErrorMessage(errors.join('\n'));
      return;
    }
  }, [davinciActions, journeyActions, oidcActions, refreshSessionState]);

  const handleLogoutOidc = useCallback(async (): Promise<void> => {
    setBusyOidc(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      if (!oidcState.isAuthenticated) {
        setStatusMessage('No active OIDC Web session found.');
        return;
      }
      await oidcActions.logout();
      setStatusMessage('OIDC Web session logged out.');
    } catch (error) {
      setErrorMessage(formatError(error));
    } finally {
      setBusyOidc(false);
      await refreshSessionState();
    }
  }, [oidcActions, oidcState.isAuthenticated, refreshSessionState]);

  const handleLogoutJourney = useCallback(async (): Promise<void> => {
    setBusyJourney(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await journeyActions.logoutUser();
      setStatusMessage('Journey session logged out.');
    } catch (error) {
      setErrorMessage(formatError(error));
    } finally {
      setBusyJourney(false);
      await refreshSessionState();
    }
  }, [journeyActions, refreshSessionState]);

  const handleLogoutDaVinci = useCallback(async (): Promise<void> => {
    setBusyDaVinci(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await davinciActions.logoutUser();
      setStatusMessage('DaVinci session logged out.');
    } catch (error) {
      setErrorMessage(formatError(error));
    } finally {
      setBusyDaVinci(false);
      await refreshSessionState();
    }
  }, [davinciActions, refreshSessionState]);

  const disabled = busyAll || busyJourney || busyOidc || busyDaVinci;
  const hasAnySession = journeyActive || oidcActive || davinciActive;

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <CardSection
        title="Active Sessions"
        subtitle="Select a session to logout"
      >
        {hasAnySession ? (
          <AsyncActionButton
            label="Logout All Sessions"
            onPress={() => {
              void handleLogoutAll();
            }}
            loading={busyAll}
            disabled={disabled}
          />
        ) : (
          <AsyncActionButton
            label="No Active Sessions"
            onPress={() => {}}
            variant="secondary"
            disabled
          />
        )}
      </CardSection>

      {journeyActive ? (
        <CardSection title="Journey Session">
          <Text style={commonStyles.codeText}>
            Logout from Journey authentication
          </Text>
          <Text style={commonStyles.codeText}>Status: Active</Text>
          <AsyncActionButton
            label="Logout from Journey Session"
            onPress={() => {
              void handleLogoutJourney();
            }}
            loading={busyJourney}
            disabled={disabled}
          />
        </CardSection>
      ) : null}

      {oidcActive ? (
        <CardSection title="OIDC Web Session">
          <Text style={commonStyles.codeText}>
            Logout from OIDC Web authentication
          </Text>
          <Text style={commonStyles.codeText}>Status: Active</Text>
          <AsyncActionButton
            label="Logout from OIDC Web Session"
            onPress={() => {
              void handleLogoutOidc();
            }}
            loading={busyOidc}
            disabled={disabled}
          />
        </CardSection>
      ) : null}

      {davinciActive ? (
        <CardSection title="DaVinci Session">
          <Text style={commonStyles.codeText}>
            Logout from DaVinci authentication
          </Text>
          <Text style={commonStyles.codeText}>Status: Active</Text>
          <AsyncActionButton
            label="Logout from DaVinci Session"
            onPress={() => {
              void handleLogoutDaVinci();
            }}
            loading={busyDaVinci}
            disabled={disabled}
          />
        </CardSection>
      ) : null}

      {!hasAnySession ? (
        <EmptyStateCard
          title="No Active Sessions"
          message="You are not logged in to any session"
        />
      ) : null}
      {statusMessage ? (
        <Text style={commonStyles.textSuccess}>{statusMessage}</Text>
      ) : null}
      {errorMessage ? (
        <Text style={commonStyles.textError}>{errorMessage}</Text>
      ) : null}
    </ScrollView>
  );
}
