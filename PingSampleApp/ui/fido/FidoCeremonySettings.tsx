/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import type {
  FidoAuthenticationCeremonyOptions,
  FidoRegistrationCeremonyOptions,
} from '@ping-identity/rn-fido';

/**
 * Request timeout applied when the Android Play Services option is enabled.
 */
const PLAY_SERVICES_TIMEOUT_SECONDS = 60;

/**
 * Sample-app settings that shape FIDO registration and authentication
 * ceremonies.
 */
export type FidoCeremonySettings = {
  /**
   * Whether the ceremony prefers credentials that are immediately available on
   * the device. Sent on authentication on both platforms and on registration on
   * Android only.
   */
  preferImmediatelyAvailableCredentials: boolean;
  /**
   * Updates {@link FidoCeremonySettings.preferImmediatelyAvailableCredentials}.
   *
   * @param value - New toggle value.
   */
  setPreferImmediatelyAvailableCredentials: (value: boolean) => void;
  /**
   * Whether Android authentication is routed through Play Services with an
   * explicit request timeout. Always `false` on iOS.
   */
  androidPlayServicesTimeout: boolean;
  /**
   * Updates {@link FidoCeremonySettings.androidPlayServicesTimeout}.
   *
   * @param value - New toggle value.
   */
  setAndroidPlayServicesTimeout: (value: boolean) => void;
  /**
   * Whether Android registration sets the auto-select flag on the Credential
   * Manager create request. Always `false` on iOS.
   */
  androidRegistrationAutoSelect: boolean;
  /**
   * Updates {@link FidoCeremonySettings.androidRegistrationAutoSelect}.
   *
   * @param value - New toggle value.
   */
  setAndroidRegistrationAutoSelect: (value: boolean) => void;
  /**
   * Ceremony options derived from the toggles, ready to merge into the Journey
   * and DaVinci authentication calls.
   */
  authenticationOptions: FidoAuthenticationCeremonyOptions;
  /**
   * Ceremony options derived from the toggles, ready to merge into the Journey
   * and DaVinci registration calls. Empty on iOS and when no registration
   * toggle applies.
   */
  registrationOptions: FidoRegistrationCeremonyOptions;
};

const FidoCeremonySettingsContext = createContext<FidoCeremonySettings | null>(
  null,
);

/**
 * Provides {@link FidoCeremonySettings} to the Configuration screen and the
 * Journey and DaVinci panel controllers.
 *
 * @param props - Provider props.
 * @returns Provider element.
 */
export function FidoCeremonySettingsProvider(props: {
  children: ReactNode;
}): React.ReactElement {
  const [
    preferImmediatelyAvailableCredentials,
    setPreferImmediatelyAvailableCredentials,
  ] = useState(false);
  const [androidPlayServicesTimeout, setAndroidPlayServicesTimeout] =
    useState(false);
  const [androidRegistrationAutoSelect, setAndroidRegistrationAutoSelect] =
    useState(false);

  const value = useMemo<FidoCeremonySettings>(() => {
    const isAndroid = Platform.OS === 'android';
    const playServicesEnabled = isAndroid && androidPlayServicesTimeout;
    const registrationAutoSelectEnabled =
      isAndroid && androidRegistrationAutoSelect;
    const authenticationOptions: FidoAuthenticationCeremonyOptions = {
      ...(preferImmediatelyAvailableCredentials
        ? { preferImmediatelyAvailableCredentials: true }
        : {}),
      ...(playServicesEnabled
        ? {
            android: {
              useFido2ApiClient: true,
              playServices: { timeoutSeconds: PLAY_SERVICES_TIMEOUT_SECONDS },
            },
          }
        : {}),
    };
    const registrationOptions: FidoRegistrationCeremonyOptions = {
      ...(isAndroid && preferImmediatelyAvailableCredentials
        ? { preferImmediatelyAvailableCredentials: true }
        : {}),
      ...(registrationAutoSelectEnabled
        ? { android: { credentialManager: { isAutoSelectAllowed: true } } }
        : {}),
    };
    return {
      preferImmediatelyAvailableCredentials,
      setPreferImmediatelyAvailableCredentials,
      androidPlayServicesTimeout: playServicesEnabled,
      setAndroidPlayServicesTimeout,
      androidRegistrationAutoSelect: registrationAutoSelectEnabled,
      setAndroidRegistrationAutoSelect,
      authenticationOptions,
      registrationOptions,
    };
  }, [
    preferImmediatelyAvailableCredentials,
    androidPlayServicesTimeout,
    androidRegistrationAutoSelect,
  ]);

  return (
    <FidoCeremonySettingsContext.Provider value={value}>
      {props.children}
    </FidoCeremonySettingsContext.Provider>
  );
}

/**
 * Reads the FIDO ceremony settings.
 *
 * @returns Current settings and their setters.
 * @throws Error when called outside {@link FidoCeremonySettingsProvider}.
 */
export function useFidoCeremonySettings(): FidoCeremonySettings {
  const settings = useContext(FidoCeremonySettingsContext);
  if (!settings) {
    throw new Error(
      'useFidoCeremonySettings must be used inside <FidoCeremonySettingsProvider>',
    );
  }
  return settings;
}
